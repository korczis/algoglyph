// floyd-warshall's distance rows (wave 7a, G6): the plate reported how many pairs are finite but
// nothing about the distances themselves, so no claim could check the matrix. It now gives the
// longest finite distance and the sum of the finite distances, and both are checked here against
// Dijkstra from every vertex, written in this file over the edge list with a plain linear scan for
// the nearest vertex (no heap, no Floyd–Warshall).
import { describe, expect, it } from 'vitest';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'floyd-warshall';
const SEED = 4242;
const N = 22;
/** The plate's aspect for a kernel with a matrix view (src/engines/graph/index.ts aspectOf). */
const ASPECT = 1;
const NONNEGATIVE: Shape[] = ['digraph', 'geometric', 'dag'];

const probe = (readout: string, params: Record<string, number | string> = {}, seed = SEED): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout, expect: { range: [-1e15, 1e15] },
  setup: { params, seed },
});

/** Arcs u -> v of weight w, both ways when undirected. */
function arcs(g: Graph): [number, number][][] {
  const out: [number, number][][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    out[g.eu[e]].push([g.ev[e], g.w[e]]);
    if (!g.directed) out[g.ev[e]].push([g.eu[e], g.w[e]]);
  }
  return out;
}

/** Distances from s by Dijkstra with a linear scan for the nearest open vertex (weights ≥ 0). */
function dijkstraFrom(g: Graph, s: number, adj = arcs(g)): number[] {
  const d = new Array<number>(g.n).fill(Infinity);
  const done = new Array<boolean>(g.n).fill(false);
  d[s] = 0;
  for (;;) {
    let u = -1;
    for (let v = 0; v < g.n; v++) if (!done[v] && Number.isFinite(d[v]) && (u < 0 || d[v] < d[u])) u = v;
    if (u < 0) return d;
    done[u] = true;
    for (const [v, w] of adj[u]) if (d[u] + w < d[v]) d[v] = d[u] + w;
  }
}

/** The longest and the sum of the finite distances over all n² ordered pairs. */
function distanceRows(g: Graph): { longest: number; sum: number; finite: number } {
  const adj = arcs(g);
  let longest = 0; let sum = 0; let finite = 0;
  for (let s = 0; s < g.n; s++) {
    for (const x of dijkstraFrom(g, s, adj)) {
      if (!Number.isFinite(x)) continue;
      finite++; sum += x; longest = Math.max(longest, x);
    }
  }
  return { longest, sum, finite };
}

const graphAt = (shape: Shape, n: number, seed: number) => makeGraph(shape, n, seed, ASPECT);

describe('floyd-warshall: the distance rows (G6)', () => {
  for (const shape of NONNEGATIVE) {
    for (const seed of [SEED, 7]) {
      it(`are Dijkstra's from every vertex on ${shape} at seed ${seed}`, async () => {
        const want = distanceRows(graphAt(shape, N, seed));
        const longest = await read(ID, probe('Longest finite distance', { shape }, seed));
        expect(longest.reason).toBeUndefined();
        expect(longest.value).toBe(want.longest);
        const sum = await read(ID, probe('Sum of finite distances', { shape }, seed));
        expect(sum.reason).toBeUndefined();
        expect(sum.value).toBe(want.sum);
      });
    }
  }
});
