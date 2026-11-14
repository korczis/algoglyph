// Independent references for the graph wing's flow, matching and spanning-tree claims (wave 7a):
// each is a different algorithm from the plate's kernel, written over the Graph's edge lists
// alone, so a claim's literal or bound computed here does not re-run the plate's own code.
import type { Graph } from '../../src/engines/graph/graph';

interface Residual { to: number[]; cap: number[]; cost: number[]; head: number[][] }

/** A residual network: arc 2e is edge e forward, arc 2e + 1 its reverse with no room. */
function residual(g: Graph): Residual {
  const r: Residual = { to: [], cap: [], cost: [], head: Array.from({ length: g.n }, () => []) };
  for (let e = 0; e < g.m; e++) {
    r.head[g.eu[e]].push(r.to.length); r.to.push(g.ev[e]); r.cap.push(g.cap[e]); r.cost.push(g.cost[e]);
    r.head[g.ev[e]].push(r.to.length); r.to.push(g.eu[e]); r.cap.push(0); r.cost.push(-g.cost[e]);
  }
  return r;
}

/** The maximum s–t flow by Dinic's algorithm: BFS levels, then blocking flows by DFS with a
 * current-arc pointer per vertex. Neither the depth-first nor the breadth-first augmenting loop
 * of the plates, nor push-relabel. */
export function dinic(g: Graph, s: number, t: number): number {
  const r = residual(g);
  let flow = 0;
  for (;;) {
    const level = new Array<number>(g.n).fill(-1);
    level[s] = 0;
    const q = [s];
    for (let i = 0; i < q.length; i++) {
      for (const a of r.head[q[i]]) if (r.cap[a] > 0 && level[r.to[a]] < 0) { level[r.to[a]] = level[q[i]] + 1; q.push(r.to[a]); }
    }
    if (level[t] < 0) return flow;
    const it = new Array<number>(g.n).fill(0);
    const push = (v: number, limit: number): number => {
      if (v === t) return limit;
      for (; it[v] < r.head[v].length; it[v]++) {
        const a = r.head[v][it[v]];
        const w = r.to[a];
        if (r.cap[a] <= 0 || level[w] !== level[v] + 1) continue;
        const d = push(w, Math.min(limit, r.cap[a]));
        if (d > 0) { r.cap[a] -= d; r.cap[a ^ 1] += d; return d; }
      }
      return 0;
    };
    for (let d = push(s, Infinity); d > 0; d = push(s, Infinity)) flow += d;
  }
}

/** A minimum-cost maximum flow by successive shortest paths: Bellman–Ford over the residual
 * costs from s, augment the cheapest s–t path by its bottleneck, until t is cut off. Not the
 * plate's cycle cancelling. */
export function successiveShortestPaths(g: Graph, s: number, t: number): { value: number; cost: number } {
  const r = residual(g);
  let value = 0; let cost = 0;
  for (;;) {
    const dist = new Array<number>(g.n).fill(Infinity);
    const via = new Array<number>(g.n).fill(-1);
    dist[s] = 0;
    for (let round = 0; round < g.n; round++) {
      let changed = false;
      for (let v = 0; v < g.n; v++) {
        if (dist[v] === Infinity) continue;
        for (const a of r.head[v]) {
          if (r.cap[a] > 0 && dist[v] + r.cost[a] < dist[r.to[a]]) { dist[r.to[a]] = dist[v] + r.cost[a]; via[r.to[a]] = a; changed = true; }
        }
      }
      if (!changed) break;
    }
    if (dist[t] === Infinity) return { value, cost };
    let d = Infinity;
    for (let v = t; v !== s; v = r.to[via[v] ^ 1]) d = Math.min(d, r.cap[via[v]]);
    for (let v = t; v !== s; v = r.to[via[v] ^ 1]) { r.cap[via[v]] -= d; r.cap[via[v] ^ 1] += d; }
    value += d; cost += d * dist[t];
  }
}

/** The size of a maximum matching of a bipartite graph (sides by g.truth, 0 on the left) by
 * Hopcroft–Karp: BFS layers from every free left vertex, then vertex-disjoint shortest
 * augmenting paths. Not the plate's one-root-at-a-time depth-first search. */
export function hopcroftKarp(g: Graph): number {
  const adj: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    const [l, r] = g.truth[g.eu[e]] === 0 ? [g.eu[e], g.ev[e]] : [g.ev[e], g.eu[e]];
    adj[l].push(r);
  }
  const left = Array.from({ length: g.n }, (_, v) => v).filter((v) => g.truth[v] === 0);
  const mate = new Array<number>(g.n).fill(-1);
  let size = 0;
  for (;;) {
    const dist = new Array<number>(g.n).fill(Infinity);
    const q: number[] = [];
    for (const l of left) if (mate[l] < 0) { dist[l] = 0; q.push(l); }
    let reach = Infinity;
    for (let i = 0; i < q.length; i++) {
      const l = q[i];
      if (dist[l] >= reach) continue;
      for (const r of adj[l]) {
        if (mate[r] < 0) reach = Math.min(reach, dist[l] + 1);
        else if (dist[mate[r]] === Infinity) { dist[mate[r]] = dist[l] + 1; q.push(mate[r]); }
      }
    }
    if (reach === Infinity) return size;
    const augment = (l: number): boolean => {
      for (const r of adj[l]) {
        const m = mate[r];
        if ((m < 0 && dist[l] + 1 === reach) || (m >= 0 && dist[m] === dist[l] + 1 && augment(m))) {
          mate[l] = r; mate[r] = l;
          return true;
        }
      }
      dist[l] = Infinity;
      return false;
    };
    for (const l of left) if (mate[l] < 0 && augment(l)) size++;
  }
}

/** The weight and edge count of a minimum spanning forest by dense Prim: an n × n matrix of the
 * lightest edge between each pair, the cheapest outside vertex taken by a linear scan, a new
 * tree started wherever the last one cannot grow. No heap, no union-find, no edge sort. */
export function densePrim(g: Graph): { weight: number; edges: number; trees: number } {
  const W = Array.from({ length: g.n }, () => new Array<number>(g.n).fill(Infinity));
  for (let e = 0; e < g.m; e++) {
    const a = g.eu[e]; const b = g.ev[e];
    if (a !== b) W[a][b] = W[b][a] = Math.min(W[a][b], g.w[e]);
  }
  const inTree = new Array<boolean>(g.n).fill(false);
  const key = new Array<number>(g.n).fill(Infinity);
  let weight = 0; let edges = 0; let trees = 0;
  for (let k = 0; k < g.n; k++) {
    let u = -1;
    for (let v = 0; v < g.n; v++) if (!inTree[v] && (u < 0 || key[v] < key[u])) u = v;
    if (key[u] === Infinity) trees++;
    else { weight += key[u]; edges++; }
    inTree[u] = true;
    for (let v = 0; v < g.n; v++) if (!inTree[v] && W[u][v] < key[v]) key[v] = W[u][v];
  }
  return { weight, edges, trees };
}
