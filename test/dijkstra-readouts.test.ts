// Where dijkstra's claims get their figures (catalogue/entries/dijkstra.md, read by
// test/claims.test.ts). The distances come from a Bellman–Ford written here (rounds of relaxing
// every arc, no priority queue), reachability from an explicit-stack depth-first search, and the
// grid's sizes from arithmetic on its rows and columns; the graph is the plate's own input at the
// claims' seed (makeGraph at the plate's 16:9 aspect, source g.s).
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import type { Claim } from './support/claims';

const ID = 'dijkstra';
const N = 140;
const ASPECT = 16 / 9;
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claimOf = (id: string): Claim => {
  const c = model.entries.find((e) => e.id === ID)?.claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
const graphOf = (c: Claim) => makeGraph((c.setup?.params?.shape as Shape) ?? 'geometric',
  Number(c.setup?.params?.n ?? N), c.setup?.seed ?? DEFAULT_SEED, ASPECT);

/** Distances from s by Bellman–Ford: n − 1 rounds over every arc (both ways when undirected). */
function bellmanFrom(g: Graph, s: number): number[] {
  const dist = new Array<number>(g.n).fill(Infinity);
  dist[s] = 0;
  for (let i = 0; i < g.n - 1; i++) {
    let changed = false;
    for (let e = 0; e < g.m; e++) {
      const [u, v, w] = [g.eu[e], g.ev[e], g.w[e]];
      if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; changed = true; }
      if (!g.directed && dist[v] + w < dist[u]) { dist[u] = dist[v] + w; changed = true; }
    }
    if (!changed) break;
  }
  return dist;
}

/** How many vertices are reachable from s, by depth-first search with an explicit stack. */
function reachable(g: Graph, s: number): number {
  const seen = new Array<boolean>(g.n).fill(false);
  const stack = [s]; seen[s] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (let e = 0; e < g.m; e++) {
      const v = g.eu[e] === u ? g.ev[e] : !g.directed && g.ev[e] === u ? g.eu[e] : -1;
      if (v >= 0 && !seen[v]) { seen[v] = true; stack.push(v); }
    }
  }
  return seen.filter(Boolean).length;
}

describe('dijkstra: the claims’ figures', () => {
  it('the farthest settled distances are Bellman–Ford’s', () => {
    for (const id of ['farthest-is-bellman-ford', 'farthest-is-bellman-ford-on-the-grid']) {
      const c = claimOf(id);
      const g = graphOf(c);
      expect(c.expect.value, id).toBe(Math.max(...bellmanFrom(g, g.s).filter(Number.isFinite)));
    }
  });

  it('the inputs whose every vertex settles are connected', () => {
    for (const id of ['every-vertex-settles', 'one-relaxation-per-edge', 'one-relaxation-per-edge-on-the-grid']) {
      const g = graphOf(claimOf(id));
      expect(reachable(g, g.s), id).toBe(g.n);
    }
  });

  it('the digraph settles its reachable set', () => {
    const c = claimOf('digraph-settles-the-reachable');
    const g = graphOf(c);
    expect(c.expect.value).toBe(reachable(g, g.s));
  });

  it('the grid’s scans and distance bounds follow from its 16 columns and 9 rows', () => {
    const g = graphOf(claimOf('every-edge-scanned-twice-on-the-grid'));
    const cols = Math.round(Math.sqrt(N * ASPECT)); const rows = Math.round(N / cols);
    expect([cols, rows, g.n, g.m]).toEqual([16, 9, rows * cols, rows * (cols - 1) + (rows - 1) * cols]);
    expect(Math.min(...g.w)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...g.w)).toBeLessThanOrEqual(9);
    expect(claimOf('every-edge-scanned-twice-on-the-grid').expect.value).toBe(2 * g.m);
    const hops = rows + cols - 2;
    expect(claimOf('farthest-within-the-weight-bounds-on-the-grid').expect.range).toEqual([hops, 9 * hops]);
  });
});
