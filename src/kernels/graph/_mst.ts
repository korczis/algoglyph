// What the spanning-tree kernels share: the result type and the union of two fragments,
// recorded as the tree edge plus a recolouring of the smaller fragment.
import { E, type GraphKernel, type GraphOps } from '../../engines/graph/trace';
import type { UnionFind } from './_uf';

export interface MstResult { tree: number[] }

export function join(ops: GraphOps, uf: UnionFind, e: number): boolean {
  const g = ops.g;
  const r = uf.union(g.eu[e], g.ev[e]);
  if (!r) return false;
  ops.edge(e, E.tree);
  for (const v of r[1]) ops.group(v, r[0]);
  return true;
}

export const MST_VIEW: Pick<GraphKernel, 'view' | 'names' | 'readouts' | 'chart' | 'report'> = {
  view: { colour: 'group' },
  names: { tree: 'Tree edges', groups: 'Fragments' },
  readouts: ['scans', 'tree', 'treeWeight', 'groups'],
  chart: { title: 'Fragments merging', y: 'count', series: ['groups', 'tree'] },
  report(r, g) {
    const { tree } = r as MstResult;
    return [{ label: 'Spanning forest', value: `${tree.length} edges, weight ${tree.reduce((s, e) => s + g.w[e], 0)}` }];
  },
};
