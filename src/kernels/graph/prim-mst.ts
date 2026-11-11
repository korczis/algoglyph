import { other } from '../../engines/graph/graph';
import { E, type GraphKernel } from '../../engines/graph/trace';
import { IndexHeap } from './_heap';
import { MST_VIEW, type MstResult } from './_mst';

// Eager Prim: a priority queue holds each outside vertex at the weight of its cheapest edge into
// the tree; the cheapest comes in, and its edges may lower its neighbours' keys. A disconnected
// graph is spanned fragment by fragment.
export const kernel: GraphKernel<MstResult> = {
  goal: 'mst',
  inputs: ['geometric', 'grid', 'random', 'small-world'],
  n: { min: 4, max: 400, value: 120 },
  ...MST_VIEW,
  view: { colour: 'state' },
  names: { frontier: 'In the queue', done: 'In the tree', tree: 'Tree edges' },
  readouts: ['scans', 'done', 'frontier', 'tree', 'treeWeight'],
  chart: { title: 'Tree and queue', y: 'vertices', series: ['done', 'frontier'] },
  pick: 's',
  endpoints: 's',
  speed: 3,
  *steps(ops, { s }) {
    const g = ops.g;
    const inTree = new Array<boolean>(g.n).fill(false);
    const best = new Array<number>(g.n).fill(-1);
    const tree: number[] = [];
    const roots = [s, ...Array.from({ length: g.n }, (_, i) => i).filter((i) => i !== s)];
    for (const root of roots) {
      if (inTree[root]) continue;
      const pq = new IndexHeap(g.n);
      pq.push(root, 0);
      ops.discover(root);
      while (pq.size) {
        const u = pq.pop();
        inTree[u] = true;
        ops.settle(u);
        yield;
        if (best[u] >= 0) { tree.push(best[u]); ops.edge(best[u], E.tree); }
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = other(g, e, u);
          if (inTree[v]) continue;
          const improved = g.w[e] < pq.key[v];
          ops.relax(e, improved);
          if (!improved) continue;
          if (best[v] >= 0) ops.edge(best[v], E.seen);
          best[v] = e;
          ops.edge(e, E.back);
          if (!pq.has(v)) ops.discover(v);
          pq.push(v, g.w[e]);
          ops.value(v, g.w[e]);
        }
      }
      ops.round();
      yield;
    }
    return { tree };
  },
};
