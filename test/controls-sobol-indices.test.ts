// sobol-indices' Ishigami constants become controls (S4 B6, B7): the function
// f(x) = sin x₁ + a sin² x₂ + b x₃⁴ sin x₁ on [−π, π]³ had a = 7 and b = 0.1; both are now
// controls, the same draws in the same order, so the defaults are the old run. Checked: each
// control exists with the old constant as its default, travels in a shared link, and drives what
// the plate reads: the analytic indices (V₁ = ½ (1 + b π⁴/5)², V₂ = a²/8, V₁₃ = 8 b² π⁸/225) are
// checked against an independent quadrature of the conditional variances; at a = 0 the second
// input drops out of f and at b = 0 the third does, so both of that input's estimators are
// exactly zero (every hybrid f(A_B(i)) equals f(A)); elsewhere the estimates lie within the
// largest error replicated over other seeds.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as sobol, type SobolResult } from '../src/kernels/stochastic/sobol-indices';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'sobol-indices';
const k = sobol as StochasticKernel<SobolResult>;
const defOf = (key: string) => k.params?.find((d) => d.key === key);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

async function roundTrip(key: string, values: number[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

/** First-order and total indices of the Ishigami function by Simpson quadrature on a grid of
 * the cube: Var E[f | xᵢ] and E Var[f | x₋ᵢ] over the variance, never the closed form. */
function quadrature(a: number, b: number): { first: number[]; total: number[] } {
  const m = 64;
  const h = (2 * Math.PI) / m;
  const xs = Array.from({ length: m + 1 }, (_, i) => -Math.PI + i * h);
  const w = xs.map((_, i) => ((i === 0 || i === m ? 1 : i % 2 ? 4 : 2) * h) / 3 / (2 * Math.PI));
  const f = (x1: number, x2: number, x3: number) => Math.sin(x1) + a * Math.sin(x2) ** 2 + b * x3 ** 4 * Math.sin(x1);
  const F = xs.map((x1) => xs.map((x2) => xs.map((x3) => f(x1, x2, x3))));
  let mean = 0;
  let sq = 0;
  for (let i = 0; i <= m; i++) for (let j = 0; j <= m; j++) for (let l = 0; l <= m; l++) {
    const ww = w[i] * w[j] * w[l];
    mean += ww * F[i][j][l];
    sq += ww * F[i][j][l] ** 2;
  }
  const v = sq - mean * mean;
  const at = (i: number, j: number, l: number, axis: number) => (axis === 0 ? F[i][j][l] : axis === 1 ? F[j][i][l] : F[j][l][i]);
  // Var E[f | x_axis]: the conditional mean over the other two, then its variance
  const firstOf = (axis: number) => {
    let s2 = 0;
    for (let i = 0; i <= m; i++) {
      let c = 0;
      for (let j = 0; j <= m; j++) for (let l = 0; l <= m; l++) c += w[j] * w[l] * at(i, j, l, axis);
      s2 += w[i] * c * c;
    }
    return (s2 - mean * mean) / v;
  };
  // E Var[f | x_-axis]: the variance along the axis, averaged over the other two
  const totalOf = (axis: number) => {
    let ev = 0;
    for (let j = 0; j <= m; j++) for (let l = 0; l <= m; l++) {
      let c = 0;
      let c2 = 0;
      for (let i = 0; i <= m; i++) { const y = at(i, j, l, axis); c += w[i] * y; c2 += w[i] * y * y; }
      ev += w[j] * w[l] * (c2 - c * c);
    }
    return ev / v;
  };
  return { first: [0, 1, 2].map(firstOf), total: [0, 1, 2].map(totalOf) };
}

/** The mean plus four standard deviations of the largest error over other seeds (a largest
 * error is skewed), the margin the entry's claims state. */
function replicated(params: Params, seeds = 200): number {
  const errs = Array.from({ length: seeds }, (_, s) => {
    const r = trace(k, { model: 'ishigami', n: 4000, ...params }, s + 1).result!;
    return Math.max(...r.first.map((v, i) => Math.abs(v - r.analyticFirst[i])), ...r.total.map((v, i) => Math.abs(v - r.analyticTotal[i])));
  });
  const mean = errs.reduce((x, y) => x + y, 0) / seeds;
  const sd = Math.sqrt(errs.reduce((x, y) => x + (y - mean) ** 2, 0) / (seeds - 1));
  return mean + 4 * sd;
}

describe('sobol-indices: Ishigami a', () => {
  const KEY = 'a';

  it('is a range control with the old constant as its default, shown for the Ishigami function', () => {
    expect(defOf(KEY)).toMatchObject({
      kind: 'range', label: 'Ishigami a', min: 0, max: 10, step: 0.5, value: 7, rebuild: true,
      when: { key: 'model', values: ['ishigami'] },
    });
  });

  it('round-trips through a shared link', async () => {
    await roundTrip(KEY, [0, 3.5, 10]);
  });

  it('the analytic indices are the quadrature at every a', () => {
    for (const a of [0, 3.5, 7, 10]) {
      const r = trace(k, { model: 'ishigami', n: 200, [KEY]: a }, 1).result!;
      const q = quadrature(a, 0.1);
      r.analyticFirst.forEach((v, i) => expect(v, `a=${a} first x${i + 1}`).toBeCloseTo(q.first[i], 3));
      r.analyticTotal.forEach((v, i) => expect(v, `a=${a} total x${i + 1}`).toBeCloseTo(q.total[i], 3));
    }
  });

  it('drives the readouts: at a = 0 the second input drops out exactly, elsewhere the analytic values', async () => {
    const x2 = await read(ID, claim('Indices of x2', { [KEY]: 0 }));
    expect(x2.reason).toBeUndefined();
    expect(x2.value).toBe(0);
    const both = await read(ID, claim('Indices of x2', { [KEY]: 0 }, { against: 'Indices of x2', against_number: 2, tolerance: 0 }));
    expect(both.value).toBe(0);
    const r = trace(k, { model: 'ishigami', n: 4000, [KEY]: 0 }, 9).result!;
    expect([r.first[1], r.total[1]]).toEqual([0, 0]);
    for (const a of [0, 10]) {
      const e = await read(ID, claim('Largest error against analytic', { [KEY]: a }));
      expect(e.reason).toBeUndefined();
      expect(e.value!, `a=${a}: ${e.text}`).toBeLessThan(replicated({ [KEY]: a }, 50));
    }
  });
});

describe('sobol-indices: Ishigami b', () => {
  const KEY = 'b';

  it('is a range control with the old constant as its default, shown for the Ishigami function', () => {
    expect(defOf(KEY)).toMatchObject({
      kind: 'range', label: 'Ishigami b', min: 0, max: 0.3, step: 0.01, value: 0.1, rebuild: true,
      when: { key: 'model', values: ['ishigami'] },
    });
  });

  it('round-trips through a shared link', async () => {
    await roundTrip(KEY, [0, 0.17, 0.3]);
  });

  it('the analytic indices are the quadrature at every b', () => {
    for (const b of [0, 0.05, 0.2, 0.3]) {
      const r = trace(k, { model: 'ishigami', n: 200, [KEY]: b }, 1).result!;
      const q = quadrature(7, b);
      r.analyticFirst.forEach((v, i) => expect(v, `b=${b} first x${i + 1}`).toBeCloseTo(q.first[i], 3));
      r.analyticTotal.forEach((v, i) => expect(v, `b=${b} total x${i + 1}`).toBeCloseTo(q.total[i], 3));
    }
  });

  it('drives the readouts: at b = 0 the third input drops out exactly, elsewhere the analytic values', async () => {
    const x3 = await read(ID, claim('Indices of x3', { [KEY]: 0 }));
    expect(x3.reason).toBeUndefined();
    expect(x3.value).toBe(0);
    const both = await read(ID, claim('Indices of x3', { [KEY]: 0 }, { against: 'Indices of x3', against_number: 2, tolerance: 0 }));
    expect(both.value).toBe(0);
    const r = trace(k, { model: 'ishigami', n: 4000, [KEY]: 0 }, 9).result!;
    expect([r.first[2], r.total[2]]).toEqual([0, 0]);
    for (const b of [0, 0.3]) {
      const e = await read(ID, claim('Largest error against analytic', { [KEY]: b }));
      expect(e.reason).toBeUndefined();
      expect(e.value!, `b=${b}: ${e.text}`).toBeLessThan(replicated({ [KEY]: b }, 50));
    }
  });
});

describe('sobol-indices at its defaults is what it was before the controls', () => {
  // readout texts (strings), recorded on the code before the controls existed (5f091c7)
  const READOUTS = '460813e21be059af';

  it('every model reads the same at its default', async () => {
    const out: (string | undefined)[] = [];
    for (const model of ['ishigami', 'additive']) {
      for (const readout of ['Base samples N', 'Output variance', 'Sum of first-order indices', 'Largest error against analytic']) {
        out.push((await read(ID, claim(readout, { model }))).text);
      }
    }
    expect(hash(out), JSON.stringify(out)).toBe(READOUTS);
  });

  it('passing the defaults explicitly draws the same run', () => {
    for (const model of ['ishigami', 'additive']) {
      const x = trace(k, { model, n: 2000 }, 9).result!;
      const y = trace(k, { model, n: 2000, a: 7, b: 0.1 }, 9).result!;
      expect(y, model).toEqual(x);
    }
  });
});
