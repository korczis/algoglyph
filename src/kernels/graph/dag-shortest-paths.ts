import type { GraphKernel } from '../../engines/graph/trace';

export interface DagSpResult { dist: number[]; parentEdge: number[]; order: number[] }

// A topological order first (Kahn: repeatedly take a vertex with no unprocessed in-edges),
// then each vertex's out-edges are relaxed once, in that order. Every predecessor is final
// before a vertex is reached, so one pass suffices, and negative weights do no harm.
export const kernel: GraphKernel<DagSpResult> = {
  goal: 'sssp',
  inputs: ['signed-dag', 'dag'],
  n: { min: 4, max: 400, value: 80 },
  pick: 's',
  endpoints: 's',
  view: { colour: 'value' },
  names: { frontier: 'Ordered, not relaxed', done: 'Relaxed', tree: 'Shortest-path tree', value: 'Distance' },
  readouts: ['scans', 'relaxations', 'done', 'rounds'],
  chart: { title: 'Ordering, then one relaxation pass', y: 'vertices', series: ['frontier', 'done'] },
  speed: 3,
  run(ops, { s }) {
    const g = ops.g;
    const indeg = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { ops.scan(e); indeg[g.ev[e]]++; }
    const order: number[] = [];
    for (let v = 0; v < g.n; v++) if (!indeg[v]) { order.push(v); ops.discover(v); }
    for (let h = 0; h < order.length; h++) {
      for (const e of g.out[order[h]]) {
        ops.scan(e);
        if (--indeg[g.ev[e]] === 0) { order.push(g.ev[e]); ops.discover(g.ev[e]); }
      }
    }
    ops.round();
    const dist = new Array<number>(g.n).fill(Infinity);
    const parentEdge = new Array<number>(g.n).fill(-1);
    dist[s] = 0;
    ops.value(s, 0);
    for (const u of order) {
      ops.settle(u);
      if (!Number.isFinite(dist[u])) continue;
      for (const e of g.out[u]) {
        ops.scan(e);
        const v = g.ev[e];
        const d = dist[u] + g.w[e];
        const improved = d < dist[v];
        ops.relax(e, improved);
        if (!improved) continue;
        dist[v] = d; parentEdge[v] = e;
        ops.value(v, d);
        ops.parent(v, e);
      }
    }
    ops.round();
    return { dist, parentEdge, order };
  },
  report(r) {
    const fin = r.dist.filter(Number.isFinite);
    return [{ label: 'Reached', value: `${fin.length} vertices, distances ${Math.min(...fin)} to ${Math.max(...fin)}` }];
  },
};
