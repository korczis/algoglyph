// U-stochastic: bayes-update runs exactly as before on its simulated trials
// (test/u-stochastic/same-runs.ts), and on a reader's outcomes it updates on those outcomes.
// Checked against a closed form that shares no code with the kernel: seven events and three none
// under the flat prior give Beta(8, 4), whose distribution function is the polynomial
// 1320·(x⁸/8 − 3x⁹/9 + 3x¹⁰/10 − x¹¹/11), inverted here by bisection; the mean 2/3 and standard
// deviation √(32/1872). Ten halves count five events and five none: Beta(6, 6), mean ½.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now } from '../../src/kernels/stochastic/bayes-update';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/bayes-update';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('bayes-update', now, before);

// same-runs.ts records the first 30 drawn frames; the whole seeded run, every recorded frame, the
// result and the counts, is compared too, at the defaults, every option and both ends of every range
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  while (!r.done) r.step(1e9);
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts });
};
describe('U-stochastic: bayes-update\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every option and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      else if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const series = (x: number[]) => (id: string): DataTable | null => (id === 'outcomes'
  ? { id, columns: [{ key: 'outcome', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);

function last(x: number[]): Frame {
  const r = new Runner(now, { evidence: optionValue('outcomes'), prior: 'flat', cells: '400', credible: '0.9' }, 7, series(x));
  while (!r.done) r.step(1000);
  return r.frames[r.frames.length - 1];
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';
const numbers = (s: string) => (s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('bayes-update on your outcomes', () => {
  it('seven events and three none: Beta(8, 4), in closed form', () => {
    const f = last([1, 0, 1, 1, 0, 1, 1, 1, 0, 1]);
    const cdf = (x: number) => 1320 * (x ** 8 / 8 - 3 * x ** 9 / 9 + 3 * x ** 10 / 10 - x ** 11 / 11);
    const inv = (q: number) => { let lo = 0; let hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (cdf(m) < q) lo = m; else hi = m; } return lo; };
    expect(value(f, 'Input')).toBe('your data, 10 outcomes');
    expect(value(f, 'Observations')).toBe('10: 7 events, 3 none');
    expect(value(f, 'Closed form Beta mean')).toBe('0.667 for Beta(8.0, 4.0)');
    const [m, sd] = numbers(value(f, 'Posterior mean'));
    expect(Math.abs(m - 2 / 3)).toBeLessThan(1 / 400);
    expect(Math.abs(sd - Math.sqrt(32 / 1872))).toBeLessThan(1 / 400);
    expect(Math.abs(numbers(value(f, 'Closed form lower end'))[0] - inv(0.05))).toBeLessThan(1e-4);
    expect(Math.abs(numbers(value(f, 'Closed form upper end'))[0] - inv(0.95))).toBeLessThan(1e-4);
    const [lo, hi] = numbers(value(f, '90% credible interval'));
    expect(Math.abs(lo - inv(0.05))).toBeLessThanOrEqual(1 / 400 + 1e-4);
    expect(Math.abs(hi - inv(0.95))).toBeLessThanOrEqual(1 / 400 + 1e-4);
    expect(value(f, 'True rate')).toMatch(/^none: /);
    expect(value(f, 'Last observation')).toBe('event');
    expect(f.draws).toBe(0);
  });

  it('a half counts half an event: ten halves give Beta(6, 6)', () => {
    const f = last(Array.from({ length: 10 }, () => 0.5));
    expect(value(f, 'Input')).toBe('your data, 10 outcomes, fractional ones counted as part events');
    expect(value(f, 'Observations')).toBe('10: 5.00 events, 5.00 none');
    expect(value(f, 'Closed form Beta mean')).toBe('0.500 for Beta(6.0, 6.0)');
    expect(Math.abs(numbers(value(f, 'Posterior mean'))[0] - 0.5)).toBeLessThan(1 / 400);
  });
});
