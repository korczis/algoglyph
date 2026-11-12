import { E, type GraphKernel } from '../../engines/graph/trace';
import { arcs, type Arc } from './_flow';
import { augmentingPaths, FLOW_VIEW } from './_maxflow';

export interface MinCostResult { flow: number[]; value: number; cost: number; cancelled: number }

// Cycle cancelling. First a maximum flow (shortest augmenting paths). Then, while the residual
// network has a cycle of negative cost (a forward arc costs +c, a backward one -c), push its
// bottleneck around it: the flow value stays, the cost drops. With no negative cycle left the
// flow is of minimum cost. Bellman-Ford from a virtual source at distance 0 to every vertex
// finds the cycles.
export const kernel: GraphKernel<MinCostResult> = {
  goal: 'mincostflow',
  ...FLOW_VIEW,
  n: { min: 4, max: 80, value: 30 },
  names: { frontier: 'Searched', done: 'Source side of the cut', marked: 'Negative cycle' },
  readouts: ['flow', 'rounds', 'flows', 'relaxations'],
  chart: { title: 'Flow value (it stays while the cost falls)', x: 'rounds', y: 'flow', series: ['flow'] },
  speed: 40,
  *steps(ops, { s, t }) {
    const g = ops.g;
    const { flow: f, value } = yield* augmentingPaths(ops, s, t, 'bfs');
    const costOf = (a: Arc) => (a.fwd ? g.cost[a.e] : -g.cost[a.e]);
    let cancelled = 0;
    for (;;) {
      const dist = new Array<number>(g.n).fill(0);
      const via = new Array<Arc | null>(g.n).fill(null);
      let last = -1;
      for (let round = 0; round < g.n; round++) {
        last = -1;
        for (let u = 0; u < g.n; u++) {
          for (const a of arcs(ops, f, u)) {
            const d = dist[u] + costOf(a);
            const improved = d < dist[a.to];
            ops.relax(a.e, improved);
            if (improved) { dist[a.to] = d; via[a.to] = a; last = a.to; }
          }
        }
        if (last < 0) break;
        yield;
      }
      if (last < 0) break;
      // walk back V steps to land on the cycle, then collect it
      let v = last;
      for (let i = 0; i < g.n; i++) { const a = via[v] as Arc; v = a.fwd ? g.eu[a.e] : g.ev[a.e]; }
      const cycle: Arc[] = [];
      let delta = Infinity;
      for (let u = v; ;) {
        const a = via[u] as Arc;
        cycle.push(a);
        delta = Math.min(delta, a.room);
        u = a.fwd ? g.eu[a.e] : g.ev[a.e];
        if (u === v) break;
      }
      for (const a of cycle) {
        f[a.e] += a.fwd ? delta : -delta;
        ops.flow(a.e, f[a.e]);
        ops.edge(a.e, E.mark);
      }
      for (const a of cycle) ops.edge(a.e, f[a.e] >= g.cap[a.e] ? E.cut : E.seen);
      cancelled++;
      ops.round();
      yield;
    }
    let cost = 0;
    for (let e = 0; e < g.m; e++) cost += f[e] * g.cost[e];
    return { flow: f, value, cost, cancelled };
  },
  report(r) {
    return [
      { label: 'Flow value', value: String(r.value) },
      { label: 'Minimum cost', value: `${r.cost} after cancelling ${r.cancelled} cycles` },
    ];
  },
};
