// drift-divergence's bin count becomes a control: both windows were binned on 22 equal bins of
// [−4, 7], a fixed constant. Binning draws nothing, so at the default the draws, proportions and
// divergences are the old run's. Checked: the control exists with the old constant as its default,
// travels in a shared link, and drives the readouts: the proportions have that many bins, PSI is
// still KL(q‖p) + KL(p‖q) term by term at every count, and with no drift PSI stays near 2χ²/n with
// k − 1 degrees of freedom, measured on a named seed set disjoint from the claims' seed.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel, type DriftResult } from '../src/kernels/stochastic/drift-divergence';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'drift-divergence';
const k = kernel as StochasticKernel<DriftResult>;
const defOf = (key: string) => k.params?.find((d) => d.key === key);
const probe = (readout: string, params: Params, expect: Claim['expect'] = { above: -1 }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
/** The seeds of the counted runs, disjoint from the claims' seed 4242. */
const RUN_SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

async function roundTrip(key: string, values: number[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

describe('drift-divergence: bins', () => {
  const KEY = 'bins';

  it('is a range control with the old constant as its default', () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'range', min: 2, max: 200, step: 1, value: 22, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    await roundTrip(KEY, [2, 60, 200]);
  });

  it('leaves the default run as it was: an explicit 22 is the run without the parameter', () => {
    for (const seed of [4242, 7]) expect(trace(k, { [KEY]: 22 }, seed).result).toEqual(trace(k, {}, seed).result);
  });

  it('drives the readouts: that many bins, and PSI is KL both ways at every count', async () => {
    for (const bins of [2, 5, 60, 200]) {
      const r = trace(k, { [KEY]: bins }, 4242).result!;
      expect(r.bins).toBe(bins);
      for (const st of r.steps) expect(st.p.length).toBe(bins);
      const both = await read(ID, probe('PSI', { [KEY]: bins }, { against: 'KL both ways', against_number: 3, tolerance: 1e-4 }));
      expect(both.reason, `bins ${bins}`).toBeUndefined();
      expect(Math.abs(both.value as number), `bins ${bins}: ${both.text}`).toBeLessThanOrEqual(1e-4);
    }
  });

  it('with no drift and 60 bins PSI sits near 2χ²/n with at most 59 degrees of freedom', () => {
    const n = 2000;
    const psi = RUN_SEEDS.map((s) => trace(k, { drift: 0, widen: 0, [KEY]: 60 }, s).result!.steps[80].psi);
    const mean = psi.reduce((a, b) => a + b, 0) / psi.length;
    expect(mean).toBeLessThan((2 * 59) / n);
    expect(Math.max(...psi)).toBeLessThan(0.12);
  });
});
