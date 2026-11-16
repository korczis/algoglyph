// personalised-pagerank's readouts (wave 7b).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import type { Stat } from '../src/core/plate';
import { makeGraph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import type { RankResult } from '../src/kernels/graph/_pagerank';
import { kernel } from '../src/kernels/graph/personalised-pagerank';
import { repeatedLabels, settledRows, settledRowsWith } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'personalised-pagerank';
const SUBJECT = 'Subject\'s rank';
const CONVERGED = /^after (\d+) rounds; scores sum to (-?\d+\.\d{6})$/;

const damping = kernel.params?.find((d) => d.key === 'damping');
const DMIN = damping?.kind === 'range' ? damping.min : NaN;
const DMAX = damping?.kind === 'range' ? damping.max : NaN;
const SETTINGS: [string, Record<string, unknown>][] = [
  ...kernel.inputs.map((shape): [string, Record<string, unknown>] => [shape, { shape }]),
  [`damping ${DMIN}`, { damping: DMIN }], [`damping ${DMAX}`, { damping: DMAX }],
  [`digraph, damping ${DMAX}`, { shape: 'digraph', damping: DMAX }],
  [`communities at ${kernel.n?.min}`, { n: kernel.n?.min }],
  [`communities at ${kernel.n?.max}`, { n: kernel.n?.max }],
];

const graphOf = (set: Record<string, unknown>, seed: number) =>
  makeGraph((set.shape ?? kernel.inputs[0]) as Shape, Number(set.n ?? kernel.n?.value), seed, 16 / 9);

// G3. The surfer restarts at the subject with probability 1 - d every round, so the subject's
// score is at least 1 - d (exactly that when nothing flows back to it, as from a digraph source)
// and, the scores being non-negative and summing to one, at most 1. The sum is the conserved
// quantity of the iteration: each round keeps 1 - d of the teleport mass and passes d on, a
// dangling vertex along the teleport vector, so nothing is lost. The Converged row prints it as
// pagerank's does; the subject's rank is printed to four decimals, so its readout is held to the
// lower end rounded the same way (rounding keeps order).
describe('personalised-pagerank reads the subject\'s rank and the sum of the scores (G3)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const d = Number(set.damping ?? damping?.value);
      const rows = await settledRows(ID, set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      const row = rows.find((r) => r.label === SUBJECT);
      expect(row, rows.map((r) => r.label).join(' | ')).toBeDefined();
      const read = Number(row?.value);
      expect(read).toBeGreaterThanOrEqual(Number((1 - d).toFixed(4)));
      expect(read).toBeLessThanOrEqual(1);
      const sum = CONVERGED.exec(rows.find((r) => r.label === 'Converged')?.value ?? '');
      expect(sum, rows.find((r) => r.label === 'Converged')?.value).not.toBeNull();
      expect(Math.abs(Number(sum?.[2]) - 1)).toBeLessThanOrEqual(1e-6);

      const g = graphOf(set, seed);
      const r = trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), ...set } as never }, seed)
        .result as RankResult;
      expect(Number(sum?.[1])).toBe(r.rounds);
      expect(r.rank[g.s]).toBeGreaterThanOrEqual(1 - d);
      expect(r.rank[g.s]).toBeLessThanOrEqual(1 + 1e-12);
      expect(Math.abs(r.rank.reduce((a, x) => a + x, 0) - 1)).toBeLessThanOrEqual(1e-6);
    });
  }
});

// The report before G3, verbatim: the new rows are readout-only, so every other row of a settled
// plate is the same within one run, and the Converged row only gains its sum.
const base: GraphKernel<RankResult> = {
  ...kernel,
  report(r, _g, { s }) {
    let top = -1;
    for (let v = 0; v < r.rank.length; v++) if (v !== s && (top < 0 || r.rank[v] > r.rank[top])) top = v;
    return [
      { label: 'Converged', value: `after ${r.rounds} rounds` },
      { label: 'Closest to the subject', value: top < 0 ? 'none' : `vertex ${top}: ${r.rank[top].toFixed(4)}` },
    ];
  },
};

describe('personalised-pagerank: the subject\'s rank and the sum are the only changes', () => {
  for (const [what, set] of SETTINGS.slice(0, 4)) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const now = await settledRows(ID, set as never, seed);
      const then = await settledRowsWith(ID, base as GraphKernel, set as never, seed);
      const kept = now.filter((r) => r.label !== SUBJECT).map((r): Stat => (r.label === 'Converged'
        ? { ...r, value: r.value.replace(/; scores sum to -?\d+\.\d{6}$/, '') } : r));
      expect(kept).toEqual(then);
      expect(now.find((r) => r.label === 'Converged')?.value)
        .toMatch(new RegExp(`^${then.find((r) => r.label === 'Converged')?.value}; scores sum to `));
      expect(now.length).toBe(then.length + 1);
    });
  }
});
