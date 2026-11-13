// catalogue/entries/euclidean-mst.md: the minimum spanning tree of all n(n − 1)/2 pairs, found
// among the edges of the points' Delaunay triangulation. The triangulation is the site's one
// (src/plates/_shared/delaunay: exact lattice predicates, a symbolic infinite vertex), so it
// keeps every hull edge: a triangulation of n points with h on its boundary has exactly
// 3n − 3 − h edges (Euler: with t triangles, 3t + h = 2e and n − e + (t + 1) = 2, so
// t = 2n − 2 − h and e = 3n − 3 − h).
//
// The plate's points are not on any lattice (graph.ts scatters them as raw seeded floats), so the
// kernel snaps them to the finest lattice their bounding box allows, which moves them by up to
// half a step (about 2e-4, the input being 16/9 wide). h is therefore counted on those lattice
// points, exactly, by a monotone chain of its own. Where a point lies within a step of a hull
// chord the snap can make it a corner or take it off: at the default n 70, seed 7, two do
// (points 17 and 32, 2.3e-6 and 1.7e-4 inside the chords 35–46 and 56–69 past them, the step
// being 4.3e-4), so the lattice hull has 12 points where the true one has 10, and
// 195 = 3 · 70 − 3 − 12 is right there; the old float triangulation had 195 there as well, by
// losing exactly those two chords. The tree is the one thing the snap must not change: it is
// checked against an all-pairs Prim on the true coordinates, at the defaults and across a seed
// sweep.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { E, OP, defaultParams, trace } from '../src/engines/graph/trace';
import { LATTICE } from '../src/plates/_shared/delaunay/delaunay';
import { kernel } from '../src/kernels/graph/euclidean-mst';
import type { MstResult } from '../src/kernels/graph/_mst';

/** The points as the kernel documents its snap: the bounding box's longer side on LATTICE − 1. */
function lattice(x: number[], y: number[]): { X: number[]; Y: number[] } {
  const x0 = Math.min(...x); const y0 = Math.min(...y);
  const s = (LATTICE - 1) / Math.max(Math.max(...x) - x0, Math.max(...y) - y0);
  return { X: x.map((v) => Math.round((v - x0) * s)), Y: y.map((v) => Math.round((v - y0) * s)) };
}

/**
 * Points on the hull's boundary, corners and points on its edges alike, by Andrew's monotone
 * chain; `strict` keeps corners only. Exact on lattice points (integer products below 2^25).
 */
function hullSize(x: number[], y: number[], strict = false): number {
  const ids = x.map((_, i) => i).sort((a, b) => x[a] - x[b] || y[a] - y[b]);
  const cross = (o: number, a: number, b: number) =>
    (x[a] - x[o]) * (y[b] - y[o]) - (y[a] - y[o]) * (x[b] - x[o]);
  const chain = (order: number[]) => {
    const out: number[] = [];
    for (const p of order) {
      while (out.length >= 2) {
        const c = cross(out[out.length - 2], out[out.length - 1], p);
        if (c > 0 || (c === 0 && !strict)) break;
        out.pop();
      }
      out.push(p);
    }
    return out;
  };
  return chain(ids).length + chain([...ids].reverse()).length - 2;
}

/** h of the points the triangulation is given. */
const latticeHull = (g: Graph) => { const { X, Y } = lattice(g.x, g.y); return hullSize(X, Y); };

/** The tree of a dense Prim over every pair, on true Euclidean lengths: sorted pairs. */
function primTree(x: number[], y: number[]): string[] {
  const n = x.length;
  const inTree = new Array<boolean>(n).fill(false);
  const key = new Array<number>(n).fill(Infinity);
  const via = new Array<number>(n).fill(-1);
  key[0] = 0;
  const out: string[] = [];
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!inTree[v] && (u < 0 || key[v] < key[u])) u = v;
    inTree[u] = true;
    if (via[u] >= 0) out.push(`${Math.min(u, via[u])}-${Math.max(u, via[u])}`);
    for (let v = 0; v < n; v++) {
      const d = Math.hypot(x[u] - x[v], y[u] - y[v]);
      if (!inTree[v] && d < key[v]) { key[v] = d; via[v] = u; }
    }
  }
  return out.sort();
}

const run = (g: Graph) => trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) });

/** The triangulation's edges: the ones the kernel shows examined before its first round. */
function triangulated(t: ReturnType<typeof run>): number {
  const seen = new Set<number>();
  for (let i = 0; i < t.length; i++) {
    const op = t.events[5 * i];
    if (op === OP.round) break;
    if (op === OP.edge && t.events[5 * i + 2] === E.seen) seen.add(t.events[5 * i + 1]);
  }
  return seen.size;
}

const treeOf = (g: Graph, r: MstResult) =>
  r.tree.map((e) => `${Math.min(g.eu[e], g.ev[e])}-${Math.max(g.eu[e], g.ev[e])}`).sort();

/** The plate's input at n points and a seed: graph.ts's 'points' at the plate's 16:9. */
const points = (n: number, seed: number) => makeGraph('points', n, seed, 16 / 9);

const SEEDS = [DEFAULT_SEED, ...Array.from({ length: 200 }, (_, i) => i + 1)];
const SIZES = [3, 4, 5, 10, 70, 150];

describe('euclidean-mst triangulation keeps every hull edge (D1)', () => {
  it('has 3n − 3 − h edges at the default n 70, seed 1', () => {
    const g = points(70, 1);
    const h = latticeHull(g);
    expect(h).toBe(9);
    expect(triangulated(run(g)), `3n − 3 − h = ${3 * 70 - 3 - h}`).toBe(3 * 70 - 3 - h);
  });

  it('has 3n − 3 − h edges at n 70, seed 7, where the snap makes 12 hull points of 10', () => {
    const g = points(70, 7);
    expect(hullSize(g.x, g.y, true)).toBe(10);
    expect(latticeHull(g)).toBe(12);
    expect(triangulated(run(g))).toBe(3 * 70 - 3 - 12);
  });

  it('has 3n − 3 − h edges for every size and seed of the sweep', () => {
    const wrong: string[] = [];
    for (const n of SIZES) for (const seed of SEEDS) {
      const g = points(n, seed);
      const want = 3 * n - 3 - latticeHull(g);
      const got = triangulated(run(g));
      if (got !== want) wrong.push(`n ${n} seed ${seed}: ${got} of ${want}`);
    }
    expect(wrong).toEqual([]);
  });

  it('finds the all-pairs Prim tree on true lengths, at the defaults and across the sweep', () => {
    const wrong: string[] = [];
    for (const n of SIZES) for (const seed of SEEDS) {
      const g = points(n, seed);
      const r = run(g).result as MstResult;
      const got = treeOf(g, r);
      const want = primTree(g.x, g.y);
      if (got.join() !== want.join()) wrong.push(`n ${n} seed ${seed}`);
    }
    expect(wrong).toEqual([]);
  });

  it('still finds the Prim tree when points share a lattice point or all lie on one line', () => {
    const cases: [string, number[], number[]][] = [
      // points 0 and 1, and points 4 and 5, 1e-7 apart: each pair snaps onto one lattice point
      ['merged by the snap', [0.1, 0.1 + 1e-7, 0.9, 0.5, 1.2, 1.2 + 1e-7, 0.3],
        [0.2, 0.2, 0.8, 0.5, 0.3, 0.3 - 1e-7, 0.9]],
      ['on one line', [0.3, 0.1, 0.9, 0.5, 1.7, 1.2], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]],
    ];
    for (const [what, x, y] of cases) {
      const g = points(x.length, DEFAULT_SEED);
      g.x.splice(0, g.n, ...x);
      g.y.splice(0, g.n, ...y);
      expect(treeOf(g, run(g).result as MstResult), what).toEqual(primTree(x, y));
    }
  });
});

// The entry's claims, from the plate's readouts; their literals are computed here independently.
// The tree weight is the sum of graph.ts's integer edge weights (rounded lengths) over the tree:
// the all-pairs Prim tree on true lengths is a minimum spanning tree, and the kernel's tree is
// that very tree (checked above), so its integer weight is the claim's value, read off a
// different algorithm over every pair, never off the plate. The edges examined lie in
// [n − 1, 3n − 6]: Kruskal stops at the (n − 1)-th tree edge and each tree edge is a scan, and it
// scans only the triangulation's edges, of which a triangulation of n ≥ 3 points has
// 3n − 3 − h ≤ 3n − 6 (Euler's formula, as above, with h ≥ 3; all on one line, n − 1). That the
// Euclidean MST lies inside the Delaunay triangulation (every EMST edge has an empty diametral
// circle, so it is a Gabriel edge, and every Gabriel edge is a Delaunay edge) is why the tree
// found there is the true one.
interface EntryClaim {
  id: string; readout: string; expect: { value?: number };
  setup?: { params?: Record<string, unknown>; seed?: number };
}
interface Entry { id: string; claims: EntryClaim[] }

describe('euclidean-mst claims, from an independent computation', () => {
  it('states the all-pairs Prim tree weight at each setting it claims', async () => {
    // @ts-expect-error -- plain ESM shared with the node tooling
    const { loadCatalogue } = await import('../scripts/lib/catalogue.mjs');
    const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };
    const entry = model.entries.find((e) => e.id === 'euclidean-mst') as Entry;
    const weights = entry.claims.filter((c) => c.readout === 'Weight of the tree edges');
    expect(weights.length).toBeGreaterThanOrEqual(3);
    for (const c of weights) {
      const n = Number(c.setup?.params?.n ?? 70);
      const g = points(n, c.setup?.seed ?? DEFAULT_SEED);
      const at = new Map<string, number>();
      for (let e = 0; e < g.m; e++) at.set(`${g.eu[e]}-${g.ev[e]}`, g.w[e]);
      const w = primTree(g.x, g.y).reduce((s, k) => s + (at.get(k) as number), 0);
      expect(c.expect.value, c.id).toBe(w);
    }
  });

  it('examines between n − 1 and 3n − 6 edges across the sweep', () => {
    const wrong: string[] = [];
    for (const n of SIZES) for (const seed of SEEDS) {
      const scans = run(points(n, seed)).counts.scans;
      if (scans < n - 1 || scans > 3 * n - 6) wrong.push(`n ${n} seed ${seed}: ${scans}`);
    }
    expect(wrong).toEqual([]);
  });
});
