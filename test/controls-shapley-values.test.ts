// shapley-values' number of pairwise interactions becomes a control (S4 B5): the synthetic model
// f(x) = Σ aᵢ xᵢ + Σ β xᵢ xⱼ had two interaction terms; the count is now the control `pairs`,
// each term drawn as before (two integers and a uniform), so the default is the old model.
// Checked: the control exists with the old constant as its default, it travels in a shared
// link, and it drives what the plate reads: the Shapley value of the coalition game with the
// instance x against the baseline b has the closed form
// φᵢ = aᵢ (xᵢ − bᵢ) + Σ over the terms (i, j) or (j, i) of ½ β (xᵢ − bᵢ)(xⱼ + bⱼ);
// with no terms the model is additive, every ordering gives each input the same contribution,
// and the largest error is zero; the estimates add up to v(all) − v(none) at every count.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as shapley, type ShapleyResult } from '../src/kernels/stochastic/shapley-values';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'shapley-values';
const KEY = 'pairs';
const k = shapley as StochasticKernel<ShapleyResult>;
const defOf = () => k.params?.find((d) => d.key === KEY);
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
/** The model and instance a run drew (fields added with the control). */
type Drawn = ShapleyResult & { a: number[]; terms: [number, number, number][]; x: number[]; base: number[] };

describe('shapley-values: pairwise interactions', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({ kind: 'range', label: 'Pairwise interactions', min: 0, max: 4, step: 1, value: 2, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 3, 4]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('draws that many terms, and the exact values are the closed form', () => {
    for (const pairs of [0, 1, 2, 3, 4]) {
      for (const d of [2, 5, 6]) {
        const r = trace(k, { d, m: 200, [KEY]: pairs }, 4242 + d).result! as Drawn;
        expect(r.terms, `pairs=${pairs} d=${d}`).toHaveLength(pairs);
        const phi = r.a.map((ai, i) => ai * (r.x[i] - r.base[i]));
        for (const [i, j, b] of r.terms) {
          expect(i).not.toBe(j);
          phi[i] += 0.5 * b * (r.x[i] - r.base[i]) * (r.x[j] + r.base[j]);
          phi[j] += 0.5 * b * (r.x[j] - r.base[j]) * (r.x[i] + r.base[i]);
        }
        phi.forEach((p, i) => expect(r.exact[i], `pairs=${pairs} d=${d} x${i + 1}`).toBeCloseTo(p, 10));
        const full = r.values[(1 << d) - 1] - r.values[0];
        expect(r.estimate.reduce((s, v) => s + v, 0)).toBeCloseTo(full, 9);
        // additive: every ordering gives each input aᵢ (xᵢ − bᵢ), so every estimate is exact
        if (pairs === 0) r.estimate.forEach((e, i) => expect(Math.abs(e - r.exact[i])).toBeLessThan(1e-12));
      }
    }
  });

  it('drives the readouts: no error without interactions, the sum identity at every count', async () => {
    const err = await read(ID, claim('Largest error', { [KEY]: 0 }));
    expect(err.reason).toBeUndefined();
    expect(err.value).toBe(0);
    const some = await read(ID, claim('Largest error', { [KEY]: 4 }));
    expect(some.value!).toBeGreaterThan(0);
    for (const pairs of [0, 4]) {
      const sum = await read(ID, claim('Sum of estimates', { [KEY]: pairs }, { against: 'Sum of estimates', against_number: 2, tolerance: 1e-6 }));
      expect(sum.reason).toBeUndefined();
      expect(Math.abs(sum.value!), `pairs=${pairs}: ${sum.text}`).toBeLessThanOrEqual(1e-6);
    }
  });
});

describe('shapley-values at its default is what it was before the control', () => {
  // compared within one run: these readouts come from log, cos, sin or pow, which may round
  // differently on another CPU, so no text recorded on one machine is pinned


  it('passing the default explicitly draws the same run', () => {
    for (const d of [2, 5, 6]) {
      const a = trace(k, { d, m: 600 }, 9).result!;
      const b = trace(k, { d, m: 600, [KEY]: 2 }, 9).result!;
      expect(b, `d=${d}`).toEqual(a);
    }
  });
});
