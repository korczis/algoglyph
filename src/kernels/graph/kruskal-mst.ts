import { E, type GraphKernel } from '../../engines/graph/trace';
import { join, MST_VIEW, type MstResult } from './_mst';
import { UnionFind } from './_uf';

// Edges in increasing weight (ties by index); an edge joining two fragments is taken, an edge
// inside one would close a cycle and is dropped. Union-find answers which fragment is which.
export const kernel: GraphKernel<MstResult> = {
  goal: 'mst',
  inputs: ['geometric', 'grid', 'random', 'small-world'],
  n: { min: 4, max: 400, value: 120 },
  ...MST_VIEW,
  *steps(ops) {
    const g = ops.g;
    const uf = new UnionFind(g.n);
    for (let v = 0; v < g.n; v++) ops.group(v, v);
    const order = Array.from({ length: g.m }, (_, e) => e).sort((a, b) => g.w[a] - g.w[b] || a - b);
    const tree: number[] = [];
    for (const e of order) {
      ops.scan(e);
      yield;
      if (join(ops, uf, e)) tree.push(e);
      else ops.edge(e, E.drop);
      if (tree.length === g.n - 1) break;
    }
    return { tree };
  },
};
