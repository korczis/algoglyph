import type { GraphKernel } from '../../engines/graph/trace';
import { join, MST_VIEW, type MstResult } from './_mst';
import { UnionFind } from './_uf';

// Rounds: every fragment finds its cheapest edge to another fragment (ties broken by edge index,
// so the choices never form a cycle), and all of them are added at once. Each round at least
// halves the number of fragments that still have an edge out.
export const kernel: GraphKernel<MstResult> = {
  goal: 'mst',
  inputs: ['geometric', 'grid', 'random', 'small-world'],
  n: { min: 4, max: 400, value: 120 },
  ...MST_VIEW,
  readouts: ['scans', 'tree', 'treeWeight', 'groups', 'rounds'],
  chart: { title: 'Fragments, round by round', x: 'rounds', y: 'count', series: ['groups', 'tree'] },
  *steps(ops) {
    const g = ops.g;
    const uf = new UnionFind(g.n);
    for (let v = 0; v < g.n; v++) ops.group(v, v);
    const tree: number[] = [];
    const lighter = (a: number, b: number) => b < 0 || g.w[a] < g.w[b] || (g.w[a] === g.w[b] && a < b);
    for (;;) {
      const cheapest = new Map<number, number>();
      for (let e = 0; e < g.m; e++) {
        ops.scan(e);
        const a = uf.find(g.eu[e]); const b = uf.find(g.ev[e]);
        if (a === b) continue;
        if (lighter(e, cheapest.get(a) ?? -1)) cheapest.set(a, e);
        if (lighter(e, cheapest.get(b) ?? -1)) cheapest.set(b, e);
      }
      if (!cheapest.size) break;
      for (const e of new Set(cheapest.values())) if (join(ops, uf, e)) tree.push(e);
      ops.round();
      yield;
    }
    return { tree };
  },
};
