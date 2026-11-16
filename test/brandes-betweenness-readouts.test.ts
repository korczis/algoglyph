// brandes-betweenness's readouts (wave 7b).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel, type BetweennessResult } from '../src/kernels/graph/brandes-betweenness';
import { repeatedLabels, settledRows, settledRowsWith } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'brandes-betweenness';
const SUM = 'Sum of betweenness';

/** The sum over every pair s < t that is joined of (d(s, t) - 1), with d from a breadth-first
 * search from each vertex over the edge lists alone, never the plate's run. */
function pairHops(g: Graph): number {
  const next: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) { next[g.eu[e]].push(g.ev[e]); next[g.ev[e]].push(g.eu[e]); }
  let sum = 0;
  for (let s = 0; s < g.n; s++) {
    const dist = new Array<number>(g.n).fill(-1);
    dist[s] = 0;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const v of next[queue[i]]) if (dist[v] < 0) { dist[v] = dist[queue[i]] + 1; queue.push(v); }
    }
    for (let t = s + 1; t < g.n; t++) if (dist[t] > 0) sum += dist[t] - 1;
  }
  return sum;
}

const SETTINGS: [string, Record<string, unknown>][] = [
  ...kernel.inputs.map((shape): [string, Record<string, unknown>] => [shape, { shape }]),
  [`communities at ${kernel.n?.min}`, { n: kernel.n?.min }],
  [`communities at ${kernel.n?.max}`, { n: kernel.n?.max }],
  [`random at ${kernel.n?.max}`, { shape: 'random', n: kernel.n?.max }],
];

const graphOf = (set: Record<string, unknown>, seed: number) =>
  makeGraph((set.shape ?? kernel.inputs[0]) as Shape, Number(set.n ?? kernel.n?.value), seed, 16 / 9);

// G1. Each shortest s-t path passes through d(s, t) - 1 interior vertices, and a vertex's
// betweenness is the share of the pair's shortest paths through it, so the pair adds exactly
// d(s, t) - 1 to the sum over all vertices (pairs that are not joined add nothing). The
// readout is the engine's sum of the values written, printed to four significant figures.
describe('brandes-betweenness sums the betweenness to the pairs\' interior hops (G1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const g = graphOf(set, seed);
      expect(g.directed).toBe(false);
      const want = pairHops(g);
      const rows = await settledRows(ID, set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      const row = rows.find((r) => r.label === SUM);
      expect(row, rows.map((r) => r.label).join(' | ')).toBeDefined();
      const half = 0.5 * 10 ** (Math.floor(Math.log10(Math.max(want, 1))) - 3);
      expect(Math.abs(Number(row?.value) - want), `${row?.value} against ${want}`)
        .toBeLessThanOrEqual(half * (1 + 1e-9));
      const r = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) }, seed)
        .result as BetweennessResult;
      expect(Math.abs(r.cb.reduce((a, x) => a + x, 0) - want)).toBeLessThanOrEqual(1e-9 * Math.max(want, 1));
    });
  }

  it('reads the survey\'s value at the default', () => {
    expect(pairHops(graphOf({}, DEFAULT_SEED))).toBe(3597);
  });
});

// The new row is readout-only: the kernel without it, run in the same plate, publishes every
// other row exactly as the kernel with it does, within one run.
const base: GraphKernel<BetweennessResult> = {
  ...kernel,
  names: { ...kernel.names, total: undefined },
  readouts: kernel.readouts?.filter((k) => k !== 'total'),
};

describe('brandes-betweenness: the sum is the only row that changes', () => {
  for (const [what, set] of SETTINGS.slice(0, 3)) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const now = await settledRows(ID, set as never, seed);
      const then = await settledRowsWith(ID, base as GraphKernel, set as never, seed);
      expect(now.filter((r) => r.label !== SUM)).toEqual(then);
      expect(now.length).toBe(then.length + 1);
    });
  }
});
