import { S, type StringKernel } from '../../engines/string/trace';
import { fnv1a, mix32 } from './_normalise';

/** The widest fingerprint, and the default. */
const BITS = 64;

/** The first `bits` (up to 64) feature bits of a word, from two seeded 32-bit hashes. */
export function featureBits(word: string, bits = BITS): number[] {
  const h = fnv1a(word);
  const a = mix32(h, 1); const b = mix32(h, 2);
  return Array.from({ length: bits }, (_, i) => ((i < 32 ? a >>> i : b >>> (i - 32)) & 1));
}

export interface SimhashResult { prints: number[][]; distance: number[][] }

// Each word of a document hashes to B bits (64 by default) and votes on every bit position: its count is added
// where its bit is 1 and subtracted where it is 0. The fingerprint keeps the sign of each total.
// Documents that share most of their weighted words share most votes, so the Hamming distance
// between fingerprints falls as their cosine similarity rises. Charikar's random-hyperplane
// argument makes that exact for Gaussian hyperplanes, each bit differing with probability θ/π for
// the angle θ between the documents; the hashed ±1 bits used here only approximate them, so the
// relation holds on average and only roughly.
export const kernel: StringKernel<'documents', SimhashResult> = {
  input: 'documents',
  counters: { vote: 'Bit votes', xor: 'Fingerprint bits compared' },
  chart: { title: 'Fingerprint distance against cosine similarity', x: 'cosine similarity of word counts', y: 'Hamming distance (bits)' },
  params: [{
    kind: 'select', key: 'bits', label: 'Fingerprint bits', value: '64', rebuild: true,
    options: ['16', '32', '64'].map((v) => ({ value: v, label: `${v} bits` })),
  }],
  *run(ops, { docs }, params) {
    const B = [16, 32, 64].includes(Number(params.bits)) ? Number(params.bits) : BITS;
    ops.table('v', B / 16, 16, { label: 'Bit totals' });
    ops.list('fp', [], { label: 'Fingerprints', lines: 4 });
    const tfs = docs.map((d) => {
      const tf = new Map<string, number>();
      for (const w of d.text.toLowerCase().split(/\s+/).filter(Boolean)) tf.set(w, (tf.get(w) ?? 0) + 1);
      return tf;
    });
    const prints: number[][] = [];
    for (const [r, tf] of tfs.entries()) {
      const v = new Array<number>(B).fill(0);
      for (let k = 0; k < B; k++) ops.put('v', Math.floor(k / 16), k % 16, '');
      for (const [w, c] of tf) {
        const bits = featureBits(w, B);
        ops.tick('vote', B);
        for (let k = 0; k < B; k++) v[k] += bits[k] ? c : -c;
        const top = Math.max(1, ...v.map(Math.abs));
        for (let k = 0; k < B; k++) ops.heat('v', k, 0.5 + v[k] / (2 * top));
        yield null;
      }
      const fp = v.map((x) => (x > 0 ? 1 : 0));
      let hex = '';
      for (let k = 0; k < B; k += 4) hex += (fp[k] * 8 + fp[k + 1] * 4 + fp[k + 2] * 2 + fp[k + 3]).toString(16);
      ops.push('fp', `${r}: ${hex}`, S.done);
      ops.note(`document ${r} (${docs[r].outlet}): ${tf.size} distinct words voted`);
      prints.push(fp);
    }
    const n = docs.length;
    const distance = prints.map(() => new Array<number>(n).fill(0));
    const pts: [number, number][] = [];
    let inS = 0; let inN = 0; let outS = 0; let outN = 0;
    for (let i = 0; i < n; i++) {
      yield null;
      for (let j = i + 1; j < n; j++) {
        let d = 0;
        for (let k = 0; k < B; k++) { if (prints[i][k] !== prints[j][k]) d++; }
        ops.tick('xor', B);
        distance[i][j] = distance[j][i] = d;
        let dot = 0; let na = 0; let nb = 0;
        for (const [w, c] of tfs[i]) { dot += c * (tfs[j].get(w) ?? 0); na += c * c; }
        for (const c of tfs[j].values()) nb += c * c;
        pts.push([dot / Math.sqrt(na * nb || 1), d]);
        if (docs[i].family === docs[j].family) { inS += d; inN++; } else { outS += d; outN++; }
      }
    }
    pts.sort((a, b) => a[0] - b[0]);
    for (const [x, y] of pts) ops.plot('Hamming distance', x, y);
    ops.stat('Mean distance, copies of one story', inN ? `${(inS / inN).toFixed(1)} bits` : 'no copies');
    ops.stat('Mean distance, different stories', outN ? `${(outS / outN).toFixed(1)} bits` : 'one story');
    return { prints, distance };
  },
};
