// bridges' readouts (wave 7b). D4: the row "DFS tree edges" read the tree edges minus the
// bridges, because the kernel repaints each bridge from the tree to the cut state at the end
// (bridges.ts) and the replay stops counting an edge as a tree edge when it is repainted
// (src/engines/graph/index.ts, setE). That decrement is the engine's meaning of its tree
// readout, and euler-tour's "Walked, not yet in the tour" relies on it, so the fix is in the
// kernel: the engine row is named for what it counts, and the report adds the depth-first
// forest's true size. A forest on n vertices with c trees has n - c edges; c is computed here
// independently, by a breadth-first search over the Graph's edge lists.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/bridges';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

/** The number of connected components, by a breadth-first search from every unreached vertex. */
function components(g: Graph): number {
  const adj: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) { adj[g.eu[e]].push(g.ev[e]); adj[g.ev[e]].push(g.eu[e]); }
  const seen = new Array<boolean>(g.n).fill(false);
  let c = 0;
  for (let s = 0; s < g.n; s++) {
    if (seen[s]) continue;
    c++;
    seen[s] = true;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const v of adj[queue[i]]) if (!seen[v]) { seen[v] = true; queue.push(v); }
    }
  }
  return c;
}

/** The number of bridges, by removing each edge in turn and counting the components again. */
function bridgesByRemoval(g: Graph): number {
  const c = components(g);
  let k = 0;
  for (let e = 0; e < g.m; e++) {
    const keep = Array.from({ length: g.m }, (_, f) => f).filter((f) => f !== e);
    const h = { ...g, m: keep.length, eu: keep.map((f) => g.eu[f]), ev: keep.map((f) => g.ev[f]) };
    if (components(h as Graph) > c) k++;
  }
  return k;
}

const SHAPES = kernel.inputs as Shape[];
const value = (rows: { label: string; value: string }[], label: string) =>
  rows.find((r) => r.label === label)?.value;

describe('bridges: "DFS tree edges" is the depth-first forest, n - c (D4)', () => {
  it('reads 60 on the random input at seed 4242 (70 vertices, 10 components)', async () => {
    const g = makeGraph('random', 70, DEFAULT_SEED, 16 / 9);
    const c = components(g);
    expect(g.n - c).toBe(60);
    const rows = await settledRows('bridges', { shape: 'random' } as never, DEFAULT_SEED);
    expect(value(rows, 'Graph')).toBe(`${g.n} vertices, ${g.m} edges`);
    expect(value(rows, 'DFS tree edges'), rows.map((r) => `${r.label}: ${r.value}`).join(' | '))
      .toBe(String(g.n - c));
  });

  for (const shape of SHAPES) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${shape}, seed ${seed}: n - c, the rest of the forest beside the bridges`, async () => {
      const g = makeGraph(shape, 70, seed, 16 / 9);
      const c = components(g);
      const rows = await settledRows('bridges', { shape } as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(value(rows, 'Graph')).toBe(`${g.n} vertices, ${g.m} edges`);
      expect(value(rows, 'DFS tree edges')).toBe(String(g.n - c));
      // every bridge is a tree edge, so the engine's row is the forest less the bridges
      const bridges = bridgesByRemoval(g);
      expect(value(rows, 'Bridges')).toBe(String(bridges));
      expect(value(rows, 'Tree edges that are not bridges')).toBe(String(g.n - c - bridges));
    });
  }
});
