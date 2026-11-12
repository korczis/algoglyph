// conformal-intervals' fixed constants become controls (S4 A3-A4). The plate showed the 90%
// level of the coverage it measures at every nominal level (src/kernels/stochastic/_coverage.ts
// SHOWN_LEVEL) and fitted on 80 training cases; both are now controls whose defaults are the old
// constants, so the default run is the old run. The oracle is exact: for exchangeable cases the
// split conformal interval at level l with n calibration cases covers ⌈(n + 1) l⌉ / (n + 1) of
// new cases on average, which lies in [l, l + 1/(n + 1)), whatever the model or its training.
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as conformal, type ConformalResult } from '../src/kernels/stochastic/conformal-intervals';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'conformal-intervals';
const k = conformal as StochasticKernel<ConformalResult>;
const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
const TEST = 200;
const defOf = (key: string) => k.params?.find((d) => d.key === key);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
const covering = (l: number) => `${Math.round(l * 100)}% intervals covering`;

/** Three standard errors of the coverage averaged over `reps` experiments: the coverage given
 * the calibration draw is Beta(k, n + 1 − k) with k = ⌈(n + 1) l⌉, and each experiment counts it
 * on TEST fresh cases. */
function band(l: number, n: number, reps: number): [number, number] {
  const kk = Math.ceil((n + 1) * l);
  const mu = kk / (n + 1);
  const v = (kk * (n + 1 - kk)) / ((n + 1) ** 2 * (n + 2));
  const se = Math.sqrt((v + (mu * (1 - mu) - v) / TEST) / reps);
  return [100 * (l - 3 * se), 100 * (l + 1 / (n + 1) + 3 * se)];
}

async function roundTrips(key: string, values: (string | number)[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

describe('conformal-intervals: nominal level shown', () => {
  const KEY = 'level';

  it('is a select control of the measured levels with the old 90% as its default', async () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'select', label: 'Nominal level shown', value: '0.9', rebuild: true });
    expect((defOf(KEY) as SelectParam).options.map((o) => Number(o.value))).toEqual(LEVELS);
    expect((await loadPlate(ID))!.params.find((x) => x.key === KEY)).toEqual(defOf(KEY));
  });

  it('round-trips through a shared link', async () => {
    await roundTrips(KEY, ['0.5', '0.8', '0.95']);
  });

  it('shows the level chosen, read from the same measured coverage, the draws unchanged', () => {
    const base = trace(k, { reps: 30 }, 5);
    for (const l of LEVELS) {
      const t = trace(k, { [KEY]: String(l), reps: 30 }, 5);
      expect(t.draws, `${l}`).toBe(base.draws);
      expect(t.result.coverage).toEqual(base.result.coverage);
      const rows = Object.fromEntries(t.frames.at(-1)!.stats.map((s) => [s.label, s.value]));
      expect(rows[covering(l)], `${l}`).toBe(`${(100 * t.result.coverage[LEVELS.indexOf(l)]).toFixed(1)}% (guarantee: at least ${Math.round(l * 100)}%)`);
      // the radius shown is the ⌈(n + 1) l⌉-th smallest residual of the first experiment
      const kk = Math.ceil(61 * l);
      expect(t.result.radius).toBe(kk > 60 ? Infinity : t.result.residuals[kk - 1]);
    }
  });

  it('drives the readouts: coverage in [l, l + 1/(n + 1)] give or take three standard errors', async () => {
    for (const l of [0.5, 0.8, 0.95]) {
      const r = await read(ID, claim(covering(l), { [KEY]: String(l) }));
      expect(r.reason, `${l}`).toBeUndefined();
      const [lo, hi] = band(l, 60, 150);
      expect(r.value!, `${l}`).toBeGreaterThanOrEqual(lo);
      expect(r.value!, `${l}`).toBeLessThanOrEqual(hi);
    }
    // the fewest calibration cases keep the 95% radius finite: the 19th of 19 residuals
    const r = await read(ID, claim(covering(0.95), { [KEY]: '0.95', ncal: 19 }));
    const [lo] = band(0.95, 19, 150);
    expect(r.value!).toBeGreaterThanOrEqual(lo);
    expect(r.value!).toBeLessThanOrEqual(100);
  });

  it('runs the same at the default passed explicitly', () => {
    for (const seed of [1, 4242]) {
      const a = trace(k, { [KEY]: '0.9', reps: 30 }, seed);
      const b = trace(k, { reps: 30 }, seed);
      expect(a.frames).toEqual(b.frames);
      expect(a.result).toEqual(b.result);
    }
  });
});

describe('conformal-intervals: training cases', () => {
  const KEY = 'ntrain';
  const range = () => defOf(KEY) as RangeParam | undefined;

  it('is a range control with the old 80 as its default', async () => {
    expect(range()).toMatchObject({ kind: 'range', label: 'Training cases', min: 10, step: 5, value: 80, rebuild: true });
    // the highest degree, 7, needs eight points to fit; the default sits on the grid
    expect(range()!.min).toBeGreaterThanOrEqual(8);
    expect((80 - range()!.min) % range()!.step).toBe(0);
    expect(range()!.max).toBeGreaterThanOrEqual(80);
    expect((await loadPlate(ID))!.params.find((x) => x.key === KEY)).toEqual(range());
  });

  it('round-trips through a shared link', async () => {
    await roundTrips(KEY, [10, 45, range()!.max]);
  });

  it('fits on that many cases, every radius finite at the highest degree and fewest cases', () => {
    for (const n of [10, 35, range()!.max]) {
      const t = trace(k, { [KEY]: n, degree: 7, reps: 20 }, 9);
      const rows = Object.fromEntries(t.frames[0].stats.map((s) => [s.label, s.value]));
      expect(rows['Training / calibration / test cases'], `${n}`).toBe(`${n.toLocaleString('en-US')} / 60 / 200`);
      expect(Number.isFinite(t.result.radius), `${n}`).toBe(true);
      // every case is drawn as x then noise: two draws per training case more or fewer
      const base = trace(k, { degree: 7, reps: 20 }, 9);
      expect(t.draws - base.draws, `${n}`).toBe(2 * 20 * (n - 80));
    }
  });

  it('drives the readouts: coverage in [0.9, 0.9 + 1/61] give or take three standard errors at any training size', async () => {
    const [lo, hi] = band(0.9, 60, 150);
    for (const n of [10, range()!.max]) {
      for (const degree of [1, 7]) {
        const r = await read(ID, claim(covering(0.9), { [KEY]: n, degree }));
        expect(r.reason, `${n}`).toBeUndefined();
        expect(r.value!, `n=${n} degree=${degree}`).toBeGreaterThanOrEqual(lo);
        expect(r.value!, `n=${n} degree=${degree}`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('runs the same at the default passed explicitly', () => {
    for (const seed of [1, 4242]) {
      const a = trace(k, { [KEY]: 80, reps: 30 }, seed);
      const b = trace(k, { reps: 30 }, seed);
      expect(a.frames).toEqual(b.frames);
      expect(a.result).toEqual(b.result);
    }
  });
});
