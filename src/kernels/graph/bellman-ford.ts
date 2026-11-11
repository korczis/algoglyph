import { E, V, type GraphKernel } from '../../engines/graph/trace';

export interface BellmanResult { dist: number[]; parentEdge: number[]; cycle: number[] | null; cycleEdges: number[] }

// Rounds of relaxing every edge, at most V - 1 of them (a shortest path has at most V - 1
// edges); the rounds stop early once one changes nothing. If the V-th round still improves a
// distance, a negative cycle is reachable: walking V parent edges back from the improved vertex
// lands on it.
export const kernel: GraphKernel<BellmanResult> = {
  goal: 'sssp',
  inputs: ['signed', 'negative-cycle', 'signed-dag', 'geometric', 'dag', 'digraph'],
  n: { min: 4, max: 200, value: 60 },
  pick: 's',
  endpoints: 's',
  view: { colour: 'value' },
  names: { done: 'Reached', tree: 'Shortest-path tree', value: 'Distance', marked: 'On the negative cycle' },
  readouts: ['relaxations', 'rounds', 'done', 'change'],
  chart: { title: 'Distance improvements per round', x: 'rounds', y: 'total decrease', series: ['change'] },
  speed: 6,
  *steps(ops, { s }) {
    const g = ops.g;
    const dist = new Array<number>(g.n).fill(Infinity);
    const parentEdge = new Array<number>(g.n).fill(-1);
    dist[s] = 0;
    ops.value(s, 0);
    ops.settle(s);
    yield;
    const arcs: [number, number, number][] = [];
    for (let e = 0; e < g.m; e++) {
      arcs.push([e, g.eu[e], g.ev[e]]);
      if (!g.directed) arcs.push([e, g.ev[e], g.eu[e]]);
    }
    let last = -1;
    for (let round = 0; round < g.n; round++) {
      let changed = -1;
      for (const [e, u, v] of arcs) {
        if (!Number.isFinite(dist[u])) continue;
        ops.scan(e);
        const d = dist[u] + g.w[e];
        const improved = d < dist[v];
        ops.relax(e, improved);
        if (!improved) continue;
        if (!Number.isFinite(dist[v])) ops.settle(v);
        yield;
        dist[v] = d; parentEdge[v] = e; changed = v;
        ops.value(v, d);
        ops.parent(v, e);
      }
      ops.round();
      yield;
      if (changed < 0) break;
      if (round === g.n - 1) last = changed;
    }
    if (last < 0) return { dist, parentEdge, cycle: null, cycleEdges: [] };
    let v = last;
    for (let i = 0; i < g.n; i++) v = g.eu[parentEdge[v]] === v && !g.directed ? g.ev[parentEdge[v]] : g.eu[parentEdge[v]];
    // collect the cycle backwards along parent edges, then turn it to run forwards from v
    const back: number[] = []; const cycleEdges: number[] = [];
    for (let u = v; ;) {
      const e = parentEdge[u];
      cycleEdges.push(e);
      u = g.directed ? g.eu[e] : (g.eu[e] === u ? g.ev[e] : g.eu[e]);
      if (u === v) break;
      back.push(u);
    }
    const cycle = [v, ...back.reverse()];
    cycleEdges.reverse();
    for (const e of cycleEdges) ops.edge(e, E.mark);
    for (const u of cycle) ops.vertex(u, V.mark);
    return { dist, parentEdge, cycle, cycleEdges };
  },
  report(r) {
    if (r.cycle) return [{ label: 'Negative cycle', value: `${r.cycle.length} vertices: ${r.cycle.join(' → ')}` }];
    const fin = r.dist.filter(Number.isFinite);
    return [{ label: 'Result', value: `no negative cycle; ${fin.length} reached, farthest at ${Math.max(...fin)}` }];
  },
};
