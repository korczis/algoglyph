// U-stochastic: pert-monte-carlo runs exactly as before on its seeded task network
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's tasks it
// simulates them one after another. Checked against references that share no code with the
// kernel: a chain's length has the summed mean (a + λm + b)/(λ + 2) and the summed PERT-Beta
// variance of its tasks, so the simulated mean lies within a few standard errors of that sum; a
// chain of fixed tasks has one length; and a row's three values may come in any order.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type PertResult } from '../../src/kernels/stochastic/pert-monte-carlo';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/pert-monte-carlo';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('pert-monte-carlo', now, before);

// same-runs.ts records the first 30 drawn frames, early in the 140; the whole seeded run, every
// recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: pert-monte-carlo\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const tasks = (rows: number[][]) => (id: string): DataTable | null => (id === 'tasks'
  ? {
    id, columns: ['min', 'mode', 'max'].map((key) => ({ key, unit: 'duration' })),
    values: [0, 1, 2].map((j) => Float64Array.from(rows.map((r) => r[j]))), rows: rows.length, canonical: '', digest: '',
  }
  : null);

function run(rows: number[][], over: Params = {}): { last: Frame; result: PertResult } {
  const r = new Runner(now, { project: optionValue('tasks'), ...over }, 7, tasks(rows));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

/** Mean and variance of a PERT-Beta task on [a, b] with mode m and weight λ, from Beta(α, β). */
function moments([a, m, b]: number[], lambda: number): [number, number] {
  const al = 1 + (lambda * (m - a)) / (b - a);
  const be = 1 + (lambda * (b - m)) / (b - a);
  const mu = a + (b - a) * (al / (al + be));
  const v = (b - a) ** 2 * (al * be) / ((al + be) ** 2 * (al + be + 1));
  return [mu, v];
}

describe('pert-monte-carlo on your tasks', () => {
  const rows = [[2, 3, 9], [1, 1.5, 2], [4, 10, 12], [0, 6, 7], [3, 4, 20]];

  for (const lambda of [0, 4, 10]) {
    it(`a chain's simulated mean is the sum of the task means at λ = ${lambda}`, () => {
      const { last, result } = run(rows, { lambda, n: 20000 });
      const m = rows.map((r) => moments(r, lambda));
      const mu = m.reduce((s, x) => s + x[0], 0);
      const sd = Math.sqrt(m.reduce((s, x) => s + x[1], 0));
      const n = result.finishes.length;
      expect(n).toBe(20000);
      const mean = result.finishes.reduce((s, x) => s + x, 0) / n;
      expect(Math.abs(mean - mu)).toBeLessThan(4 * sd / Math.sqrt(n));
      expect(result.deterministic).toBeCloseTo(mu, 10);
      expect(value(last, 'Input')).toBe('your data, 5 tasks, one after another');
      expect(value(last, 'With every task at its mean')).toMatch(new RegExp(`^${mu.toFixed(1)} `));
      // every task lies on the one path in every run
      expect(result.criticality).toEqual(rows.map(() => 1));
    });
  }

  it('reads each row in any order of its three values', () => {
    const shuffled = rows.map(([a, m, b], i) => [[a, m, b], [b, a, m], [m, b, a], [b, m, a], [a, b, m]][i]);
    expect(JSON.stringify(run(shuffled).result.finishes)).toBe(JSON.stringify(run(rows).result.finishes));
  });

  it('a chain of fixed tasks has one length, drawn from nothing', () => {
    const { last, result } = run([[3, 3, 3], [5, 5, 5], [0.5, 0.5, 0.5]]);
    expect(new Set(result.finishes)).toEqual(new Set([8.5]));
    expect(value(last, 'P50 / P80 / P90')).toBe('8.5 / 8.5 / 8.5');
  });

  it('draws at most 400,000 durations: a hundred tasks get 4,000 runs', () => {
    const many = Array.from({ length: 100 }, (_, i) => [i % 3, 1 + (i % 3), 4 + (i % 5)]);
    const { last, result } = run(many);
    expect(result.finishes.length).toBe(4000);
    expect(value(last, 'Runs')).toBe('4,000 (at most 4,000 for 100 tasks)');
  });
});
