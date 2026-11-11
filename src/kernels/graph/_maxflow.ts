// Augmenting-path maximum flow, with the path search chosen by the caller: depth-first for
// Ford-Fulkerson, breadth-first (shortest paths) for Edmonds-Karp. Capacities are integers, so
// every augmentation adds at least one unit and the loop ends.
import { V, type GraphKernel, type GraphOps } from '../../engines/graph/trace';
import { arcs, augment, minCut, value, type Arc, type FlowResult } from './_flow';

export function augmentingPaths(ops: GraphOps, s: number, t: number, order: 'dfs' | 'bfs', f?: number[]): FlowResult {
  const g = ops.g;
  f ??= new Array<number>(g.m).fill(0);
  for (;;) {
    const via = new Array<Arc | null>(g.n).fill(null);
    const seen = new Array<boolean>(g.n).fill(false);
    seen[s] = true;
    const work = [s];
    const touched = [s];
    ops.discover(s);
    while (work.length && !seen[t]) {
      const u = (order === 'bfs' ? work.shift() : work.pop()) as number;
      ops.settle(u);
      for (const a of arcs(ops, f, u)) {
        ops.scan(a.e);
        if (seen[a.to]) continue;
        seen[a.to] = true;
        via[a.to] = a;
        touched.push(a.to);
        ops.discover(a.to);
        work.push(a.to);
      }
    }
    for (const v of touched) ops.vertex(v, V.unseen);
    if (!seen[t]) break;
    const path: Arc[] = [];
    let delta = Infinity;
    for (let v = t; v !== s;) {
      const a = via[v] as Arc;
      path.push(a);
      delta = Math.min(delta, a.room);
      v = a.fwd ? g.eu[a.e] : g.ev[a.e];
    }
    augment(ops, f, path.reverse(), delta);
    ops.round();
  }
  const side = minCut(ops, f, s);
  for (let v = 0; v < g.n; v++) if (side[v]) ops.vertex(v, V.done);
  return { flow: f, value: value(ops, f, s), side };
}

export const FLOW_VIEW: Pick<GraphKernel, 'inputs' | 'n' | 'view' | 'names' | 'endpoints' | 'report'> = {
  inputs: ['flow'],
  n: { min: 4, max: 150, value: 40 },
  view: { flow: true },
  endpoints: 'st',
  names: { frontier: 'Searched', done: 'Source side of the cut' },
  report(r) {
    const { value: v, flow } = r as FlowResult;
    return [{ label: 'Maximum flow', value: `${v} (${flow.filter((x) => x > 0).length} edges carry flow)` }];
  },
};
