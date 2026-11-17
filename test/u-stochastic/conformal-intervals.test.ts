// U-stochastic: conformal-intervals runs exactly as before on every seeded noise
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's rows it
// splits them anew each experiment. Checked against references that share no code with the
// kernel: rows on a quadratic are fitted exactly at degree 2 and not at degree 1 (the radius is
// round-off, then large); x is mapped from its own range, computed here; and over random splits
// of any fixed rows, the held-out rows are exchangeable with the calibration rows, so the mean
// coverage lies between the level and the level + 1/(n_cal + 1), within the splits' noise.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { mulberry32 } from '../../src/core/random';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type ConformalResult } from '../../src/kernels/stochastic/conformal-intervals';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/conformal-intervals';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('conformal-intervals', now, before);

// same-runs.ts records the first 30 drawn frames; the experiments come after the 60 intro frames,
// so the whole seeded run, every recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: conformal-intervals\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every option and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const rows = (x: number[], y: number[]) => (id: string): DataTable | null => (id === 'rows'
  ? {
    id, columns: [{ key: 'x', unit: '1' }, { key: 'y', unit: '1' }],
    values: [Float64Array.from(x), Float64Array.from(y)], rows: x.length, canonical: '', digest: '',
  }
  : null);

function run(x: number[], y: number[], over: Params): { first: Frame; last: Frame; result: ConformalResult } {
  const r = new Runner(now, { noise: optionValue('rows'), ...over }, 7, rows(x, y));
  while (!r.done) r.step(1000);
  return { first: r.frames[0], last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

describe('conformal-intervals on your rows', () => {
  it('fits a quadratic exactly at degree 2, not at degree 1, with x mapped from its own range', () => {
    // y = 1 − 2x + 3x² at x from 10 to 209, in a scrambled order
    const x = Array.from({ length: 200 }, (_, i) => 10 + ((i * 37) % 200));
    const y = x.map((v) => 1 - 2 * v + 3 * v * v);
    const quad = run(x, y, { degree: 2, reps: 20 });
    // 40% to train, 40% to calibrate, the rest to test
    const [train, cal] = [0.4 * x.length, 0.4 * x.length];
    expect(value(quad.first, 'Input')).toBe(`your data, ${x.length} rows, split anew each experiment: ${train} train, ${cal} calibration, ${x.length - train - cal} test`);
    expect(value(quad.first, 'x mapped onto [0, 1] from')).toBe('[10.0000, 209.0000]');
    // round-off relative to y, which reaches 3 · 209² ≈ 131,000
    expect(quad.result.radius).toBeLessThan(1e-6);
    expect(run(x, y, { degree: 1, reps: 20 }).result.radius).toBeGreaterThan(100);
  });

  it('fits far from the origin as well as near it: x is mapped before the powers are taken', () => {
    // the same quadratic shape at x from 100,000: unmapped, x⁴ ≈ 10²⁰ swamps the normal equations
    const x = Array.from({ length: 200 }, (_, i) => 100_000 + ((i * 37) % 200));
    const y = x.map((v) => 3 * (v - 100_000) ** 2 - 2 * v);
    const { first, result } = run(x, y, { degree: 2, reps: 20 });
    expect(value(first, 'x mapped onto [0, 1] from')).toBe('[100,000.0000, 100,199.0000]');
    // round-off relative to |y|, which reaches about 200,000
    expect(result.radius).toBeLessThan(1e-4);
  });

  it('covers your held-out rows at the guaranteed rate, on average over random splits', () => {
    const rnd = mulberry32(5);
    const x = Array.from({ length: 500 }, () => 100 * rnd());
    // a skewed, heteroscedastic noise: the guarantee needs neither a model nor a noise law
    const y = x.map((v) => Math.sin(v / 9) + (0.2 + v / 100) * (-Math.log(rnd()) - 1));
    const { last, result } = run(x, y, { degree: 3, reps: 400 });
    const nCal = 200;
    // 400 splits of 100 held-out rows: the mean coverage's noise is well under a point
    const at = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
    at.forEach((l, i) => {
      expect(result.coverage[i]).toBeGreaterThan(l - 0.01);
      expect(result.coverage[i]).toBeLessThan(l + 1 / (nCal + 1) + 0.01);
    });
    expect(value(last, 'Experiments')).toBe(`400 of 400, ${x.length - 2 * nCal} test rows each`);
  });

  it('holds the guarantee for an overfitted model too: residuals of rows the fit never saw', () => {
    // 60 rows, 24 to fit a degree-7 polynomial: its training residuals are well below the held-out
    // ones, so a radius calibrated on them would cover too little
    const rnd = mulberry32(9);
    const x = Array.from({ length: 60 }, () => rnd());
    const y = x.map((v) => v + (-Math.log(rnd()) - 1));
    const { result } = run(x, y, { degree: 7, reps: 400 });
    const nCal = 24;
    [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].forEach((l, i) => {
      expect(result.coverage[i]).toBeGreaterThan(l - 0.02);
      expect(result.coverage[i]).toBeLessThan(l + 1 / (nCal + 1) + 0.02);
    });
  });
});
