import type { TreeKernel } from '../../engines/tree/trace';
import { insert, search } from './_multiway';

// Nodes hold one, two or three keys. Insertion splits every 4-node it meets on the way down,
// passing the middle key to the parent, so the tree only grows at the root and every leaf stays
// at the same depth. It is the B-tree of order four.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'multiway',
  run(t) {
    for (const k of t.w.keys) {
      t.begin('insert', `insert ${k}`);
      insert(t, k, 2, false);
    }
    for (const k of t.w.searches) {
      t.begin('search', `search ${k}`);
      search(t, k, false);
    }
  },
};
