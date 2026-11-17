// U-stochastic: noisy-or runs exactly as before on its seeded causes
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's causes
// it combines those. Checked against a reference that shares no code with the kernel: the
// product form P(effect) = 1 − (1 − leak) Π over present causes of (1 − p), where the kernel
// uses the recurrence q ← q + (1 − q) p; the simulated frequency lies within its sampling error
// of it, and an absent cause changes nothing.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type NoisyOrResult } from '../../src/kernels/stochastic/noisy-or';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/noisy-or';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('noisy-or', now, before);

// same-runs.ts records the first 30 drawn frames, early in the 140; the whole seeded run, every
// recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: noisy-or\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const causes = (rows: number[][]) => (id: string): DataTable | null => (id === 'causes'
  ? {
    id, columns: ['link', 'present'].map((key) => ({ key, unit: '1' })),
    values: [0, 1].map((j) => Float64Array.from(rows.map((r) => r[j]))), rows: rows.length, canonical: '', digest: '',
  }
  : null);

function run(rows: number[][], over: Params): { last: Frame; result: NoisyOrResult } {
  const r = new Runner(now, { causes: optionValue('causes'), ...over }, 7, causes(rows));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

describe('noisy-or on your causes', () => {
  // presences given partly as probabilities: 0.5 and above is present
  const rows = [[0.3, 1], [0.15, 0], [0.6, 0.8], [0.05, 1], [0.9, 0.2], [0.4, 0.5]];
  const product = (leak: number) => 1 - (1 - leak) * rows.reduce((q, [p, on]) => (on >= 0.5 ? q * (1 - p) : q), 1);

  for (const leak of [0, 0.12, 0.3]) {
    it(`combines your present causes and a leak of ${leak} by the product form`, () => {
      const ref = product(leak);
      const { last, result } = run(rows, { leak, n: 50000 });
      expect(value(last, 'Input')).toBe('your data, 6 causes, 4 present');
      expect(result.exact).toBeCloseTo(ref, 12);
      expect(value(last, 'Noisy-OR P(effect)')).toBe(ref.toFixed(4));
      expect(Math.abs(result.estimate - ref)).toBeLessThan(4 * Math.sqrt(ref * (1 - ref) / 50000) + 1e-12);
    });
  }

  it('an absent cause changes nothing', () => {
    const without = rows.filter(([, on]) => on >= 0.5);
    expect(run(without, { leak: 0.1 }).result.exact).toBeCloseTo(run(rows, { leak: 0.1 }).result.exact, 15);
  });
});
