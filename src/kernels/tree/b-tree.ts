import type { TreeKernel } from '../../engines/tree/trace';
import { insert, search } from './_multiway';

// Every node is a page of between t - 1 and 2t - 1 keys (the root may hold fewer), searched by
// binary search. A full page met on the way down is split around its median, so all leaves
// stay at one depth and a search reads about log_t n pages.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'multiway',
  params: [{ kind: 'range', key: 'degree', label: 'Minimum degree t', min: 2, max: 8, step: 1, value: 3, rebuild: true }],
  run(t) {
    const deg = t.w.opts.degree ?? 3;
    for (const k of t.w.keys) {
      t.begin('insert', `insert ${k}`);
      insert(t, k, deg, true);
    }
    for (const k of t.w.searches) {
      t.begin('search', `search ${k}`);
      search(t, k, true);
    }
  },
};
