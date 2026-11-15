// sugiyama-layout's readouts (wave 7b). G5: "Edges against the layer order", the edges whose head
// does not sit in a later layer than their tail once the cycles are broken (none: a longest-path
// layering puts every head at least one layer after its tail). Computed here from the Graph's
// edge lists alone: the cycles broken by reversing the back edges of a recursive depth-first
// search (roots in vertex order, each vertex's edges in list order, as the kernel's note
// describes), and the layers by the longest path into each vertex, memoised. And "Dummy nodes":
// an edge spanning k layers is split into k segments by k - 1 dummy nodes, so there are
// sum (span - 1) of them, the segments minus the edges, with the spans from that layering.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/sugiyama-layout';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const AGAINST = 'Edges against the layer order';
const DUMMIES = 'Dummy nodes';
const SHAPES = kernel.inputs as Shape[];
const SEEDS = [DEFAULT_SEED, 7];

/** The edges a depth-first search finds pointing back to a vertex still on its path. */
function backEdges(g: Graph): Set<number> {
  const state = new Array<number>(g.n).fill(0); // 0 unseen, 1 on the path, 2 finished
  const back = new Set<number>();
  const visit = (u: number) => {
    state[u] = 1;
    for (const e of g.out[u]) {
      const v = g.ev[e];
      if (state[v] === 1) back.add(e);
      else if (state[v] === 0) visit(v);
    }
    state[u] = 2;
  };
  for (let r = 0; r < g.n; r++) if (!state[r]) visit(r);
  return back;
}

/** Every edge but a loop, oriented with the back edges reversed, and the longest-path layers. */
function layering(g: Graph) {
  const back = backEdges(g);
  const arcs: [number, number][] = [];
  for (let e = 0; e < g.m; e++) {
    if (g.eu[e] === g.ev[e]) continue;
    arcs.push(back.has(e) ? [g.ev[e], g.eu[e]] : [g.eu[e], g.ev[e]]);
  }
  const into: number[][] = Array.from({ length: g.n }, () => []);
  for (const [a, b] of arcs) into[b].push(a);
  const layer = new Array<number>(g.n).fill(-1);
  const busy = new Array<boolean>(g.n).fill(false);
  const depth = (v: number): number => {
    if (layer[v] >= 0) return layer[v];
    expect(busy[v], `the oriented graph has a cycle through ${v}`).toBe(false);
    busy[v] = true;
    layer[v] = Math.max(0, ...into[v].map((u) => depth(u) + 1));
    busy[v] = false;
    return layer[v];
  };
  for (let v = 0; v < g.n; v++) depth(v);
  return { back, arcs, layer };
}

const value = (rows: { label: string; value: string }[], label: string) =>
  rows.find((r) => r.label === label)?.value;

describe('sugiyama-layout: "Edges against the layer order" (G5)', () => {
  for (const shape of SHAPES) for (const n of [4, 40, 160]) for (const seed of SEEDS) {
    it(`reads the edges whose head is not in a later layer: ${shape}, n ${n}, seed ${seed}`, async () => {
      const g = makeGraph(shape, n, seed, 16 / 9);
      const { back, arcs, layer } = layering(g);
      const against = arcs.filter(([a, b]) => layer[b] <= layer[a]).length;
      expect(against).toBe(0);
      const rows = await settledRows('sugiyama-layout', { shape, n } as never, seed);
      const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
      expect(repeatedLabels(rows), shown).toEqual([]);
      // the plate broke the same cycles and built the same layers as this reference
      expect(value(rows, 'Edges reversed to break cycles'), shown).toBe(String(back.size));
      expect(value(rows, 'Layers'), shown).toBe(String(Math.max(...layer) + 1));
      expect(value(rows, AGAINST), shown).toBe(String(against));
    });
  }
});

describe('sugiyama-layout: "Dummy nodes", the sum of span - 1 over the edges (G5)', () => {
  for (const shape of SHAPES) for (const n of [4, 40, 160]) for (const seed of SEEDS) {
    it(`reads sum (span - 1): ${shape}, n ${n}, seed ${seed}`, async () => {
      const g = makeGraph(shape, n, seed, 16 / 9);
      const { arcs, layer } = layering(g);
      const dummies = arcs.reduce((sum, [a, b]) => sum + layer[b] - layer[a] - 1, 0);
      const rows = await settledRows('sugiyama-layout', { shape, n } as never, seed);
      const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
      expect(repeatedLabels(rows), shown).toEqual([]);
      expect(value(rows, DUMMIES), shown).toBe(String(dummies));
    });
  }
});
