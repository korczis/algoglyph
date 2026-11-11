// Power iteration for PageRank with a teleport vector: each round every vertex keeps 1 - d of
// teleport mass, and passes d of its score evenly along its out-edges; a vertex with no
// out-edges passes it along the teleport vector instead. Undirected edges count both ways.
import type { GraphOps } from '../../engines/graph/trace';

export interface RankResult { rank: number[]; rounds: number }

export function pagerank(ops: GraphOps, d: number, teleport: number[], tol = 1e-12, maxRounds = 1000): RankResult {
  const g = ops.g;
  const n = g.n;
  const outdeg = new Array<number>(n).fill(0);
  for (let e = 0; e < g.m; e++) { outdeg[g.eu[e]]++; if (!g.directed) outdeg[g.ev[e]]++; }
  let r = teleport.slice();
  for (let v = 0; v < n; v++) ops.value(v, r[v]);
  let rounds = 0;
  while (rounds < maxRounds) {
    let dangling = 0;
    for (let v = 0; v < n; v++) if (!outdeg[v]) dangling += r[v];
    const next = teleport.map((t) => (1 - d) * t + d * dangling * t);
    for (let e = 0; e < g.m; e++) {
      ops.scan(e);
      const u = g.eu[e]; const v = g.ev[e];
      next[v] += (d * r[u]) / outdeg[u];
      if (!g.directed) next[u] += (d * r[v]) / outdeg[v];
    }
    let moved = 0;
    for (let v = 0; v < n; v++) {
      moved += Math.abs(next[v] - r[v]);
      if (next[v] !== r[v]) ops.value(v, next[v]);
    }
    r = next;
    rounds++;
    ops.round();
    if (moved < tol) break;
  }
  return { rank: r, rounds };
}
