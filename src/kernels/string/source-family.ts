import { S, type StringKernel } from '../../engines/string/trace';
import { jaccard, shingles, UnionFind } from './_normalise';

export interface FamilyResult { family: number[]; origin: number[] }

// Republications of one story share most of their word k-shingles (k = 3 by default) even
// after light edits, a trimmed ending or an added line, while different stories share almost
// none. Every pair is compared; a pair is linked when its shingle Jaccard similarity reaches
// the threshold (0.3 by default; at 0 every pair links), or when both carry the same agency
// credit and the same headline. Linked documents form families (union-find), and each family's
// earliest publication is its origin.
export const kernel: StringKernel<'documents', FamilyResult> = {
  input: 'documents',
  counters: { pair: 'Pairs compared', union: 'Unions' },
  params: [
    { kind: 'range', key: 'threshold', label: 'Link at Jaccard', min: 0, max: 1, step: 0.05, value: 0.3, rebuild: true },
    { kind: 'range', key: 'shingle', label: 'Shingle length (words)', min: 1, max: 5, step: 1, value: 3, rebuild: true },
  ],
  // a generator, a document's row of pairs per step: at threshold 0 every pair is linked and drawn
  *run(ops, { docs }, params) {
    const at = Number(params.threshold ?? 0.3);
    const threshold = Number.isFinite(at) ? at : 0.3;
    const k = Math.max(1, Number(params.shingle ?? 3) || 3);
    const n = docs.length;
    const sets = docs.map((d) => new Set(shingles(d.text, k)));
    ops.list('docs', docs.map((d) => `${d.id} ${d.outlet}${d.credit ? ` (${d.credit})` : ''}`), { label: 'Documents', lines: 5 });
    const uf = new UnionFind(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        ops.tick('pair');
        const s = jaccard(sets[i], sets[j]);
        const credit = docs[i].credit !== '' && docs[i].credit === docs[j].credit && docs[i].title === docs[j].title;
        if (s >= threshold || credit) {
          if (uf.union(i, j)) ops.tick('union');
          ops.link('docs', i, 'docs', j, S.hit);
          ops.mark('docs', i, S.focus); ops.mark('docs', j, S.focus);
          ops.note(`${docs[i].outlet} and ${docs[j].outlet}: ${credit && s < threshold ? 'same credit and headline' : `Jaccard ${s.toFixed(2)}`}`);
          ops.clear('docs');
        }
      }
      yield null;
    }
    const roots = [...new Set(docs.map((_, i) => uf.find(i)))];
    const family = docs.map((_, i) => roots.indexOf(uf.find(i)));
    const origin = roots.map((_, f) => {
      let best = -1;
      docs.forEach((d, i) => { if (family[i] === f && (best < 0 || d.time < docs[best].time)) best = i; });
      return best;
    });
    ops.unlink();
    docs.forEach((_, i) => ops.heat('docs', i, roots.length > 1 ? family[i] / (roots.length - 1) : 0.5));
    origin.forEach((i) => ops.mark('docs', i, S.done));
    let tp = 0; let fp = 0; let fn = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const same = docs[i].family === docs[j].family; const call = family[i] === family[j];
        if (call && same) tp++; else if (call) fp++; else if (same) fn++;
      }
    }
    ops.note(`${n} documents collapse to ${roots.length} sources`);
    ops.stat('Documents', String(n));
    ops.stat('Sources found', String(roots.length));
    ops.stat('Stories in the input', String(new Set(docs.map((d) => d.family)).size));
    ops.stat('Pairwise precision / recall', `${tp + fp ? (tp / (tp + fp)).toFixed(2) : '1.00'} / ${tp + fn ? (tp / (tp + fn)).toFixed(2) : '1.00'}`);
    return { family, origin };
  },
};
