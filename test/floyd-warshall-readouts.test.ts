// floyd-warshall's distance rows (wave 7a, G6): the plate reported how many pairs are finite but
// nothing about the distances themselves, so no claim could check the matrix. It now gives the
// longest finite distance and the sum of the finite distances, and both are checked here against
// Dijkstra from every vertex, written in this file over the edge list with a plain linear scan for
// the nearest vertex (no heap, no Floyd–Warshall). The entry's claim literals are checked against
// these oracles and an independent closure, claim by claim.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
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

/** Pairs (i, j) with j reachable from i, i itself included: breadth-first search from every i. */
function closure(g: Graph): number {
  const adj = arcs(g);
  let pairs = 0;
  for (let s = 0; s < g.n; s++) {
    const seen = new Array<boolean>(g.n).fill(false);
    const q = [s]; seen[s] = true;
    for (let h = 0; h < q.length; h++) for (const [v] of adj[q[h]]) if (!seen[v]) { seen[v] = true; q.push(v); }
    pairs += seen.filter(Boolean).length;
  }
  return pairs;
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

describe('floyd-warshall: every claim literal is what the independent oracles give', () => {
  const entry = ENTRIES.find((e) => e.id === ID)!;
  it('has claims', () => expect(entry.claims.length).toBeGreaterThan(0));
  for (const c of entry.claims) {
    it(c.id, () => {
      const p = (c.setup?.params ?? {}) as Record<string, number | string>;
      const shape = String(p.shape ?? 'digraph') as Shape;
      const n = Number(p.n ?? N);
      const seed = c.setup?.seed ?? SEED;
      const g = graphAt(shape, n, seed);
      const x = c.expect;
      if (c.readout === 'Rounds') {
        // one round for the edges, one per intermediate vertex: n + 1, against the Graph row's n
        expect(x).toEqual({ against: 'Graph', offset: 1, tolerance: 0 });
      } else if (c.readout === 'Matrix writes') {
        // each finite entry is written at least once: writes − finite pairs ≥ 0
        expect(x).toEqual({ against: 'Finite distances', above: -1 });
      } else if (c.readout === 'Finite distances') {
        expect(x.value).toBe(closure(g));
      } else if (shape === 'signed') {
        // the signed graph is the digraph re-weighted by a potential: same arcs, and every cycle
        // keeps its weight, so w_signed(u, v) − w_digraph(u, v) = p(u) − p(v) for some p; with every
        // pair reachable the distance shifts p(i) − p(j) cancel over all pairs
        expect(c.readout).toBe('Sum of finite distances');
        const d = graphAt('digraph', n, seed);
        expect([g.eu, g.ev]).toEqual([d.eu, d.ev]);
        expect(closure(g)).toBe(n * n);
        const pot = potentialOf(g, d);
        for (let e = 0; e < g.m; e++) expect(g.w[e] - d.w[e]).toBe(pot[g.eu[e]] - pot[g.ev[e]]);
        expect(x.value).toBe(distanceRows(d).sum);
      } else if (c.readout === 'Longest finite distance' || c.readout === 'Sum of finite distances') {
        expect(NONNEGATIVE).toContain(shape);
        const want = distanceRows(g);
        expect(x.value).toBe(c.readout === 'Longest finite distance' ? want.longest : want.sum);
      } else {
        throw new Error(`no oracle for readout ${c.readout}`);
      }
    });
  }
});

/** A potential p with w_a(e) − w_b(e) = p(u) − p(v) on every edge, by a search over the edges
 * (either way) from vertex 0; a vertex the search misses keeps 0 and fails the check above. */
function potentialOf(a: Graph, b: Graph): number[] {
  const p = new Array<number>(a.n).fill(NaN);
  p[0] = 0;
  for (let changed = true; changed;) {
    changed = false;
    for (let e = 0; e < a.m; e++) {
      const [u, v, dw] = [a.eu[e], a.ev[e], a.w[e] - b.w[e]];
      if (Number.isNaN(p[v]) && !Number.isNaN(p[u])) { p[v] = p[u] - dw; changed = true; }
      if (Number.isNaN(p[u]) && !Number.isNaN(p[v])) { p[u] = p[v] + dw; changed = true; }
    }
  }
  return p.map((x) => (Number.isNaN(x) ? 0 : x));
}
