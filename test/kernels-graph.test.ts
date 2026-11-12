// Every live graph kernel of the catalogue, checked by one harness: each kernel names a goal,
// and the goal's checker compares the kernel's result with an independent reference written
// here (Floyd-Warshall, Bellman-Ford, brute force, exhaustive enumeration, linear solves) on
// every input shape the kernel accepts, at several sizes and seeds (ADR 0004 §4).
import type p5 from 'p5';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { GROUNDS, palette } from '../src/core/palette';
import type { Params, PlateContext } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine } from '../src/engines/graph';
import { DIRECTED, makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, work, type GraphKernel, type Options } from '../src/engines/graph/trace';

const modules = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'graph' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/graph/${id}.ts`];
const SEEDS = [11, 29];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Result = any;
type Run = (p?: Record<string, number | string | boolean>, o?: Partial<Options>) => Result;
type Check = (g: Graph, run: Run, k: GraphKernel) => void;

// ---------------------------------------------------------------- independent references

/** Arcs u -> v with weight (both ways for an undirected graph), from the edge list alone. */
function arcsOf(g: Graph, weight: (e: number) => number = (e) => g.w[e]): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let e = 0; e < g.m; e++) {
    out.push([g.eu[e], g.ev[e], weight(e), e]);
    if (!g.directed) out.push([g.ev[e], g.eu[e], weight(e), e]);
  }
  return out;
}

/** All-pairs by Floyd-Warshall on a dense matrix. */
function floyd(g: Graph, weight?: (e: number) => number): number[][] {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const [u, v, w] of arcsOf(g, weight)) if (w < d[u][v]) d[u][v] = w;
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d;
}

const hops = (g: Graph) => floyd(g, () => 1);

/** Single-source distances by Bellman-Ford; `negative` when a negative cycle is reachable. */
function bellman(g: Graph, s: number, weight?: (e: number) => number): { dist: number[]; negative: boolean } {
  const dist = new Array<number>(g.n).fill(Infinity);
  dist[s] = 0;
  const arcs = arcsOf(g, weight);
  for (let i = 0; i < g.n - 1; i++) for (const [u, v, w] of arcs) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
  const negative = arcs.some(([u, v, w]) => dist[u] + w < dist[v]);
  return { dist, negative };
}

/** Components by a naive union-find over the edges `keep` accepts. */
function compsOf(n: number, edges: [number, number][]): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  const f = (a: number): number => (p[a] === a ? a : (p[a] = f(p[a])));
  for (const [a, b] of edges) p[f(a)] = f(b);
  return p.map((_, i) => f(i));
}

const edgeList = (g: Graph, keep: (e: number) => boolean = () => true) =>
  Array.from({ length: g.m }, (_, e) => e).filter(keep).map((e) => [g.eu[e], g.ev[e]] as [number, number]);

const count = (labels: number[]) => new Set(labels).size;

function samePartition(a: number[], b: number[]): void {
  const n = a.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(a[i] === a[j], `pair ${i},${j}`).toBe(b[i] === b[j]);
}

/** Components left after deleting vertices `gone` and edges `cut` (vertices counted alone too). */
function componentsWithout(g: Graph, gone: Set<number>, cut = new Set<number>()): number {
  const edges = edgeList(g, (e) => !cut.has(e) && !gone.has(g.eu[e]) && !gone.has(g.ev[e]));
  const c = compsOf(g.n, edges);
  return new Set(c.filter((_, v) => !gone.has(v))).size;
}

/** Gaussian elimination with partial pivoting: solve A x = b. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || !M[r][c]) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

const identity = (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/** Maximum flow by BFS augmentation on a dense capacity matrix (parallel edges merged). */
function maxFlowRef(g: Graph, s: number, t: number): number {
  const c = Array.from({ length: g.n }, () => new Array<number>(g.n).fill(0));
  for (let e = 0; e < g.m; e++) c[g.eu[e]][g.ev[e]] += g.cap[e];
  let flow = 0;
  for (;;) {
    const prev = new Array<number>(g.n).fill(-1);
    prev[s] = s;
    const q = [s];
    for (let h = 0; h < q.length; h++) for (let v = 0; v < g.n; v++) if (prev[v] < 0 && c[q[h]][v] > 0) { prev[v] = q[h]; q.push(v); }
    if (prev[t] < 0 || s === t) return flow;
    let d = Infinity;
    for (let v = t; v !== s; v = prev[v]) d = Math.min(d, c[prev[v]][v]);
    for (let v = t; v !== s; v = prev[v]) { c[prev[v]][v] -= d; c[v][prev[v]] += d; }
    flow += d;
  }
}

/** The capacity of the cheapest s-t cut, by trying every vertex subset (small graphs). */
function minCutBrute(g: Graph, s: number, t: number): number {
  const others = Array.from({ length: g.n }, (_, i) => i).filter((v) => v !== s && v !== t);
  let best = Infinity;
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const S = new Set([s, ...others.filter((_, i) => mask & (1 << i))]);
    let cap = 0;
    for (let e = 0; e < g.m; e++) if (S.has(g.eu[e]) && !S.has(g.ev[e])) cap += g.cap[e];
    best = Math.min(best, cap);
  }
  return best;
}

/** Minimum cost of a maximum flow by successive shortest paths (Bellman-Ford on the residual). */
function minCostRef(g: Graph, s: number, t: number): { value: number; cost: number } {
  const f = new Array<number>(g.m).fill(0);
  let value = 0; let cost = 0;
  for (;;) {
    const dist = new Array<number>(g.n).fill(Infinity);
    const via: [number, boolean][] = new Array(g.n);
    dist[s] = 0;
    for (let i = 0; i < g.n; i++) {
      for (let e = 0; e < g.m; e++) {
        const u = g.eu[e]; const v = g.ev[e];
        if (f[e] < g.cap[e] && dist[u] + g.cost[e] < dist[v]) { dist[v] = dist[u] + g.cost[e]; via[v] = [e, true]; }
        if (f[e] > 0 && dist[v] - g.cost[e] < dist[u]) { dist[u] = dist[v] - g.cost[e]; via[u] = [e, false]; }
      }
    }
    if (!Number.isFinite(dist[t])) return { value, cost };
    let d = Infinity;
    for (let v = t; v !== s;) {
      const [e, fwd] = via[v];
      d = Math.min(d, fwd ? g.cap[e] - f[e] : f[e]);
      v = fwd ? g.eu[e] : g.ev[e];
    }
    for (let v = t; v !== s;) {
      const [e, fwd] = via[v];
      f[e] += fwd ? d : -d;
      cost += fwd ? d * g.cost[e] : -d * g.cost[e];
      v = fwd ? g.eu[e] : g.ev[e];
    }
    value += d;
  }
}

function checkFlow(g: Graph, flow: number[], value: number, s: number, t: number): void {
  const net = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) {
    expect(flow[e]).toBeGreaterThanOrEqual(0);
    expect(flow[e]).toBeLessThanOrEqual(g.cap[e]);
    net[g.eu[e]] += flow[e]; net[g.ev[e]] -= flow[e];
  }
  for (let v = 0; v < g.n; v++) if (v !== s && v !== t) expect(net[v], `conservation at ${v}`).toBe(0);
  expect(net[s]).toBe(value);
}

/** Newman's modularity, unit edge weights. */
function modularityRef(g: Graph, c: number[]): number {
  const deg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
  let q = 0;
  const m2 = 2 * g.m;
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (c[i] !== c[j]) continue;
    let a = 0;
    for (let e = 0; e < g.m; e++) if ((g.eu[e] === i && g.ev[e] === j) || (g.eu[e] === j && g.ev[e] === i)) a++;
    q += a - (deg[i] * deg[j]) / m2;
  }
  return q / m2;
}

/** Every simple path from s to t, by exhaustive DFS (small graphs). */
function simplePaths(g: Graph, s: number, t: number): number[] {
  const costs: number[] = [];
  const on = new Array<boolean>(g.n).fill(false);
  const arcs = arcsOf(g);
  const go = (u: number, c: number) => {
    if (u === t) { costs.push(c); return; }
    on[u] = true;
    for (const [a, b, w] of arcs) if (a === u && !on[b]) go(b, c + w);
    on[u] = false;
  };
  go(s, 0);
  return costs.sort((a, b) => a - b);
}

function adjacent(g: Graph, a: number, b: number): boolean {
  for (let e = 0; e < g.m; e++) {
    if (g.eu[e] === a && g.ev[e] === b) return true;
    if (!g.directed && g.eu[e] === b && g.ev[e] === a) return true;
  }
  return false;
}

/** Longest path ending at v (sum of vertex weights, v included), by memoised recursion. */
function longestTo(g: Graph): number[] {
  const memo = new Array<number>(g.n).fill(-1);
  const f = (v: number): number => {
    if (memo[v] >= 0) return memo[v];
    let best = 0;
    for (let e = 0; e < g.m; e++) if (g.ev[e] === v) best = Math.max(best, f(g.eu[e]));
    return (memo[v] = best + g.vw[v]);
  };
  return Array.from({ length: g.n }, (_, v) => f(v));
}

function longestFrom(g: Graph): number[] {
  const memo = new Array<number>(g.n).fill(-1);
  const f = (v: number): number => {
    if (memo[v] >= 0) return memo[v];
    let best = 0;
    for (let e = 0; e < g.m; e++) if (g.eu[e] === v) best = Math.max(best, f(g.ev[e]));
    return (memo[v] = best + g.vw[v]);
  };
  return Array.from({ length: g.n }, (_, v) => f(v));
}

function hasCycleKahn(g: Graph): boolean {
  const indeg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) indeg[g.ev[e]]++;
  const q = indeg.map((d, v) => (d ? -1 : v)).filter((v) => v >= 0);
  let seen = 0;
  while (q.length) {
    const u = q.pop() as number;
    seen++;
    for (let e = 0; e < g.m; e++) if (g.eu[e] === u && --indeg[g.ev[e]] === 0) q.push(g.ev[e]);
  }
  return seen < g.n;
}

function checkSpanningForest(g: Graph, tree: number[]): void {
  expect(new Set(tree).size).toBe(tree.length);
  const comps = count(compsOf(g.n, edgeList(g)));
  expect(tree.length, 'a spanning forest has n - c edges').toBe(g.n - comps);
  expect(count(compsOf(g.n, tree.map((e) => [g.eu[e], g.ev[e]] as [number, number]))), 'spans every component').toBe(comps);
}

/** MST weight by a dense O(n^2) Prim, restarted in every component. */
function primRef(n: number, w: (i: number, j: number) => number): number {
  const inTree = new Array<boolean>(n).fill(false);
  const key = new Array<number>(n).fill(Infinity);
  let total = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!inTree[v] && (u < 0 || key[v] < key[u])) u = v;
    if (!Number.isFinite(key[u])) key[u] = 0;
    inTree[u] = true;
    total += key[u];
    for (let v = 0; v < n; v++) if (!inTree[v] && w(u, v) < key[v]) key[v] = w(u, v);
  }
  return total;
}

function vertexCutBrute(g: Graph, candidates: number[], sources: number[], t: number): number {
  let best = Infinity;
  for (let mask = 0; mask < 1 << candidates.length; mask++) {
    const C = new Set(candidates.filter((_, i) => mask & (1 << i)));
    if (C.size >= best) continue;
    const seen = new Set<number>();
    const q = sources.filter((v) => !C.has(v));
    q.forEach((v) => seen.add(v));
    let reaches = false;
    for (let h = 0; h < q.length && !reaches; h++) {
      for (const e of g.out[q[h]]) {
        const v = g.ev[e];
        if (v === t) { reaches = true; break; }
        if (!C.has(v) && !seen.has(v)) { seen.add(v); q.push(v); }
      }
    }
    if (!reaches) best = C.size;
  }
  return best;
}

// ---------------------------------------------------------------- the checkers, by goal

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

const CHECKS: Record<string, Check> = {
  bfs(g, run) {
    const r = run();
    const d = hops(g)[g.s];
    for (let v = 0; v < g.n; v++) {
      expect(r.dist[v]).toBe(Number.isFinite(d[v]) ? d[v] : -1);
      if (v !== g.s && r.dist[v] > 0) {
        expect(r.dist[r.parent[v]]).toBe(r.dist[v] - 1);
        expect(adjacent(g, r.parent[v], v)).toBe(true);
      }
    }
  },
  dfs(g, run) {
    const r = run();
    const reach = hops(g)[g.s];
    const rootOf = (v: number): number => (r.parent[v] < 0 ? v : rootOf(r.parent[v]));
    let back = 0;
    for (let v = 0; v < g.n; v++) {
      expect(r.pre[v]).toBeGreaterThanOrEqual(0);
      expect(rootOf(v) === g.s, `vertex ${v} in the first tree iff reachable`).toBe(Number.isFinite(reach[v]));
      const u = r.parent[v];
      if (u >= 0) { expect(r.pre[u]).toBeLessThan(r.pre[v]); expect(r.post[v]).toBeLessThan(r.post[u]); }
    }
    const nested = (a: number, b: number) => r.pre[a] < r.pre[b] && r.post[b] < r.post[a];
    for (let e = 0; e < g.m; e++) {
      const a = g.eu[e]; const b = g.ev[e];
      if (a === b) continue;
      if (g.directed) {
        if (r.post[a] < r.post[b]) { expect(nested(b, a), `edge ${a}->${b} finishing late is a back edge`).toBe(true); back++; }
      } else expect(nested(a, b) || nested(b, a), `edge ${a}-${b} joins ancestor and descendant`).toBe(true);
    }
    const roots = r.parent.filter((x: number) => x < 0).length;
    expect(r.back).toBe(g.directed ? back : g.m - (g.n - roots));
  },
  components(g, run) {
    samePartition(run().comp, compsOf(g.n, edgeList(g)));
  },
  articulation(g, run) {
    const r = run();
    const base = componentsWithout(g, new Set());
    for (let v = 0; v < g.n; v++) expect(r.cut[v], `vertex ${v}`).toBe(componentsWithout(g, new Set([v])) > base);
    if (g.n > 14) return;
    const blocks = new Map<number, number[]>();
    for (let e = 0; e < g.m; e++) {
      expect(r.block[e]).toBeGreaterThanOrEqual(0);
      blocks.set(r.block[e], [...(blocks.get(r.block[e]) ?? []), e]);
    }
    const vsOf = (es: number[]) => new Set(es.flatMap((e) => [g.eu[e], g.ev[e]]));
    for (const es of blocks.values()) {
      // each block is connected and has no articulation point of its own
      const sub = makeSub(g, es);
      expect(componentsWithout(sub, new Set(Array.from({ length: g.n }, (_, i) => i).filter((v) => !vsOf(es).has(v))))).toBe(1);
      if (es.length > 1) for (const v of vsOf(es)) {
        const gone = new Set(Array.from({ length: g.n }, (_, i) => i).filter((x) => !vsOf(es).has(x) || x === v));
        expect(componentsWithout(sub, gone), `block stays connected without ${v}`).toBe(1);
      }
    }
    const list = [...blocks.values()].map(vsOf);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const shared = [...list[i]].filter((v) => list[j].has(v));
      expect(shared.length).toBeLessThanOrEqual(1);
      for (const v of shared) expect(r.cut[v]).toBe(true);
    }
  },
  bridges(g, run) {
    const r = run();
    const base = componentsWithout(g, new Set());
    for (let e = 0; e < g.m; e++) expect(r.bridge[e], `edge ${e}`).toBe(componentsWithout(g, new Set(), new Set([e])) > base);
  },
  cycles(g, run) {
    const r = run();
    expect(r.cycles.length > 0).toBe(hasCycleKahn(g));
    r.edges.forEach((es: number[], i: number) => {
      const cyc: number[] = r.cycles[i];
      expect(es.length).toBe(cyc.length);
      es.forEach((e, k) => { expect(g.eu[e]).toBe(cyc[k]); expect(g.ev[e]).toBe(cyc[(k + 1) % cyc.length]); });
    });
  },
  euler(g, run) {
    const deg = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
    expect(deg.every((d) => d % 2 === 0), 'the input has every degree even').toBe(true);
    expect(count(compsOf(g.n, edgeList(g)))).toBe(1);
    const r = run();
    expect(r.edges.length).toBe(g.m);
    expect(new Set(r.edges).size).toBe(g.m);
    expect(r.tour[0]).toBe(r.tour[g.m]);
    r.edges.forEach((e: number, k: number) => {
      const a = r.tour[k]; const b = r.tour[k + 1];
      expect((g.eu[e] === a && g.ev[e] === b) || (g.eu[e] === b && g.ev[e] === a)).toBe(true);
    });
  },
  hamilton(g, run) {
    const r = run();
    if (r.path) {
      expect(new Set(r.path).size).toBe(g.n);
      for (let i = 1; i < g.n; i++) expect(adjacent(g, r.path[i - 1], r.path[i])).toBe(true);
    }
    if (g.n <= 14) {
      // Held-Karp style subset DP: can a path cover exactly `mask` and end at v?
      const N = 1 << g.n;
      const adj = Array.from({ length: g.n }, (_, a) => Array.from({ length: g.n }, (_, b) => adjacent(g, a, b)));
      const can = Array.from({ length: N }, () => new Array<boolean>(g.n).fill(false));
      for (let v = 0; v < g.n; v++) can[1 << v][v] = true;
      for (let mask = 1; mask < N; mask++) {
        for (let v = 0; v < g.n; v++) {
          if (!can[mask][v]) continue;
          for (let w = 0; w < g.n; w++) if (!(mask & (1 << w)) && adj[v][w]) can[mask | (1 << w)][w] = true;
        }
      }
      expect(r.path !== null, 'agrees with the subset DP').toBe(can[N - 1].some(Boolean));
    }
  },
  scc(g, run) {
    const d = hops(g);
    const ref = Array.from({ length: g.n }, (_, v) => {
      for (let u = 0; u < g.n; u++) if (Number.isFinite(d[u][v]) && Number.isFinite(d[v][u])) return u;
      return v;
    });
    samePartition(run().comp, ref);
  },
  toposort(g, run) {
    const r = run();
    expect([...r.order].sort((a, b) => a - b)).toEqual(Array.from({ length: g.n }, (_, i) => i));
    const pos = new Array<number>(g.n);
    r.order.forEach((v: number, i: number) => { pos[v] = i; });
    for (let e = 0; e < g.m; e++) expect(pos[g.eu[e]]).toBeLessThan(pos[g.ev[e]]);
  },
  closure(g, run) {
    const r = run();
    const d = hops(g);
    for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) expect(r.reach[i * g.n + j]).toBe(Number.isFinite(d[i][j]) ? 1 : 0);
  },
  mst(g, run) {
    const r = run();
    checkSpanningForest(g, r.tree);
    const W = Array.from({ length: g.n }, () => new Array<number>(g.n).fill(Infinity));
    for (let e = 0; e < g.m; e++) {
      const a = g.eu[e]; const b = g.ev[e];
      W[a][b] = W[b][a] = Math.min(W[a][b], g.w[e]);
    }
    expect(r.tree.reduce((s: number, e: number) => s + g.w[e], 0)).toBe(primRef(g.n, (i, j) => W[i][j]));
  },
  emst(g, run) {
    const r = run();
    expect(r.tree.length).toBe(g.n - 1);
    expect(count(compsOf(g.n, r.tree.map((e: number) => [g.eu[e], g.ev[e]] as [number, number])))).toBe(1);
    const len = (i: number, j: number) => Math.hypot(g.x[i] - g.x[j], g.y[i] - g.y[j]);
    close(r.tree.reduce((s: number, e: number) => s + len(g.eu[e], g.ev[e]), 0), primRef(g.n, len));
  },
  sssp(g, run) {
    const r = run();
    const ref = bellman(g, g.s);
    if ('cycle' in r && r.cycle) {
      expect(ref.negative, 'a negative cycle is reachable').toBe(true);
      let sum = 0;
      r.cycleEdges.forEach((e: number, k: number) => {
        sum += g.w[e];
        expect(g.eu[e]).toBe(r.cycle[k]);
        expect(g.ev[e]).toBe(r.cycle[(k + 1) % r.cycle.length]);
      });
      expect(sum).toBeLessThan(0);
      return;
    }
    expect(ref.negative).toBe(false);
    for (let v = 0; v < g.n; v++) {
      expect(r.dist[v], `distance to ${v}`).toBe(ref.dist[v]);
      const e = r.parentEdge[v];
      if (v !== g.s && e >= 0) {
        const u = g.eu[e] === v && !g.directed ? g.ev[e] : g.eu[e];
        expect(r.dist[u] + g.w[e]).toBe(r.dist[v]);
      }
    }
  },
  apsp(g, run) {
    const r = run();
    const neg = Array.from({ length: g.n }, (_, s) => bellman(g, s).negative).some(Boolean);
    expect(r.negative).toBe(neg);
    if (neg) return;
    for (let s = 0; s < g.n; s++) {
      const ref = bellman(g, s).dist;
      for (let v = 0; v < g.n; v++) expect(r.dist[s * g.n + v]).toBe(ref[v]);
    }
  },
  credible(g, run) {
    for (const rule of ['doubt', 'log']) {
      const r = run({ cost: rule });
      const cost = (e: number) => (rule === 'log' ? -Math.log(g.w[e]) : 1 - g.w[e]);
      const ref = bellman(g, g.s, cost).dist;
      if (!Number.isFinite(ref[g.t])) { expect(r.path).toBeNull(); continue; }
      close(r.dist[g.t], ref[g.t]);
      expect(r.path[0]).toBe(g.s);
      expect(r.path[r.path.length - 1]).toBe(g.t);
      close(r.edges.reduce((s: number, e: number) => s + cost(e), 0), ref[g.t]);
      close(r.confidence, r.edges.reduce((p: number, e: number) => p * g.w[e], 1));
    }
  },
  ksp(g, run) {
    for (const k of [1, 3, 6]) {
      const r = run({ k });
      const keys = new Set<string>();
      let last = -Infinity;
      for (const q of r.paths) {
        expect(q.verts[0]).toBe(g.s);
        expect(q.verts[q.verts.length - 1]).toBe(g.t);
        expect(new Set(q.verts).size, 'loopless').toBe(q.verts.length);
        q.edges.forEach((e: number, i: number) => {
          const a = q.verts[i]; const b = q.verts[i + 1];
          expect((g.eu[e] === a && g.ev[e] === b) || (!g.directed && g.eu[e] === b && g.ev[e] === a)).toBe(true);
        });
        expect(q.cost).toBe(q.edges.reduce((s: number, e: number) => s + g.w[e], 0));
        expect(q.cost).toBeGreaterThanOrEqual(last);
        last = q.cost;
        keys.add(q.edges.join(','));
      }
      expect(keys.size).toBe(r.paths.length);
      if (g.n <= 12) {
        const all = simplePaths(g, g.s, g.t);
        expect(r.paths.map((q: { cost: number }) => q.cost)).toEqual(all.slice(0, k));
      } else if (r.paths.length) expect(r.paths[0].cost).toBe(bellman(g, g.s).dist[g.t]);
    }
  },
  maxflow(g, run) {
    const r = run();
    checkFlow(g, r.flow, r.value, g.s, g.t);
    expect(r.value).toBe(g.n <= 14 ? minCutBrute(g, g.s, g.t) : maxFlowRef(g, g.s, g.t));
    expect(r.side[g.s]).toBe(true);
    expect(r.side[g.t]).toBe(false);
    let cut = 0;
    for (let e = 0; e < g.m; e++) if (r.side[g.eu[e]] && !r.side[g.ev[e]]) cut += g.cap[e];
    expect(cut, 'the reported side is a minimum cut').toBe(r.value);
  },
  mincostflow(g, run) {
    const r = run();
    checkFlow(g, r.flow, r.value, g.s, g.t);
    const ref = minCostRef(g, g.s, g.t);
    expect(r.value).toBe(ref.value);
    expect(r.cost).toBe(ref.cost);
  },
  matching(g, run) {
    const r = run();
    let size = 0;
    for (let v = 0; v < g.n; v++) {
      if (r.mate[v] < 0) continue;
      expect(r.mate[r.mate[v]]).toBe(v);
      expect(adjacent(g, v, r.mate[v])).toBe(true);
      if (g.truth[v] === 0) size++;
    }
    // reference: brute force over the left side, every choice of partner or none
    const left = Array.from({ length: g.n }, (_, i) => i).filter((v) => g.truth[v] === 0);
    const best = (i: number, used: Set<number>): number => {
      if (i === left.length) return 0;
      let b = best(i + 1, used);
      for (let e = 0; e < g.m; e++) {
        const r2 = g.eu[e] === left[i] ? g.ev[e] : g.ev[e] === left[i] ? g.eu[e] : -1;
        if (r2 < 0 || used.has(r2)) continue;
        used.add(r2);
        b = Math.max(b, 1 + best(i + 1, used));
        used.delete(r2);
      }
      return b;
    };
    if (g.n <= 24) expect(size).toBe(best(0, new Set()));
  },
  betweenness(g, run) {
    const r = run();
    // pair formula: sum over s < t of sigma_sv sigma_vt / sigma_st on shortest paths
    const d = hops(g);
    const sigma = Array.from({ length: g.n }, (_, s) => {
      const sg = new Array<number>(g.n).fill(0);
      sg[s] = 1;
      const order = Array.from({ length: g.n }, (_, v) => v).filter((v) => Number.isFinite(d[s][v])).sort((a, b) => d[s][a] - d[s][b]);
      for (const v of order) for (const [a, b] of arcsOf(g)) if (b === v && d[s][a] + 1 === d[s][v]) sg[v] += sg[a];
      return sg;
    });
    for (let v = 0; v < g.n; v++) {
      let cb = 0;
      for (let s = 0; s < g.n; s++) for (let t = s + 1; t < g.n; t++) {
        if (s === v || t === v || !Number.isFinite(d[s][t])) continue;
        if (d[s][v] + d[v][t] === d[s][t]) cb += (sigma[s][v] * sigma[v][t]) / sigma[s][t];
      }
      close(r.cb[v], cb);
    }
  },
  centrality(g, run) {
    const r = run();
    const d = hops(g);
    for (let v = 0; v < g.n; v++) {
      expect(r.degree[v]).toBe(edgeList(g).filter(([a, b]) => a === v || b === v).length);
      const reach = d[v].filter(Number.isFinite);
      const sum = reach.reduce((s, x) => s + x, 0);
      close(r.closeness[v], sum ? (reach.length - 1) / sum : 0);
    }
    // eigenvector: unit length, non-negative, its Rayleigh quotient the reported eigenvalue,
    // and, once the iteration has converged, A x = lambda x
    close(Math.hypot(...r.eigen), 1);
    const ax = new Array<number>(g.n).fill(0);
    for (const [a, b] of edgeList(g)) { ax[a] += r.eigen[b]; ax[b] += r.eigen[a]; }
    expect(Math.abs(ax.reduce((s, x, v) => s + x * r.eigen[v], 0) - r.lambda)).toBeLessThan(1e-4);
    for (let v = 0; v < g.n; v++) {
      expect(r.eigen[v]).toBeGreaterThanOrEqual(-1e-12);
      if (r.converged) expect(Math.abs(ax[v] - r.lambda * r.eigen[v])).toBeLessThan(1e-6);
    }
  },
  ownership(g, run) {
    const r = run();
    const t = g.t;
    const A = identity(g.n);
    for (let e = 0; e < g.m; e++) if (g.eu[e] !== t) A[g.eu[e]][g.ev[e]] -= g.w[e];
    const b = new Array<number>(g.n).fill(0);
    b[t] = 1;
    const ref = solve(A, b);
    for (let v = 0; v < g.n; v++) close(r.eff[v], ref[v], 1e-9);
  },
  ego(g, run) {
    const d = hops(g)[g.s];
    for (const k of [1, 2, 4]) {
      const r = run({ k });
      for (let v = 0; v < g.n; v++) expect(r.hop[v]).toBe(d[v] <= k ? d[v] : -1);
    }
  },
  lpa(g, run) {
    const r = run();
    expect(r.converged).toBe(true);
    for (let v = 0; v < g.n; v++) {
      const c = new Map<number, number>();
      for (const [a, b] of edgeList(g)) {
        if (a === v) c.set(r.label[b], (c.get(r.label[b]) ?? 0) + 1);
        if (b === v) c.set(r.label[a], (c.get(r.label[a]) ?? 0) + 1);
      }
      if (c.size) expect(c.get(r.label[v]), `vertex ${v} holds a most common label`).toBe(Math.max(...c.values()));
    }
  },
  modularity(g, run) {
    for (const method of ['louvain', 'leiden']) {
      const r = run({ method });
      const q = modularityRef(g, r.comm);
      expect(q).toBeGreaterThanOrEqual(modularityRef(g, Array.from({ length: g.n }, (_, i) => i)) - 1e-12);
      if (g.m) expect(q).toBeGreaterThanOrEqual(-1e-12);
      if (g.shape === 'communities' && g.n >= 30) expect(q).toBeGreaterThanOrEqual(0.9 * modularityRef(g, g.truth));
      if (method === 'leiden') {
        for (const c of new Set<number>(r.comm)) {
          const members = new Set<number>(r.comm.map((x: number, v: number) => (x === c ? v : -1)).filter((v: number) => v >= 0));
          const inside = edgeList(g, (e) => members.has(g.eu[e]) && members.has(g.ev[e]));
          const comps = compsOf(g.n, inside);
          expect(new Set([...members].map((v) => comps[v])).size, `Leiden community ${c} is connected`).toBe(1);
        }
      }
    }
  },
  pagerank(g, run, k) {
    const personal = k.pick === 's';
    for (const d of [0.5, 0.85]) {
      const r = run({ damping: d });
      const tele = Array.from({ length: g.n }, (_, v) => (personal ? (v === g.s ? 1 : 0) : 1 / g.n));
      const outdeg = new Array<number>(g.n).fill(0);
      for (const [a] of arcsOf(g)) outdeg[a]++;
      // r = (1 - d) t + d P^T r + d (dangling . r) t
      const A = identity(g.n);
      for (const [a, b] of arcsOf(g)) A[b][a] -= d / outdeg[a];
      for (let v = 0; v < g.n; v++) for (let u = 0; u < g.n; u++) if (!outdeg[u]) A[v][u] -= d * tele[v];
      const ref = solve(A, tele.map((t) => (1 - d) * t));
      close(r.rank.reduce((s: number, x: number) => s + x, 0), 1, 1e-9);
      for (let v = 0; v < g.n; v++) close(r.rank[v], ref[v], 1e-8);
    }
  },
  activation(g, run) {
    const d = 0.6;
    const strength = new Array<number>(g.n).fill(0);
    for (const [a, , w] of arcsOf(g)) strength[a] += w;
    const A = identity(g.n);
    for (const [a, b, w] of arcsOf(g)) A[b][a] -= (d * w) / strength[a];
    const b = new Array<number>(g.n).fill(0);
    b[g.s] = 1;
    const ref = solve(A, b);
    const exact = run({ decay: d, threshold: 0 });
    for (let v = 0; v < g.n; v++) close(exact.act[v], ref[v], 1e-9);
    const pruned = run({ decay: d, threshold: 5 });
    for (let v = 0; v < g.n; v++) expect(pruned.act[v]).toBeLessThanOrEqual(ref[v] + 1e-12);
  },
  sphere(g, run) {
    const r = run();
    expect([...r.slot].sort((a, b) => a - b)).toEqual(Array.from({ length: g.n }, (_, i) => i));
    for (let v = 0; v < g.n; v++) close(Math.hypot(r.x[v], r.y[v], r.z[v]), 1, 1e-12);
    // equal heights hold equal areas (Archimedes): any band of height h holds about n h / 2 points
    for (const [lo, hi] of [[-1, -0.5], [-0.2, 0.3], [0.5, 1]]) {
      const inBand = r.y.filter((y: number) => y >= lo && y < hi).length;
      expect(Math.abs(inBand - (g.n * (hi - lo)) / 2)).toBeLessThanOrEqual(1);
    }
  },
  'force-layout'(g, run) {
    const r = run();
    for (let v = 0; v < g.n; v++) { expect(Number.isFinite(r.x[v])).toBe(true); expect(Number.isFinite(r.y[v])).toBe(true); }
    if (g.n < 20 || !g.m) return;
    const dist = (a: number, b: number) => Math.hypot(r.x[a] - r.x[b], r.y[a] - r.y[b]);
    let all = 0; let pairs = 0;
    for (let a = 0; a < g.n; a++) for (let b = a + 1; b < g.n; b++) { all += dist(a, b); pairs++; }
    const edge = edgeList(g).reduce((s, [a, b]) => s + dist(a, b), 0) / g.m;
    expect(edge, 'neighbours end closer than the average pair').toBeLessThan(0.6 * (all / pairs));
    if (g.shape === 'communities') {
      let inS = 0; let inN = 0; let outS = 0; let outN = 0;
      for (let a = 0; a < g.n; a++) for (let b = a + 1; b < g.n; b++) {
        if (g.truth[a] === g.truth[b]) { inS += dist(a, b); inN++; } else { outS += dist(a, b); outN++; }
      }
      expect(inS / inN).toBeLessThan(outS / outN);
    }
  },
  'geo-layout'(g, run) {
    const loose = run({ pull: 0 });
    const tight = run({ pull: 1 });
    for (const r of [loose, tight]) for (let v = 0; v < g.n; v++) expect(Number.isFinite(r.x[v] + r.y[v])).toBe(true);
    const off = (r: Result) => r.x.reduce((s: number, x: number, v: number) => s + Math.hypot(x - g.x[v], r.y[v] - g.y[v]), 0);
    close(off(tight), tight.offset, 1e-9);
    expect(off(tight)).toBeLessThan(off(loose));
  },
  layered(g, run) {
    const r = run();
    const nodes = r.layer.length;
    const seen = new Set<number>();
    const pos = new Array<number>(nodes);
    r.orders.forEach((o: number[], l: number) => o.forEach((v, i) => { expect(r.layer[v]).toBe(l); seen.add(v); pos[v] = i; }));
    expect(seen.size).toBe(nodes);
    for (const [a, b] of r.segs) expect(r.layer[b]).toBe(r.layer[a] + 1);
    const rev = new Set(r.reversed);
    if (!hasCycleKahn(g)) expect(rev.size).toBe(0);
    for (let e = 0; e < g.m; e++) {
      if (g.eu[e] === g.ev[e]) continue;
      const [a, b] = rev.has(e) ? [g.ev[e], g.eu[e]] : [g.eu[e], g.ev[e]];
      expect(r.layer[a]).toBeLessThan(r.layer[b]);
    }
    let c = 0;
    for (let i = 0; i < r.segs.length; i++) for (let j = i + 1; j < r.segs.length; j++) {
      const [a, b] = r.segs[i]; const [x, y] = r.segs[j];
      if (r.layer[a] === r.layer[x] && (pos[a] - pos[x]) * (pos[b] - pos[y]) < 0) c++;
    }
    expect(c).toBe(r.crossings);
    expect(r.crossings).toBeLessThanOrEqual(r.initial);
  },
  merge(g, run) {
    for (const th of [0.3, 0.5, 0.8]) {
      const r = run({ threshold: th });
      samePartition(r.comp, compsOf(g.n, edgeList(g, (e) => g.w[e] >= th)));
      let tp = 0; let fp = 0; let fn = 0;
      for (let a = 0; a < g.n; a++) for (let b = a + 1; b < g.n; b++) {
        const same = r.comp[a] === r.comp[b]; const truly = g.truth[a] === g.truth[b];
        if (same && truly) tp++; else if (same) fp++; else if (truly) fn++;
      }
      close(r.precision, tp + fp ? tp / (tp + fp) : 1);
      close(r.recall, tp + fn ? tp / (tp + fn) : 1);
    }
  },
  support(g, run) {
    const r = run();
    const d = hops(g);
    const under = Array.from({ length: g.n }, (_, v) => v).filter((v) => v !== g.t && Number.isFinite(d[v][g.t]));
    expect([...r.support].sort((a, b) => a - b)).toEqual(under);
    const evidence = under.filter((v) => !edgeList(g).some(([, b]) => b === v));
    expect([...r.evidence].sort((a, b) => a - b)).toEqual(evidence);
    expect(r.paths.length).toBe(r.lines);
    const used = new Set<number>();
    for (const path of r.paths) {
      expect(evidence).toContain(path[0]);
      expect(path[path.length - 1]).toBe(g.t);
      for (let i = 0; i + 1 < path.length; i++) expect(adjacent(g, path[i], path[i + 1])).toBe(true);
      for (const v of path.slice(0, -1)) { expect(used.has(v), `lines share ${v}`).toBe(false); used.add(v); }
    }
    if (under.length <= 14) expect(r.lines).toBe(vertexCutBrute(g, under, evidence, g.t));
  },
  sir(g, run) {
    const r = run();
    const d = hops(g)[g.s];
    for (let v = 0; v < g.n; v++) {
      if (r.infected[v] >= 0) expect(Number.isFinite(d[v])).toBe(true);
      if (r.recovered[v] >= 0) expect(r.recovered[v]).toBeGreaterThan(r.infected[v]);
      else expect(r.infected[v]).toBe(-1);
    }
    const sure = run({ beta: 1, gamma: 1 });
    for (let v = 0; v < g.n; v++) expect(sure.infected[v]).toBe(Number.isFinite(d[v]) ? d[v] : -1);
  },
  cpm(g, run) {
    const r = run();
    const to = longestTo(g); const from = longestFrom(g);
    const length = Math.max(...to);
    expect(r.length).toBe(length);
    for (let v = 0; v < g.n; v++) {
      expect(r.es[v]).toBe(to[v] - g.vw[v]);
      expect(r.slack[v], `slack of ${v}`).toBe(length - (to[v] + from[v] - g.vw[v]));
    }
  },
  waves(g, run) {
    const r = run();
    const memo = new Array<number>(g.n).fill(-1);
    const depth = (v: number): number => {
      if (memo[v] >= 0) return memo[v];
      let b = 0;
      for (let e = 0; e < g.m; e++) if (g.ev[e] === v) b = Math.max(b, depth(g.eu[e]) + 1);
      return (memo[v] = b);
    };
    for (let v = 0; v < g.n; v++) expect(r.wave[v]).toBe(depth(v));
    const pos = new Array<number>(g.n);
    r.order.forEach((v: number, i: number) => { pos[v] = i; });
    for (let e = 0; e < g.m; e++) expect(pos[g.eu[e]]).toBeLessThan(pos[g.ev[e]]);
  },
};

/** The subgraph of g holding only the edges `es` (vertex ids kept). */
function makeSub(g: Graph, es: number[]): Graph {
  const out: number[][] = Array.from({ length: g.n }, () => []);
  es.forEach((e, i) => { out[g.eu[e]].push(i); out[g.ev[e]].push(i); });
  return { ...g, m: es.length, eu: es.map((e) => g.eu[e]), ev: es.map((e) => g.ev[e]), w: es.map((e) => g.w[e]),
    cap: es.map((e) => g.cap[e]), cost: es.map((e) => g.cost[e]), out, in: out };
}

function sizes(k: GraphKernel): number[] {
  const r = k.n ?? { min: 8, max: 240, value: 60 };
  return [...new Set([r.min, 7, 12, 26, 44].map((n) => Math.min(r.max, Math.max(r.min, n))))];
}

// ---------------------------------------------------------------- the harness

describe('graph kernels', () => {
  it('every live graph entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  it('every kernel names a goal the harness can check', () => {
    for (const e of live) expect(Object.keys(CHECKS), e.id).toContain(kernelOf(e.id).goal);
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      for (const shape of kernel.inputs) {
        it(`matches its reference on ${shape} inputs`, () => {
          for (const n of sizes(kernel)) {
            for (const seed of SEEDS) {
              const g = makeGraph(shape, n, seed + n);
              expect(g.directed).toBe(DIRECTED.has(shape));
              const run: Run = (p = {}, o = {}) => {
                const t = trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), ...p }, ...o }, seed);
                expect(t.truncated, `${shape} n=${n} seed=${seed} fits the event cap`).toBe(false);
                expect(work(t.counts)).toBeGreaterThan(0);
                return t.result;
              };
              CHECKS[kernel.goal](g, run, kernel);
            }
          }
        });
      }
    });
  }
});

// ---------------------------------------------------------------- the plates and labs run

/** A p5 stand-in: every drawing call is a no-op, constants are numbers. */
function fakeP5(): p5 {
  return new Proxy({}, { get: (_, key) => (typeof key === 'string' && /^[A-Z_]+$/.test(key) ? 0 : () => undefined) }) as p5;
}

function fakeContext(params: Params, seed: number): PlateContext & { rows: number; charts: number } {
  const ground = GROUNDS.dark;
  const out = {
    width: 640, height: 360, params, seed, rnd: mulberry32(seed), theme: 'dark' as const,
    bg: ground.bg, fg: ground.fg, thumbnail: false, rows: 0, charts: 0,
    palette: () => palette(String(params.palette)),
    stats(rows: { label: string; value: string }[]) {
      out.rows = rows.length;
      for (const r of rows) expect(r.value, r.label).not.toMatch(/NaN|undefined/);
    },
    chart() { out.charts++; },
  };
  return out;
}

describe('graph kernels at their maximum size', () => {
  // memory on a phone: a recorded event is five doubles, so this bounds a trace at 12 MB
  const MAX_EVENTS = 300_000;
  for (const e of live) {
    const kernel = kernelOf(e.id);
    if (kernel.mayStop) continue;
    it(`${e.id} finishes on every input and seed, within the memory bound`, () => {
      const n = kernel.n?.max ?? 240;
      // the kernel's own controls at their heaviest: every range at its maximum
      const p = defaultParams(kernel);
      for (const d of kernel.params ?? []) if (d.kind === 'range') p[d.key] = d.max;
      for (const shape of kernel.inputs) {
        for (const seed of [1, 2, 3, 4]) {
          const g = makeGraph(shape, n, seed);
          const t = trace(kernel, g, { s: g.s, t: g.t, p }, seed);
          expect(t.truncated, `${shape} n=${n} seed=${seed}`).toBe(false);
          expect(t.length, `${shape} n=${n} seed=${seed} events`).toBeLessThanOrEqual(MAX_EVENTS);
          expect(t.events.length).toBe(5 * t.length);
        }
      }
    });
  }
});

describe('graph plates', () => {
  for (const e of live) {
    it(`${e.id} replays its run to the end, draws and publishes readouts`, async () => {
      const code = engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(e.id));
      const params: Params = {};
      for (const d of code.params) params[d.key] = d.value;
      params.speed = 2000;
      const ctx = fakeContext(params, 7);
      const sim = code.create(fakeP5(), ctx);
      sim.setup();
      for (let f = 0; f < 320; f++) sim.draw();
      sim.pressed?.(320, 180);
      sim.draw();
      expect(ctx.rows).toBeGreaterThan(2);
      expect(ctx.charts > 0 || !kernelOf(e.id).chart).toBe(true);
    });
  }

  it('a lab of graph kernels builds, measures and draws', () => {
    const ids = ['dijkstra', 'bellman-ford', 'floyd-warshall'].filter((id) => kernelOf(id));
    const code = engine.lab('shortest-paths', ids.map((id) => ({ info: { id, title: id, group: 'g' }, kernel: kernelOf(id) })));
    const params: Params = {};
    for (const d of code.params) params[d.key] = d.value;
    const ctx = fakeContext(params, 3);
    const sim = code.create(fakeP5(), ctx);
    sim.setup();
    for (let f = 0; f < 40; f++) sim.draw();
    expect(ctx.rows).toBe(ids.length);
  });
});

it('the shapes are what their names say', () => {
  for (const shape of ['dag', 'signed-dag', 'reasoning'] as Shape[]) expect(hasCycleKahn(makeGraph(shape, 40, 5))).toBe(false);
  expect(hasCycleKahn(makeGraph('ownership', 60, 5))).toBe(true);
  const signed = makeGraph('signed', 40, 5);
  expect(signed.w.some((w) => w < 0)).toBe(true);
  expect(bellman(signed, signed.s).negative).toBe(false);
  const negc = makeGraph('negative-cycle', 40, 5);
  expect(bellman(negc, negc.s).negative).toBe(true);
  const own = makeGraph('ownership', 60, 5);
  for (let v = 0; v < own.n; v++) expect(own.in[v].reduce((s, e) => s + own.w[e], 0)).toBeLessThanOrEqual(0.951);
  for (const shape of ['geometric', 'grid', 'communities', 'flow', 'links'] as Shape[]) {
    const g = makeGraph(shape, 50, 9);
    expect(count(compsOf(g.n, edgeList(g))), shape).toBe(1);
  }
});
