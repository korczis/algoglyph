import { other } from '../../engines/graph/graph';
import { E, type GraphKernel } from '../../engines/graph/trace';

export interface EulerResult { tour: number[]; edges: number[] }

// Hierholzer's algorithm with a stack: walk unused edges until stuck (which can only happen back
// at the start of the current cycle), then back up, emitting vertices; each back-up splices the
// next cycle into the tour. Every edge is walked once and emitted once.
export const kernel: GraphKernel<EulerResult> = {
  goal: 'euler',
  inputs: ['eulerian'],
  n: { min: 6, max: 200, value: 50 },
  pick: 's',
  endpoints: 's',
  names: { frontier: 'On the stack', done: 'Exhausted', tree: 'Walked, not yet in the tour', marked: 'In the tour' },
  readouts: ['scans', 'tree', 'frontier', 'done'],
  chart: { title: 'Edges walked and edges in the tour', y: 'edges', series: ['tree'] },
  speed: 2,
  *steps(ops, { s }) {
    const g = ops.g;
    const used = new Array<boolean>(g.m).fill(false);
    const next = new Array<number>(g.n).fill(0);
    const stack = [s]; const via = [-1];
    const tour: number[] = []; const edges: number[] = [];
    ops.discover(s);
    while (stack.length) {
      const v = stack[stack.length - 1];
      let e = -1;
      while (next[v] < g.out[v].length) {
        const f = g.out[v][next[v]++];
        ops.scan(f);
        if (!used[f]) { e = f; break; }
      }
      if (e >= 0) {
        used[e] = true;
        ops.edge(e, E.tree);
        const w = other(g, e, v);
        stack.push(w); via.push(e);
        ops.discover(w);
      } else {
        stack.pop();
        const f = via.pop() as number;
        tour.push(v);
        if (f >= 0) { edges.push(f); ops.edge(f, E.mark); }
        if (!stack.includes(v)) ops.settle(v);
        yield;
      }
    }
    tour.reverse(); edges.reverse();
    return { tour, edges };
  },
  report(r, g) {
    return [{ label: 'Tour', value: `${r.edges.length} of ${g.m} edges, ${r.tour[0] === r.tour[r.tour.length - 1] ? 'closed' : 'open'}` }];
  },
};
