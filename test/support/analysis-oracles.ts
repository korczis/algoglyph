// Independent references for the graph-analysis plates' claims (wave 7b: pagerank,
// personalised-pagerank, brandes-betweenness, centrality-comparison, effective-ownership,
// ego-network, label-propagation, louvain-leiden, spreading-activation), written over the Graph's
// edge lists alone and never through a kernel: linear systems by Gaussian elimination with
// partial pivoting where the plates iterate, eigenvalues by cyclic Jacobi where the plate runs a
// power iteration, betweenness by the pair formula over breadth-first searches where the plate
// accumulates dependencies backwards, and the plate's own claim read through the one instrument.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED, type Claim } from '../../src/core/claims';
import type { Params } from '../../src/core/plate';
import { graphInput } from '../../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../../src/engines/graph/trace';
import { failures } from './claims';

/** The claims catalogue/entries/<id>.md authors, as the catalogue loads them. */
export function claimsOf(id: string): Claim[] {
  const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims?: Claim[] }[] } };
  return model.entries.find((e) => e.id === id)?.claims ?? [];
}

/** The claim's parameters: the kernel's defaults with the claim's setup over them. */
export function paramsOf(kernel: GraphKernel, c: Claim): Params {
  return { ...defaultParams(kernel), ...((c.setup?.params ?? {}) as Params) };
}

/** The seeds a claim runs at: its list, its one seed, or 4242. */
export const seedsOf = (c: Claim): number[] => c.setup?.seeds ?? [c.setup?.seed ?? DEFAULT_SEED];

/** The graph a claim's run starts on at `seed`, as src/engines/graph/index.ts builds it: the
 * claim's shape (the kernel's first input otherwise), size and input controls, at 16:9. */
export function graphAt(kernel: GraphKernel, c: Claim, seed: number): Graph {
  const p = paramsOf(kernel, c);
  const shape = (c.setup?.params?.shape ?? kernel.inputs[0]) as Shape;
  const n = Number(c.setup?.params?.n ?? kernel.n?.value);
  return makeGraph(shape, n, seed, 16 / 9, graphInput(kernel, p));
}

/** The claim judged on the plate itself, by test/support/claims.ts at every seed it names. */
export async function holdsOnThePlate(id: string, c: Claim): Promise<void> {
  expect(await failures(id, c), `${id} claim ${c.id}`).toEqual([]);
}

/** How one claim's figure is computed here and compared with the literal the entry states. */
export type Check = (c: Claim) => void;

/** Every claim of entry `id` against its check, by claim id: the literal must equal the check's
 * own computation, and the plate, read in the same run, must meet it. A claim with no check, or
 * a check with no claim, fails. */
export function claimsAgainst(id: string, checks: Record<string, Check>): void {
  describe(`${id}: claims against independent references`, () => {
    const claims = claimsOf(id);
    it('checks every claim the entry makes, and no other', () => {
      expect(claims.map((c) => c.id).sort()).toEqual(Object.keys(checks).sort());
    });
    for (const c of claims) {
      it(`${c.id}: "${c.readout}"`, async () => {
        const check = checks[c.id];
        expect(check, `${id} claim ${c.id} has no reference here`).toBeDefined();
        check(c);
        await holdsOnThePlate(id, c);
      });
    }
  });
}

/** No edge is a loop and no pair is joined twice: the adjacency the oracles build is the plate's. */
export function expectSimple(g: Graph): void {
  const seen = new Set<string>();
  for (let e = 0; e < g.m; e++) {
    expect(g.eu[e], `edge ${e} is a loop`).not.toBe(g.ev[e]);
    const key = g.directed ? `${g.eu[e]},${g.ev[e]}`
      : `${Math.min(g.eu[e], g.ev[e])},${Math.max(g.eu[e], g.ev[e])}`;
    expect(seen.has(key), `pair ${key} twice`).toBe(false);
    seen.add(key);
  }
}

/** Neighbour lists from the edge lists: out-neighbours of a directed graph, both ways otherwise. */
export function neighbours(g: Graph): number[][] {
  const next: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    next[g.eu[e]].push(g.ev[e]);
    if (!g.directed) next[g.ev[e]].push(g.eu[e]);
  }
  return next;
}

/** Hop distances from s by breadth-first search over the neighbour lists (-1 when unreached). */
export function hops(next: number[][], s: number): number[] {
  const d = new Array<number>(next.length).fill(-1);
  d[s] = 0;
  const queue = [s];
  for (let i = 0; i < queue.length; i++) {
    for (const v of next[queue[i]]) if (d[v] < 0) { d[v] = d[queue[i]] + 1; queue.push(v); }
  }
  return d;
}

/** The connected components of an undirected graph, by repeated breadth-first search. */
export function componentCount(g: Graph): number {
  const next = neighbours(g);
  const seen = new Array<boolean>(g.n).fill(false);
  let k = 0;
  for (let s = 0; s < g.n; s++) {
    if (seen[s]) continue;
    k++;
    hops(next, s).forEach((d, v) => { if (d >= 0) seen[v] = true; });
  }
  return k;
}

/** x with A x = b, by Gaussian elimination with partial pivoting (A is copied). */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    expect(Math.abs(M[c][c]), `pivot ${c}`).toBeGreaterThan(1e-12);
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/**
 * PageRank's fixed point by one linear solve: x = (1 - d) t + d P x + d (dangling mass of x) t,
 * P moving a vertex's score evenly along its out-edges (both ways when undirected), so
 * (I - d P - d t 1_D^T) x = (1 - d) t.
 */
export function pagerankSolve(g: Graph, d: number, teleport: number[]): number[] {
  const n = g.n;
  const next = neighbours(g);
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let u = 0; u < n; u++) {
    if (next[u].length) for (const v of next[u]) A[v][u] -= d / next[u].length;
    else for (let v = 0; v < n; v++) A[v][u] -= d * teleport[v];
  }
  return solve(A, teleport.map((t) => (1 - d) * t));
}

/** The vertex with the largest value (`skip` excluded) and its margin over the runner-up. */
export function top(x: number[], skip = -1): { v: number; value: number; gap: number } {
  let v = -1; let second = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (i === skip) continue;
    if (v < 0 || x[i] > x[v]) { if (v >= 0) second = Math.max(second, x[v]); v = i; } else second = Math.max(second, x[i]);
  }
  return { v, value: x[v], gap: x[v] - second };
}

/** How far x lies from the nearest point where rounding to `digits` decimals changes, so that a
 * value within that distance of x rounds the same: the margin a rounded literal needs. */
export function roundingMargin(x: number, digits: number): number {
  const u = 10 ** -digits;
  const f = x / u - Math.floor(x / u);
  return Math.abs(f - 0.5) * u;
}

/** The same margin for toPrecision(sig): rounding at the place of the sig-th significant digit. */
export function precisionMargin(x: number, sig: number): number {
  return roundingMargin(x, sig - 1 - Math.floor(Math.log10(Math.abs(x))));
}

/**
 * Betweenness by the pair formula: for every pair s < t joined in the graph, a vertex v other
 * than both lies on sigma_sv * sigma_vt of the sigma_st shortest paths exactly when
 * d(s, v) + d(v, t) = d(s, t), and adds that share. The path counts come from a breadth-first
 * search from every vertex; nothing is accumulated backwards.
 */
export function pairBetweenness(g: Graph): number[] {
  const next = neighbours(g);
  const dist: number[][] = []; const sigma: number[][] = [];
  for (let s = 0; s < g.n; s++) {
    const d = hops(next, s);
    const order = d.map((_, v) => v).filter((v) => d[v] >= 0).sort((a, b) => d[a] - d[b]);
    const c = new Array<number>(g.n).fill(0);
    c[s] = 1;
    for (const v of order) for (const w of next[v]) if (d[w] === d[v] + 1) c[w] += c[v];
    dist.push(d); sigma.push(c);
  }
  const cb = new Array<number>(g.n).fill(0);
  for (let s = 0; s < g.n; s++) for (let t = s + 1; t < g.n; t++) {
    if (dist[s][t] <= 0) continue;
    for (let v = 0; v < g.n; v++) {
      if (v === s || v === t || dist[s][v] < 0 || dist[v][t] < 0) continue;
      if (dist[s][v] + dist[v][t] === dist[s][t]) cb[v] += (sigma[s][v] * sigma[v][t]) / sigma[s][t];
    }
  }
  return cb;
}

/** Eigenvalues and orthonormal eigenvectors (columns of V) of a symmetric matrix, by cyclic
 * Jacobi rotations until every off-diagonal entry is below 1e-13 of the matrix's scale. */
export function jacobi(S: number[][]): { values: number[]; vectors: number[][] } {
  const n = S.length;
  const A = S.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const scale = Math.max(1, ...A.flat().map(Math.abs));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off = Math.max(off, Math.abs(A[p][q]));
    if (off < 1e-13 * scale) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p]; const akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k]; const aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p]; const vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}

/** The adjacency matrix of an undirected graph. */
export function adjacency(g: Graph): number[][] {
  const A = Array.from({ length: g.n }, () => new Array<number>(g.n).fill(0));
  for (let e = 0; e < g.m; e++) { A[g.eu[e]][g.ev[e]] += 1; A[g.ev[e]][g.eu[e]] += 1; }
  return A;
}

/** Newman's modularity of a partition, unweighted: the share of edges inside a community minus
 * the share expected from the degrees, summed over communities. */
export function newmanQ(g: Graph, part: ArrayLike<number>): number {
  const deg = new Array<number>(g.n).fill(0);
  const inside = new Map<number, number>(); const tot = new Map<number, number>();
  for (let e = 0; e < g.m; e++) {
    deg[g.eu[e]]++; deg[g.ev[e]]++;
    if (part[g.eu[e]] === part[g.ev[e]]) inside.set(part[g.eu[e]], (inside.get(part[g.eu[e]]) ?? 0) + 1);
  }
  for (let v = 0; v < g.n; v++) tot.set(part[v], (tot.get(part[v]) ?? 0) + deg[v]);
  let q = 0;
  for (const [c, k] of tot) q += (inside.get(c) ?? 0) / g.m - (k / (2 * g.m)) ** 2;
  return q;
}
