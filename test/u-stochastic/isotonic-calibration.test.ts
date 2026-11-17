// U-stochastic: isotonic-calibration runs exactly as before on every seeded miscalibration
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's cases it
// fits half of them and measures the other half. Checked against references that share no code
// with the kernel: the isotonic fit by its min–max formula, fitted(i) = max over j ≤ i of the
// min over k ≥ i of the mean of labels j..k, and the held-out Brier scores before and after,
// computed here from the cases the fit did not take.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type IsotonicResult } from '../../src/kernels/stochastic/isotonic-calibration';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/isotonic-calibration';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('isotonic-calibration', now, before);

// same-runs.ts records the first 30 drawn frames; the held-out measurement comes at the end, so
// the whole seeded run, every recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: isotonic-calibration\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every miscalibration and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const cases = (p: number[], y: number[]) => (id: string): DataTable | null => (id === 'cases'
  ? {
    id, columns: [{ key: 'p', unit: '1' }, { key: 'y', unit: '1' }],
    values: [Float64Array.from(p), Float64Array.from(y)], rows: p.length, canonical: '', digest: '',
  }
  : null);

function run(p: number[], y: number[]): { last: Frame; result: IsotonicResult } {
  const r = new Runner(now, { distortion: optionValue('cases') }, 7, cases(p, y));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

/** The isotonic regression of y by its min–max formula, O(n³): no pooling, no stack. */
function minMax(y: number[]): number[] {
  return y.map((_, i) => {
    let best = -Infinity;
    for (let j = 0; j <= i; j++) {
      let low = Infinity;
      for (let k = i; k < y.length; k++) {
        let s = 0;
        for (let q = j; q <= k; q++) s += y[q];
        low = Math.min(low, s / (k - j + 1));
      }
      best = Math.max(best, low);
    }
    return best;
  });
}

describe('isotonic-calibration on your cases', () => {
  // 41 distinct predictions, outcomes given partly as probabilities (0.5 and above is 1)
  const p = Array.from({ length: 41 }, (_, i) => (i * 17 % 41) / 41 + 0.001);
  const y = p.map((x, i) => (i % 5 === 0 ? 0.6 : i % 7 === 0 ? 0.3 : x > 0.4 ? 1 : 0) * (i % 3 === 0 ? 1 - x : 1));
  const outcome = y.map((v) => (v >= 0.5 ? 1 : 0));

  it('fits the half it takes by the isotonic regression, in score order', () => {
    const { last, result } = run(p, y);
    expect(value(last, 'Input')).toBe('your data, 41 cases: 21 fitted, 20 held out');
    expect(result.score.length).toBe(21);
    // every fitted case is one of yours, with its own outcome, in ascending score
    for (let i = 0; i < 21; i++) {
      const at = p.indexOf(result.score[i]);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(result.label[i]).toBe(outcome[at]);
      if (i) expect(result.score[i]).toBeGreaterThan(result.score[i - 1]);
    }
    const ref = minMax(result.label);
    result.fitted.forEach((f, i) => expect(f).toBeCloseTo(ref[i], 12));
  });

  it('measures the Brier score on the cases it held out, before and after', () => {
    const { last, result } = run(p, y);
    const fitted = new Set(result.score);
    const held = p.map((_, i) => i).filter((i) => !fitted.has(p[i]));
    expect(held.length).toBe(20);
    const beforeRef = held.reduce((s, i) => s + (p[i] - outcome[i]) ** 2, 0) / held.length;
    // after: each held-out prediction takes the fit of the largest fitted score at or below it
    const map = (x: number) => {
      let k = 0;
      for (let i = 0; i < result.score.length; i++) if (result.score[i] <= x) k = i;
      return result.fitted[k];
    };
    const afterRef = held.reduce((s, i) => s + (map(p[i]) - outcome[i]) ** 2, 0) / held.length;
    expect(result.brierBefore).toBeCloseTo(beforeRef, 12);
    expect(result.brierAfter).toBeCloseTo(afterRef, 12);
    expect(value(last, 'Brier score (held out)')).toBe(`${beforeRef.toFixed(4)} → ${afterRef.toFixed(4)}`);
  });

  it('draws no true curve: nothing says how your outcomes were drawn', () => {
    const { last } = run(p, y);
    const fit = last.panels[0];
    expect(fit.kind === 'plot' && fit.lines?.some((l) => l.dash)).toBe(false);
  });
});
