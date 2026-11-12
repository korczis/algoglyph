import type { TreeKernel } from '../../engines/tree/trace';
import { forest, unionFindParams } from './_union-find';

// a[i] is site i's parent; a find climbs to the root, and a union hangs one root under the
// other without looking at the trees' sizes, so a bad order of connections builds a path.
export const kernel: TreeKernel = {
  input: 'pairs',
  structure: 'union-find',
  view: 'parent',
  params: unionFindParams(),
  run(t) { forest(t, {}); },
};
