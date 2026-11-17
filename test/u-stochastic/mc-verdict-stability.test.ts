// U-stochastic: mc-verdict-stability runs exactly as before on its seeded evidence
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's evidence
// items it perturbs those. Checked against references that share no code with the kernel: the
// stability in closed form, the sum over every subset S of items that hold up of its chance times
// P(prior + Σ_S (llr + noise) keeps the verdict), a normal tail of mean prior + Σ_S llr and
// variance Σ_S (sd · noise)²; with no noise that tail is a step, and the plate's exact readout.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type VerdictResult } from '../../src/kernels/stochastic/mc-verdict-stability';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/mc-verdict-stability';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('mc-verdict-stability', now, before);

// same-runs.ts records the first 30 drawn frames, early in the 140; the whole seeded run, every
// recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: mc-verdict-stability\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const items = (rows: number[][]) => (id: string): DataTable | null => (id === 'items'
  ? {
    id, columns: ['llr', 'sd', 'reliability'].map((key) => ({ key, unit: '1' })),
    values: [0, 1, 2].map((j) => Float64Array.from(rows.map((r) => r[j]))), rows: rows.length, canonical: '', digest: '',
  }
  : null);

function run(rows: number[][], over: Params): { last: Frame; result: VerdictResult } {
  const r = new Runner(now, { evidence: optionValue('items'), ...over }, 7, items(rows));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

/** Φ by the complementary error function of Numerical Recipes (erfc, |error| < 1.2e-7). */
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const erfc = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
    + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/** The share of runs keeping the verdict, summed over every subset of items that hold up. */
function stability(rows: number[][], prior: number, noise: number): number {
  const baseline = prior + rows.reduce((t, r) => t + r[0], 0) > 0;
  let out = 0;
  for (let set = 0; set < 1 << rows.length; set++) {
    let p = 1; let mu = prior; let v = 0;
    rows.forEach(([llr, sd, rel], i) => {
      if (set & (1 << i)) { p *= rel; mu += llr; v += (sd * noise) ** 2; } else p *= 1 - rel;
    });
    const up = v > 0 ? phi(mu / Math.sqrt(v)) : mu > 0 ? 1 : 0;
    out += p * (baseline ? up : 1 - up);
  }
  return out;
}

describe('mc-verdict-stability on your evidence items', () => {
  const rows = [[1.2, 0.3, 0.9], [-0.8, 0.5, 0.7], [2.1, 1.0, 0.55], [0.4, 0.2, 0.95], [-1.5, 0.6, 0.6]];

  it('with no strength noise, its exact stability is the enumeration over your items', () => {
    const exact = stability(rows, -1, 0);
    const { last, result } = run(rows, { prior: -1, noise: 0, n: 40000 });
    expect(value(last, 'Input')).toBe('your data, 5 evidence items');
    expect(value(last, 'Exact stability (no strength noise)')).toBe(`${(100 * exact).toFixed(1)}%`);
    expect(value(last, 'Verdict as given')).toBe('supported (log-odds 0.40)');
    expect(Math.abs(result.stability - exact)).toBeLessThan(4 * Math.sqrt(exact * (1 - exact) / 40000));
  });

  it('with strength noise, its simulated stability is the closed form within its sampling error', () => {
    for (const [prior, noise] of [[-1, 1], [0.5, 2.5]]) {
      const ref = stability(rows, prior, noise);
      const { result } = run(rows, { prior, noise, n: 40000 });
      expect(Math.abs(result.stability - ref), `prior ${prior}, noise ${noise}`).toBeLessThan(4 * Math.sqrt(ref * (1 - ref) / 40000));
    }
  });
});
