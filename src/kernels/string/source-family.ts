import { S, type StringKernel } from '../../engines/string/trace';
import { jaccard, shingles, UnionFind } from './_normalise';

export interface FamilyResult { family: number[]; origin: number[] }

const THRESHOLD = 0.3;

// Republications of one story share most of their word 3-shingles even after light edits, a
// trimmed ending or an added line, while different stories share almost none. Every pair is
// compared; a pair is linked when its shingle Jaccard similarity reaches 0.3, or when both carry
// the same agency credit and the same headline. Linked documents form families (union-find), and
// each family's earliest publication is its origin.
export const kernel: StringKernel<'documents', FamilyResult> = {
  input: 'documents',
  counters: { pair: 'Pairs compared', union: 'Unions' },
  speed: 4,
  run(ops, { docs }) {
    const n = docs.length;
    const sets = docs.map((d) => new Set(shingles(d.text, 3)));
    ops.list('docs', docs.map((d) => `${d.id} ${d.outlet}${d.credit ? ` (${d.credit})` : ''}`), { label: 'Documents', lines: 5 });
    const uf = new UnionFind(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        ops.tick('pair');
        const s = jaccard(sets[i], sets[j]);
        const credit = docs[i].credit !== '' && docs[i].credit === docs[j].credit && docs[i].title === docs[j].title;
        if (s >= THRESHOLD || credit) {
          if (uf.union(i, j)) ops.tick('union');
          ops.link('docs', i, 'docs', j, S.hit);
          ops.mark('docs', i, S.focus); ops.mark('docs', j, S.focus);
          ops.note(`${docs[i].outlet} and ${docs[j].outlet}: ${credit && s < THRESHOLD ? 'same credit and headline' : `Jaccard ${s.toFixed(2)}`}`);
          ops.clear('docs');
        }
      }
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
