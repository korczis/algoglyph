// articulation-points' readouts (wave 7b). D1: the engine's marked readout is labelled
// "Articulation points" (the kernel's names.marked), and the kernel's own report added a second
// row with the same label and value: a claim reads only the first row with its label, so a
// settled plate's labels must be unique. The marks are set only after the search ends, so the
// engine's row never counted anything live; the report's row stays.
// G6: "Articulation points on a cycle", the cut vertices lying in a biconnected block with at
// least two edges, against the belief that a vertex on a cycle cannot separate the graph. The
// reference is brute force over the Graph's edge lists: a vertex is a cut vertex when deleting it
// leaves more components, and it lies on a cycle when one of its edges does, which is when
// deleting that edge leaves its two ends connected.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['geometric', {}], ['small-world', { shape: 'small-world' }], ['random', { shape: 'random' }],
  ['islands', { shape: 'islands' }], ['geometric at 300', { n: 300 }], ['geometric at 6', { n: 6 }],
];

describe('articulation-points: a settled plate publishes each readout label once (D1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('articulation-points', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Articulation points');
      expect(rows.map((r) => r.label)).toContain('Biconnected blocks');
    });
  }
});

/** Components of the graph with vertex `gone` and edge `cut` deleted, by breadth-first search;
 * with `from`, whether `to` is reached from it instead. */
function search(g: Graph, gone: number, cut: number, from = -1, to = -1): number | boolean {
  const adj: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    if (e === cut || g.eu[e] === gone || g.ev[e] === gone) continue;
    adj[g.eu[e]].push(g.ev[e]); adj[g.ev[e]].push(g.eu[e]);
  }
  const seen = new Array<boolean>(g.n).fill(false);
  let c = 0;
  for (let s = from >= 0 ? from : 0; s < g.n; s++) {
    if (seen[s] || s === gone) continue;
    c++;
    seen[s] = true;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const v of adj[queue[i]]) if (!seen[v]) { seen[v] = true; queue.push(v); }
    }
    if (from >= 0) return seen[to];
  }
  return c;
}

function cutVerticesOnCycles(g: Graph): { cut: number; onCycle: number } {
  const base = search(g, -1, -1) as number;
  let cut = 0; let onCycle = 0;
  for (let v = 0; v < g.n; v++) {
    if ((search(g, v, -1) as number) <= base) continue;
    cut++;
    let cyclic = false;
    for (let e = 0; e < g.m && !cyclic; e++) {
      if (g.eu[e] === g.ev[e] || (g.eu[e] !== v && g.ev[e] !== v)) continue;
      cyclic = search(g, -1, e, g.eu[e], g.ev[e]) as boolean;
    }
    if (cyclic) onCycle++;
  }
  return { cut, onCycle };
}

describe('articulation-points: "Articulation points on a cycle" (G6)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`counts the cut vertices with an edge on a cycle: ${what}, seed ${seed}`, async () => {
      const shape = ((set as { shape?: Shape }).shape ?? 'geometric') as Shape;
      const n = Number((set as { n?: number }).n ?? 70);
      const { cut, onCycle } = cutVerticesOnCycles(makeGraph(shape, n, seed, 16 / 9));
      const rows = await settledRows('articulation-points', set as never, seed);
      const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
      expect(repeatedLabels(rows), shown).toEqual([]);
      expect(rows.find((r) => r.label === 'Articulation points')?.value, shown).toBe(String(cut));
      expect(rows.find((r) => r.label === 'Articulation points on a cycle')?.value, shown)
        .toBe(String(onCycle));
    });
  }
});
