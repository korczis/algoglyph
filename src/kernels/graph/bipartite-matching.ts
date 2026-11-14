import type { Graph } from '../../engines/graph/graph';
import { E, V, type GraphKernel } from '../../engines/graph/trace';

export interface MatchingResult { mate: number[] }

// Augmenting paths on a bipartite graph (Kuhn's algorithm): from each free left vertex, search
// depth-first along alternating paths (any edge to the right, then the matched edge back) for a
// free right vertex; flipping the path grows the matching by one. It is Ford-Fulkerson on the
// unit-capacity network source -> left -> right -> sink.
export const kernel: GraphKernel<MatchingResult> = {
  goal: 'matching',
  inputs: ['bipartite'],
  n: { min: 4, max: 160, value: 40 },
  names: { frontier: 'On the alternating path', done: 'Matched', tree: 'Matched edges' },
  readouts: ['tree', 'scans', 'rounds', 'done'],
  chart: { title: 'Size of the matching', x: 'rounds', y: 'edges', series: ['tree'] },
  *steps(ops) {
    const g = ops.g;
    const mate = new Array<number>(g.n).fill(-1);
    const mateEdge = new Array<number>(g.n).fill(-1);
    const left = Array.from({ length: g.n }, (_, i) => i).filter((v) => g.truth[v] === 0);
    for (const root of left) {
      const seen = new Set<number>();
      // iterative DFS over (left vertex, next edge); `via[r]` is the edge that reached right vertex r
      const stack: [number, number][] = [[root, 0]];
      const via = new Map<number, number>();
      const path: number[] = [];
      ops.discover(root);
      let found = -1;
      while (stack.length && found < 0) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] >= g.out[u].length) { stack.pop(); if (mate[u] < 0 || u === root) ops.vertex(u, V.unseen); else ops.vertex(u, V.done); continue; }
        const e = g.out[u][top[1]++];
        ops.scan(e);
        const r = g.eu[e] === u ? g.ev[e] : g.eu[e];
        if (seen.has(r)) continue;
        seen.add(r);
        via.set(r, e);
        if (mate[r] < 0) { found = r; break; }
        ops.discover(mate[r]);
        stack.push([mate[r], 0]);
      }
      if (found >= 0) {
        // flip the alternating path from the root to `found`
        for (const [u] of stack) path.push(u);
        let r = found;
        for (let i = path.length - 1; i >= 0; i--) {
          const u = path[i];
          const e = via.get(r) as number;
          const prev = mate[u];
          const prevEdge = mateEdge[u];
          if (prevEdge >= 0) ops.edge(prevEdge, E.seen);
          mate[u] = r; mate[r] = u; mateEdge[u] = e; mateEdge[r] = e;
          ops.edge(e, E.tree);
          ops.settle(u); ops.settle(r);
          yield;
          r = prev;
        }
      } else for (const v of seen) if (mate[v] >= 0) ops.vertex(mate[v], V.done);
      ops.round();
      yield;
    }
    return { mate };
  },
  report(r, g) {
    const size = r.mate.filter((m, v) => m >= 0 && g.truth[v] === 0).length;
    const cover = konigCover(g, r.mate);
    let touched = 0;
    for (let e = 0; e < g.m; e++) if (cover[g.eu[e]] || cover[g.ev[e]]) touched++;
    return [
      { label: 'Maximum matching', value: `${size} pairs` },
      { label: 'König vertex cover', value: `${cover.filter(Boolean).length} vertices (${touched} of ${g.m} edges covered)` },
    ];
  },
};

/**
 * König's vertex cover, built from a maximum matching: Z is every vertex reachable from a free
 * left vertex by an alternating path (an unmatched edge to the right, the matched edge back), and
 * the cover is the left vertices outside Z with the right vertices in Z. It touches every edge
 * and has one vertex per matched pair, the certificate that no larger matching exists.
 */
export function konigCover(g: Graph, mate: number[]): boolean[] {
  const z = new Array<boolean>(g.n).fill(false);
  const queue: number[] = [];
  for (let v = 0; v < g.n; v++) if (g.truth[v] === 0 && mate[v] < 0) { z[v] = true; queue.push(v); }
  while (queue.length) {
    const l = queue.shift() as number;
    for (const e of g.out[l]) {
      const r = g.eu[e] === l ? g.ev[e] : g.eu[e];
      if (z[r] || mate[l] === r) continue;
      z[r] = true;
      const back = mate[r];
      if (back >= 0 && !z[back]) { z[back] = true; queue.push(back); }
    }
  }
  return Array.from({ length: g.n }, (_, v) => (g.truth[v] === 0 ? !z[v] : z[v]));
}
