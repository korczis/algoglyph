// bootstrap-ci's fixed constants become controls (S4 A3, A5). The plate showed the 90% level of
// the coverage it measures at every nominal level (src/kernels/stochastic/_coverage.ts
// SHOWN_LEVEL) and drew its skewed population as a log-normal of σ = 0.75; both are now controls
// whose defaults are the old constants, so the default run is the old run. The percentile
// interval is only asymptotically exact, so its oracle is the nominal level for a large sample
// from a normal population, within three binomial standard errors of the repetitions.
import { describe, expect, it } from 'vitest';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as bootstrap, type BootstrapResult } from '../src/kernels/stochastic/bootstrap-ci';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'bootstrap-ci';
const k = bootstrap as StochasticKernel<BootstrapResult>;
const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
const defOf = (key: string) => k.params?.find((d) => d.key === key);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
const covering = (l: number) => `${Math.round(l * 100)}% intervals covering`;

async function roundTrips(key: string, values: (string | number)[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

describe('bootstrap-ci: nominal level shown', () => {
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
    const p = { n: 20, b: 400, reps: 30 };
    const base = trace(k, p, 5);
    for (const l of LEVELS) {
      const t = trace(k, { ...p, [KEY]: String(l) }, 5);
      expect(t.draws, `${l}`).toBe(base.draws);
      expect(t.result.coverage).toEqual(base.result.coverage);
      const c = t.result.coverage[LEVELS.indexOf(l)];
      const rows = Object.fromEntries(t.frames.at(-1)!.stats.map((s) => [s.label, s.value]));
      expect(rows[covering(l)], `${l}`).toMatch(new RegExp(`^${(100 * c).toFixed(1)}% ± `));
      // the interval returned is the percentile interval at the level shown
      const s = Array.from(t.result.boots);
      expect(t.result.interval[0]).toBe(s[Math.max(0, Math.ceil(((1 - l) / 2) * s.length) - 1)]);
    }
  });

  it('drives the readouts: nominal coverage for a large normal sample, within three standard errors', async () => {
    for (const l of [0.5, 0.8, 0.95]) {
      const r = await read(ID, claim(covering(l), { [KEY]: String(l), population: 'normal', n: 200 }));
      expect(r.reason, `${l}`).toBeUndefined();
      const se = 100 * Math.sqrt((l * (1 - l)) / 150);
      expect(Math.abs(r.value! - 100 * l), `${l}`).toBeLessThanOrEqual(3 * se);
    }
  });

  it('runs the same at the default passed explicitly', () => {
    for (const seed of [1, 4242]) {
      const a = trace(k, { [KEY]: '0.9', n: 20, reps: 30 }, seed);
      const b = trace(k, { n: 20, reps: 30 }, seed);
      expect(a.frames).toEqual(b.frames);
      expect(a.result).toEqual(b.result);
    }
  });
});
