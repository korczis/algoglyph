// Where breadth-first-search's claims get their figures (catalogue/entries/breadth-first-search.md,
// read by test/claims.test.ts): on the grid from arithmetic on its rows and columns, checked here
// against the graph the plate draws; elsewhere by a computation written in this file that never
// runs a queue: hop distances by unit-weight Floyd–Warshall, reachability by an explicit-stack
// depth-first search over the edge list. The graph is the plate's own input at the claims' seed
// (makeGraph at the plate's 16:9 aspect, source g.s), so a literal pinned to that seed is the
// oracle's, never the kernel's.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from '../src/core/claims';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';

const ID = 'breadth-first-search';
const ASPECT = 16 / 9;
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claimOf = (id: string): Claim => {
  const c = model.entries.find((e) => e.id === ID)?.claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
const valueOf = (id: string) => claimOf(id).expect.value;
const graphOf = (c: Claim, shape: Shape = 'grid', n = 140) => {
  const p = c.setup?.params ?? {};
  return makeGraph((p.shape as Shape) ?? shape, Number(p.n ?? n), c.setup?.seed ?? DEFAULT_SEED, ASPECT);
};

/** The grid's columns and rows as graph.ts lays them out for n vertices at aspect 16:9. */
function gridOf(n: number) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * ASPECT)));
  const rows = Math.max(2, Math.round(n / cols));
  return { rows, cols, n: rows * cols, m: rows * (cols - 1) + (rows - 1) * cols };
}

/** Hop distances between every pair, by Floyd–Warshall with every edge of length 1. */
function hopMatrix(g: Graph): number[][] {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let e = 0; e < g.m; e++) {
    d[g.eu[e]][g.ev[e]] = Math.min(d[g.eu[e]][g.ev[e]], 1);
    if (!g.directed) d[g.ev[e]][g.eu[e]] = Math.min(d[g.ev[e]][g.eu[e]], 1);
  }
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d;
}

/** The vertices reachable from s, by depth-first search with an explicit stack over the edge list. */
function reachable(g: Graph, s: number): boolean[] {
  const seen = new Array<boolean>(g.n).fill(false);
  const stack = [s]; seen[s] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (let e = 0; e < g.m; e++) {
      const v = g.eu[e] === u ? g.ev[e] : !g.directed && g.ev[e] === u ? g.eu[e] : -1;
      if (v >= 0 && !seen[v]) { seen[v] = true; stack.push(v); }
    }
  }
  return seen;
}

describe('breadth-first-search: the claims on the grid follow from its rows and columns', () => {
  it('lays the grid out as the statements derive it', () => {
    for (const n of [8, 140, 400]) {
      const g = makeGraph('grid', n, DEFAULT_SEED, ASPECT);
      const want = gridOf(n);
      expect([g.n, g.m], `n ${n}`).toEqual([want.n, want.m]);
      // the source is the corner 0, so hop distance is the Manhattan distance from it
      expect(g.s).toBe(0);
      expect(Math.max(...hopMatrix(g)[g.s])).toBe(want.rows + want.cols - 2);
    }
  });

  it('pins the levels, the farthest vertex and the scans the claims state', () => {
    const at = (id: string) => gridOf(Number(claimOf(id).setup?.params?.n ?? 140));
    let q = at('levels-on-the-grid');
    expect(valueOf('levels-on-the-grid')).toBe(q.rows + q.cols - 1);
    q = at('farthest-on-the-grid');
    expect(valueOf('farthest-on-the-grid')).toBe(q.rows + q.cols - 2);
    q = at('every-edge-scanned-twice-on-the-grid');
    expect(valueOf('every-edge-scanned-twice-on-the-grid')).toBe(2 * q.m);
    q = at('levels-on-the-largest-grid');
    expect(valueOf('levels-on-the-largest-grid')).toBe(q.rows + q.cols - 1);
    q = at('every-edge-scanned-twice-on-the-largest-grid');
    expect(valueOf('every-edge-scanned-twice-on-the-largest-grid')).toBe(2 * q.m);
    q = at('levels-on-the-smallest-grid');
    expect(valueOf('levels-on-the-smallest-grid')).toBe(q.rows + q.cols - 1);
  });
});

describe('breadth-first-search: the claims elsewhere, from an oracle that runs no queue', () => {
  it('the small world has as many levels as its source’s eccentricity plus one', () => {
    const c = claimOf('small-world-levels');
    const g = graphOf(c);
    expect(g.shape).toBe('small-world');
    expect(c.expect.value).toBe(Math.max(...hopMatrix(g)[g.s]) + 1);
  });

  it('the geometric input is connected, so every vertex is dequeued', () => {
    const g = graphOf(claimOf('every-vertex-dequeued'));
    expect(reachable(g, g.s).every(Boolean)).toBe(true);
  });

  it('on the digraph it dequeues the reachable vertices and scans their out-edges', () => {
    const c = claimOf('digraph-dequeues-the-reachable');
    const g = graphOf(c);
    const seen = reachable(g, g.s);
    expect(c.expect.value).toBe(seen.filter(Boolean).length);
    let out = 0;
    for (let e = 0; e < g.m; e++) if (seen[g.eu[e]]) out++;
    expect(valueOf('digraph-scans-the-reachable-out-edges')).toBe(out);
    expect(graphOf(claimOf('digraph-scans-the-reachable-out-edges')).m).toBe(g.m);
  });
});
