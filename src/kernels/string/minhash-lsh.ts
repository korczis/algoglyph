import { S, type StringKernel } from '../../engines/string/trace';
import { fnv1a, jaccard, mix32, shingles } from './_normalise';

export interface MinhashResult { sig: number[][]; candidates: [number, number][]; shingles: number[][]; bands: number; rows: number }

// Each document is its set of word 3-shingles, hashed to 32 bits. For each of b·r seeded
// mixing functions the signature keeps the minimum over the set; two signatures agree in a
// position with probability equal to the sets' Jaccard similarity. The signature is cut into b
// bands of r rows, and documents whose band is identical land in the same bucket: a pair of
// similarity s becomes a candidate with probability 1 − (1 − s^r)^b.
export const kernel: StringKernel<'documents', MinhashResult> = {
  input: 'documents',
  counters: { hash: 'Hash evaluations', bucket: 'Bucket insertions' },
  chart: { title: 'Estimate against exact Jaccard', x: 'exact Jaccard similarity', y: 'similarity' },
  params: [
    { kind: 'range', key: 'bands', label: 'Bands b', min: 2, max: 16, step: 1, value: 8, rebuild: true },
    { kind: 'range', key: 'rows', label: 'Rows per band r', min: 1, max: 6, step: 1, value: 4, rebuild: true },
  ],
  // a generator: one hash function of one document, one band or one row of pairs per step
  *run(ops, { docs }, params) {
    const bands = Number(params.bands ?? 8) || 8; const rows = Number(params.rows ?? 4) || 4;
    const k = bands * rows;
    // a cell's colour is a function of its minimum, so equal minima show as equal colours
    const sets = docs.map((d) => [...new Set(shingles(d.text, 3).map(fnv1a))]);
    ops.table('sig', docs.length, k, { label: 'Signatures', rowHead: docs.map((d) => `${d.id} ${d.outlet}`) });
    const sig = docs.map(() => new Array<number>(k).fill(0));
    for (const [r, set] of sets.entries()) {
      for (let h = 0; h < k; h++) {
        let min = 0xffffffff;
        for (const x of set) { ops.tick('hash'); const v = mix32(x, h + 1); if (v < min) min = v; }
        sig[r][h] = min;
        ops.heat('sig', r * k + h, (min % 251) / 250);
        yield null;
      }
      ops.note(`document ${r}: ${set.length} shingles, ${k} minima`);
      yield null;
    }
    const cand = new Set<string>();
    ops.list('cand', [], { label: 'Candidate pairs', lines: 2 });
    for (let b = 0; b < bands; b++) {
      const buckets = new Map<string, number[]>();
      ops.clear('sig', true);
      sig.forEach((s, r) => {
        ops.tick('bucket');
        const key = s.slice(b * rows, (b + 1) * rows).join(',');
        const list = buckets.get(key) ?? [];
        list.push(r);
        buckets.set(key, list);
        for (let c = b * rows; c < (b + 1) * rows; c++) ops.markCell('sig', r, c, S.focus);
      });
      for (const list of buckets.values()) {
        for (let x = 0; x < list.length; x++) {
          for (let y = x + 1; y < list.length; y++) {
            const key = `${list[x]}-${list[y]}`;
            if (!cand.has(key)) { cand.add(key); ops.push('cand', key, docs[list[x]].family === docs[list[y]].family ? S.hit : S.miss); }
          }
        }
      }
      ops.note(`band ${b}: ${buckets.size} buckets`);
      yield null;
    }
    ops.clear('sig', true);
    const candidates = [...cand].map((s) => s.split('-').map(Number) as [number, number]);
    // measured against the exact similarity of every pair
    const pts: [number, number][] = [];
    let err = 0; let pairs = 0; let dupes = 0; let caught = 0;
    const setsS = sets.map((s) => new Set(s));
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const exact = jaccard(setsS[i], setsS[j]);
        let agree = 0;
        for (let h = 0; h < k; h++) if (sig[i][h] === sig[j][h]) agree++;
        pts.push([exact, agree / k]);
        err += Math.abs(agree / k - exact); pairs++;
        if (docs[i].family === docs[j].family) { dupes++; if (cand.has(`${i}-${j}`)) caught++; }
      }
      yield null;
    }
    pts.sort((a, b) => a[0] - b[0]);
    for (const [x, y] of pts) { ops.plot('MinHash estimate', x, y); ops.plot('Exact', x, x); }
    ops.stat('Candidate pairs', `${candidates.length} of ${pairs}`);
    ops.stat('Copies of one story caught', `${caught} of ${dupes}`);
    ops.stat('Mean estimate error', pairs ? (err / pairs).toFixed(3) : '0');
    return { sig, candidates, shingles: sets, bands, rows };
  },
};
