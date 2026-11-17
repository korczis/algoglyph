// U-stochastic: tornado-sensitivity runs exactly as before on its seeded ranges
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's ranges
// it swings those through the plate's margin model. Checked against references that share no
// code with the kernel: the model written out here, each input's swing with the others at the
// base case, sorted widest first; and, the model being multilinear in independent inputs, the
// joint Monte Carlo mean against E[v](E[p] − E[c])(1 − E[l]) − E[f], each triangular mean the
// third of its low, base and high.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type TornadoResult } from '../../src/kernels/stochastic/tornado-sensitivity';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/tornado-sensitivity';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('tornado-sensitivity', now, before);

// same-runs.ts records the first 30 drawn frames, inside the tornado's build-up; the whole seeded
// run, every recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: tornado-sensitivity\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);

  // same-runs.ts plants its change on the only range, the joint runs, which acts after the 100
  // frames of the tornado's build-up, past the 30 it records; the whole run sees it
  it('a planted change, the joint runs nudged a step, fails the same comparison', () => {
    expect(whole(now, { n: 8500 }) === whole(before, { n: 8000 })).toBe(false);
  }, 120_000);
});

const ranges = (rows: number[][]) => (id: string): DataTable | null => (id === 'ranges'
  ? {
    id, columns: ['low', 'base', 'high'].map((key) => ({ key, unit: '1' })),
    values: [0, 1, 2].map((j) => Float64Array.from(rows.map((r) => r[j]))), rows: rows.length, canonical: '', digest: '',
  }
  : null);

function run(rows: number[][], over: Params = {}): { last: Frame; result: TornadoResult } {
  const r = new Runner(now, { ranges: optionValue('ranges'), ...over }, 7, ranges(rows));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';
const whole0 = (x: number) => Math.round(x).toLocaleString('en-US');

describe('tornado-sensitivity on your ranges', () => {
  // volume, price, unit cost, loss rate, fixed cost: low, base, high
  const rows = [[900, 1000, 1300], [18, 22, 25], [9, 12, 16], [0.02, 0.05, 0.12], [3000, 4000, 6500]];
  const margin = ([v, p, c, l, f]: number[]) => v * (p - c) * (1 - l) - f;
  const base = rows.map((r) => r[1]);

  it('swings each of your inputs alone through the margin model, widest first', () => {
    const { last, result } = run(rows);
    expect(value(last, 'Input')).toBe('your data, ranges of the 5 inputs');
    expect(result.base).toBeCloseTo(margin(base), 9);
    const swings = rows.map((r, i) => {
      const at = (v: number) => margin(base.map((b, j) => (j === i ? v : b)));
      return { i, w: Math.abs(at(r[2]) - at(r[0])), lo: Math.min(at(r[0]), at(r[2])), hi: Math.max(at(r[0]), at(r[2])) };
    }).sort((a, b) => b.w - a.w);
    expect(result.swings.map((s) => s.i)).toEqual(swings.map((s) => s.i));
    const names = ['volume', 'price', 'unit cost', 'loss rate', 'fixed cost'];
    for (const s of swings.slice(0, 3)) {
      expect(value(last, `Swing of ${names[s.i]}`)).toBe(`${whole0(s.w)} (${whole0(s.lo)} to ${whole0(s.hi)})`);
    }
  });

  it('the joint runs average to the model at the triangular means, the inputs being independent', () => {
    const { result } = run(rows, { n: 40000 });
    const m = rows.map((r) => (r[0] + r[1] + r[2]) / 3);
    const ref = m[0] * (m[1] - m[2]) * (1 - m[3]) - m[4];
    const xs = result.samples;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
    expect(xs.length).toBe(40000);
    expect(Math.abs(mean - ref)).toBeLessThan(4 * sd / Math.sqrt(xs.length));
  });

  it('reads each row in any order of its three values', () => {
    const shuffled = rows.map(([a, b, c], i) => [[c, a, b], [b, c, a], [a, b, c], [c, b, a], [b, a, c]][i]);
    expect(JSON.stringify(run(shuffled).result)).toBe(JSON.stringify(run(rows).result));
  });
});
