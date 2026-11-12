import type { TreeKernel } from '../../engines/tree/trace';
import { forest } from './_union-find';

// Weighted quick-union, and after each find a second pass points every site on the path at the
// root. The trees become nearly flat: a sequence of m operations costs O(m α(n)) array accesses.
export const kernel: TreeKernel = {
  input: 'pairs',
  structure: 'union-find',
  view: 'parent',
  run(t) { forest(t, { weighted: true, compress: true }); },
};
