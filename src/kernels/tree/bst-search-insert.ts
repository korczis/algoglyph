import type { TreeKernel } from '../../engines/tree/trace';
import { insert, insertAll, searchAll } from './_bst';

// Each insertion compares its way down from the root and hangs the key where the search fell
// off the tree: the shape is decided entirely by the order the keys arrive in.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'bst',
  run(t) {
    insertAll(t, (h, k) => insert(t, h, k));
    searchAll(t);
  },
};
