// U-stochastic: shapley-values runs exactly as before on its seeded model
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's
// coalition values it attributes that game. Checked against references that share no code with
// the kernel: the Shapley value by its subset formula, Σ over S not holding i of
// |S|! (d − |S| − 1)! / d! · (v(S ∪ {i}) − v(S)), where the kernel walks orderings; the three-player
// majority game, where each player gets a third; and a dummy player, who gets nothing.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { mulberry32 } from '../../src/core/random';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type ShapleyResult } from '../../src/kernels/stochastic/shapley-values';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/shapley-values';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('shapley-values', now, before);

// same-runs.ts records the first 30 drawn frames, early in the 150; the whole seeded run, every
// recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: shapley-values\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const game = (v: number[]) => (id: string): DataTable | null => (id === 'game'
  ? { id, columns: [{ key: 'v', unit: '1' }], values: [Float64Array.from(v)], rows: v.length, canonical: '', digest: '' }
  : null);

function run(v: number[], over: Params = {}): { last: Frame; result: ShapleyResult } {
  const r = new Runner(now, { game: optionValue('game'), ...over }, 7, game(v));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

const fact = (k: number): number => (k < 2 ? 1 : k * fact(k - 1));
const bits = (s: number) => s.toString(2).split('').filter((b) => b === '1').length;
/** The Shapley values of the game v on d players, by the subset formula. */
function shapley(v: number[], d: number): number[] {
  return Array.from({ length: d }, (_, i) => {
    let phi = 0;
    for (let s = 0; s < 1 << d; s++) {
      if (s & (1 << i)) continue;
      phi += (fact(bits(s)) * fact(d - bits(s) - 1) / fact(d)) * (v[s | (1 << i)] - v[s]);
    }
    return phi;
  });
}

describe('shapley-values on your game', () => {
  it('the three-player majority game gives each player a third', () => {
    const v = Array.from({ length: 8 }, (_, s) => (bits(s) >= 2 ? 1 : 0));
    const { last, result } = run(v);
    expect(value(last, 'Input')).toBe('your data, 8 coalition values for 3 players');
    result.exact.forEach((e) => expect(e).toBeCloseTo(1 / 3, 12));
  });

  it('its exact values are the subset formula\'s, and a dummy player gets nothing', () => {
    const rnd = mulberry32(3);
    // five players; player 3 (bit 2) adds nothing to any coalition
    const v = new Array<number>(32).fill(0);
    for (let s = 0; s < 32; s++) v[s] = s & 4 ? v[s & ~4] : Math.round(100 * rnd()) / 10;
    const ref = shapley(v, 5);
    const { last, result } = run(v, { m: 4000 });
    result.exact.forEach((e, i) => expect(e, `player ${i + 1}`).toBeCloseTo(ref[i], 10));
    expect(ref[2]).toBeCloseTo(0, 12);
    // every sampled ordering's contributions add to v(all) − v(none): so do the estimates
    expect(result.estimate.reduce((a, b) => a + b, 0)).toBeCloseTo(v[31] - v[0], 10);
    expect(value(last, 'Sum of estimates')).toMatch(new RegExp(`= v\\(all\\) − v\\(none\\) ${(v[31] - v[0]).toFixed(6)}$`));
  });

  it('of 40 values, the first 32 are the game of 5 players', () => {
    const v = Array.from({ length: 40 }, (_, s) => (s < 32 ? bits(s) ** 2 : 1e6));
    const { last, result } = run(v);
    expect(value(last, 'Input')).toBe('your data, 40 coalition values, the first 32 for 5 players');
    expect(result.d).toBe(5);
    shapley(v.slice(0, 32), 5).forEach((r, i) => expect(result.exact[i]).toBeCloseTo(r, 10));
  });
});
