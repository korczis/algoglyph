import { other } from '../../engines/graph/graph';
import { E, V, type GraphKernel, type GraphOps } from '../../engines/graph/trace';

export interface HamiltonResult { path: number[] | null; edges: number[] }

/**
 * Whether every vertex off the path can still be reached from the path's end through vertices
 * off the path: if not, no extension of this path covers the graph. Each edge looked at counts.
 */
function stillConnected(ops: GraphOps, on: boolean[], end: number, left: number): boolean {
  const g = ops.g;
  if (!left) return true;
  const seen = new Set<number>();
  const stack = [end];
  while (stack.length) {
    const u = stack.pop() as number;
    for (const e of g.out[u]) {
      ops.scan(e);
      const v = other(g, e, u);
      if (on[v] || seen.has(v)) continue;
      seen.add(v);
      stack.push(v);
    }
  }
  return seen.size === left;
}

// Backtracking: extend the path by a neighbour not on it, undo when stuck, from each start in
// turn until a path covers every vertex or every possibility is exhausted. Two prunings cut
// only branches that cannot succeed, so the search stays exhaustive: a path whose end no longer
// reaches all the remaining vertices is abandoned, and when a vertex of degree one exists (it
// must be an end) only such vertices are tried as starts; three or more mean there is no path.
export const kernel: GraphKernel<HamiltonResult> = {
  goal: 'hamilton',
  mayStop: true,
  cap: 250_000,
  inputs: ['grid', 'small-world', 'geometric', 'random'],
  n: { min: 4, max: 36, value: 16 },
  names: { frontier: 'On the path', tree: 'Path edges', marked: 'Hamilton path' },
  readouts: ['scans', 'frontier', 'discovers', 'rounds'],
  chart: { title: 'Length of the path being tried', y: 'vertices', series: ['frontier'] },
  speed: 2,
  *steps(ops) {
    const g = ops.g;
    const on = new Array<boolean>(g.n).fill(false);
    const deg = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { ops.scan(e); deg[g.eu[e]]++; deg[g.ev[e]]++; }
    const leaves = deg.map((d, v) => (d === 1 ? v : -1)).filter((v) => v >= 0);
    if (g.n > 1 && (leaves.length > 2 || deg.some((d) => d === 0))) return { path: null, edges: [] };
    const starts = leaves.length ? leaves : Array.from({ length: g.n }, (_, i) => i);
    const free = (v: number) => g.out[v].filter((e) => !on[other(g, e, v)]).length;
    const choices = (v: number) => g.out[v].filter((e) => !on[other(g, e, v)])
      .sort((a, b) => free(other(g, a, v)) - free(other(g, b, v)) || a - b);
    for (const start of starts) {
      const path = [start]; const edges: number[] = [];
      on[start] = true;
      ops.discover(start);
      const options: number[][] = [stillConnected(ops, on, start, g.n - 1) ? choices(start) : []];
      while (path.length) {
        yield;
        if (path.length === g.n) {
          for (const e of edges) ops.edge(e, E.mark);
          return { path, edges };
        }
        const e = options[options.length - 1].shift();
        if (e === undefined) {
          const v = path.pop() as number;
          options.pop();
          on[v] = false;
          ops.vertex(v, V.unseen);
          if (edges.pop() !== undefined) ops.parent(v, -1);
          continue;
        }
        const u = path[path.length - 1];
        ops.scan(e);
        const v = other(g, e, u);
        if (on[v]) continue;
        on[v] = true;
        path.push(v); edges.push(e);
        ops.parent(v, e);
        ops.discover(v);
        options.push(stillConnected(ops, on, v, g.n - path.length) ? choices(v) : []);
      }
      ops.round();
      yield;
    }
    return { path: null, edges: [] };
  },
  report(r) {
    return [{ label: 'Hamilton path', value: r.path ? `found, from vertex ${r.path[0]} to ${r.path[r.path.length - 1]}` : 'none exists' }];
  },
};
