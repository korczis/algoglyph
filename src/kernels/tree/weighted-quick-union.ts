import type { TreeKernel } from '../../engines/tree/trace';
import { forest, unionFindParams } from './_union-find';

// Keep each tree's size and always hang the smaller tree under the larger root. A site's depth
// grows only when its tree at least doubles, so no find climbs more than lg n links.
export const kernel: TreeKernel = {
  input: 'pairs',
  structure: 'union-find',
  view: 'parent',
  params: unionFindParams(),
  run(t) { forest(t, { weighted: true }); },
};
