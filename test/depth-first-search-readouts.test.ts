// Where depth-first-search's claims get their figures (catalogue/entries/depth-first-search.md,
// read by test/claims.test.ts). On an undirected input every edge the search does not take into
// its tree joins a vertex to an ancestor or a descendant, and it is examined first from the
// descendant, while the ancestor is still grey (one back edge), then from the ancestor, when the
// descendant is black (not counted); the tree edge into a vertex is skipped from that vertex. So
// with c trees: tree edges n − c, back edges m − n + c (the cyclomatic number), edges examined
// (n − c) + 2(m − n + c). The grid's figures follow from its rows and columns; the component count
// and the digraph's cycle come from computations written here, a union-find over the edge list and
// Kahn's peeling, never a depth-first search.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from '../src/core/claims';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, type DfsResult } from '../src/kernels/graph/depth-first-search';

const ID = 'depth-first-search';
const ASPECT = 16 / 9;
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claimOf = (id: string): Claim => {
  const c = model.entries.find((e) => e.id === ID)?.claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
const graphOf = (c: Claim) => {
  const p = c.setup?.params ?? {};
  return makeGraph((p.shape as Shape) ?? 'geometric', Number(p.n ?? 90), c.setup?.seed ?? DEFAULT_SEED, ASPECT);
};

/** Connected components by union-find over the edge list. */
function components(g: Graph): number {
  const p = Array.from({ length: g.n }, (_, i) => i);
  const f = (a: number): number => (p[a] === a ? a : (p[a] = f(p[a])));
  for (let e = 0; e < g.m; e++) p[f(g.eu[e])] = f(g.ev[e]);
  return new Set(p.map((_, i) => f(i))).size;
}

/** Whether a digraph has a cycle: Kahn's peeling of in-degree-0 vertices leaves some behind. */
function cyclic(g: Graph): boolean {
  const indeg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) indeg[g.ev[e]]++;
  const q = indeg.flatMap((d, v) => (d ? [] : [v]));
  for (let h = 0; h < q.length; h++) {
    for (let e = 0; e < g.m; e++) if (g.eu[e] === q[h] && --indeg[g.ev[e]] === 0) q.push(g.ev[e]);
  }
  return q.length < g.n;
}

describe('depth-first-search: the forest identities on undirected inputs', () => {
  it('tree edges n − c, back edges m − n + c, edges examined (n − c) + 2(m − n + c)', () => {
    for (const shape of ['geometric', 'grid', 'random', 'small-world'] as Shape[]) {
      for (const n of [8, 40, 90, 300]) for (const seed of [7, 11, DEFAULT_SEED]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) }, seed);
        const r = t.result as DfsResult;
        const c = components(g);
        const at = `${shape} n ${n} seed ${seed}`;
        expect(r.parent.filter((p) => p < 0).length, at).toBe(c);
        expect(r.back, at).toBe(g.m - g.n + c);
        expect(t.counts.scans, at).toBe(g.n - c + 2 * (g.m - g.n + c));
      }
    }
  });
});

describe('depth-first-search: the claims’ figures', () => {
  it('the geometric input is connected and has exactly n vertices, so the offsets are n − 1', () => {
    for (const id of ['tree-edges-span-the-graph', 'back-edges-are-the-cyclomatic-number']) {
      const g = graphOf(claimOf(id));
      expect(components(g)).toBe(1);
      expect(g.n).toBe(90);
    }
    expect(claimOf('tree-edges-span-the-graph').expect.offset).toBe(-1);
    expect(claimOf('back-edges-are-the-cyclomatic-number').expect.offset).toBe(-(90 - 1));
  });

  it('on the 13-by-7 grid: (rows − 1)(cols − 1) back edges and 2m − n + 1 edges examined', () => {
    const g = graphOf(claimOf('back-edges-on-the-grid'));
    const cols = Math.round(Math.sqrt(90 * ASPECT)); const rows = Math.round(90 / cols);
    expect([cols, rows, g.n, g.m]).toEqual([13, 7, 91, rows * (cols - 1) + (rows - 1) * cols]);
    expect(claimOf('back-edges-on-the-grid').expect.value).toBe((rows - 1) * (cols - 1));
    expect(claimOf('back-edges-on-the-grid').expect.value).toBe(g.m - g.n + 1);
    expect(claimOf('edges-examined-on-the-grid').expect.value).toBe(2 * g.m - g.n + 1);
  });

  it('the random input’s trees are its components, counted by union-find', () => {
    const g = graphOf(claimOf('trees-are-the-components'));
    const c = components(g);
    expect(claimOf('trees-are-the-components').expect.value).toBe(c);
    expect(claimOf('tree-edges-with-several-trees').expect.offset).toBe(-c);
    expect(claimOf('back-edges-with-several-trees').expect.offset).toBe(-(g.n - c));
  });

  it('the digraph has a cycle by Kahn’s peeling, so a depth-first search finds a back edge', () => {
    expect(cyclic(graphOf(claimOf('a-cyclic-digraph-has-a-back-edge')))).toBe(true);
  });
});
