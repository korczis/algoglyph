// pert-monte-carlo's PERT weight becomes a control (S4 B4): a task's durations were drawn from
// the PERT-Beta distribution with shapes 1 + 4 (m − a)/(b − a) and 1 + 4 (b − m)/(b − a), mean
// (a + 4m + b)/6; the 4 is now the control λ, with shapes 1 + λ (m − a)/(b − a) and
// 1 + λ (b − m)/(b − a) and mean (a + λm + b)/(λ + 2), the same draws in the same order, so the
// default is the old run. Checked: the control exists with the old constant as its default, it
// travels in a shared link, and it drives what the plate reads: the deterministic finish is the
// longest path with every task at (a + λm + b)/(λ + 2), and the simulated mean stays above it at
// every λ (E max ≥ max E).
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { Sampler } from '../src/engines/stochastic/sample';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as pert, pertShape, type PertResult } from '../src/kernels/stochastic/pert-monte-carlo';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'pert-monte-carlo';
const KEY = 'lambda';
const SEED = 4242;
const k = pert as StochasticKernel<PertResult>;
const defOf = () => k.params?.find((d) => d.key === KEY);
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
type Shape = (t: { a: number; m: number; b: number }, lambda?: number) => [number, number];
const shapeAt = pertShape as unknown as Shape;
const meanOf = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

/** The longest path with every task at its PERT mean (a + λm + b)/(λ + 2), by recursion over
 * the tasks before each one (the network's own forward pass is not used). */
function deterministic(tasks: PertResult['tasks'], lambda: number): number {
  const d = tasks.map((t) => (t.a + lambda * t.m + t.b) / (lambda + 2));
  const end = (i: number): number => d[i] + Math.max(0, ...tasks[i].after.map(end));
  return Math.max(...tasks.map((_, i) => end(i)));
}

describe('pert-monte-carlo: PERT weight λ', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({ kind: 'range', label: 'PERT weight λ', min: 0, max: 10, step: 0.5, value: 4, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 2.5, 10]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('shapes a task by λ: its mean is (a + λm + b)/(λ + 2)', () => {
    const t = { a: 2, m: 5, b: 14 };
    for (const lambda of [0, 1, 10]) {
      const [al, be] = shapeAt(t, lambda);
      expect(al).toBeCloseTo(1 + (lambda * (t.m - t.a)) / (t.b - t.a), 12);
      expect(be).toBeCloseTo(1 + (lambda * (t.b - t.m)) / (t.b - t.a), 12);
      const s = new Sampler(mulberry32(17));
      const xs = Array.from({ length: 40000 }, () => t.a + (t.b - t.a) * s.beta(al, be));
      const sd = (t.b - t.a) * Math.sqrt((al * be) / ((al + be) ** 2 * (al + be + 1)));
      expect(Math.abs(meanOf(xs) - (t.a + lambda * t.m + t.b) / (lambda + 2)), `λ=${lambda}`).toBeLessThan((4 * sd) / Math.sqrt(xs.length));
    }
  });

  it('drives the readouts: the deterministic finish is the closed form, the mean above it', async () => {
    for (const lambda of [0, 2, 10]) {
      const r = trace(k, { [KEY]: lambda, n: 2000 }, SEED).result!;
      const det = deterministic(r.tasks, lambda);
      expect(r.deterministic, `λ=${lambda}`).toBeCloseTo(det, 9);
      const shown = await read(ID, claim('With every task at its mean', { [KEY]: lambda }));
      expect(shown.reason).toBeUndefined();
      expect(Math.abs(shown.value! - det), `λ=${lambda}: ${shown.text}`).toBeLessThanOrEqual(0.05);
      const gap = await read(ID, claim('Mean length', { [KEY]: lambda }, { against: 'With every task at its mean', above: 0.05 }));
      expect(gap.reason).toBeUndefined();
      expect(gap.value!, `λ=${lambda}: ${gap.text}`).toBeGreaterThan(0.05);
    }
  });
});

describe('pert-monte-carlo at its default is what it was before the control', () => {
  // compared within one run: these readouts come from log, cos, sin or pow, which may round
  // differently on another CPU, so no text recorded on one machine is pinned


  it('passing the default explicitly draws the same finishes', () => {
    const a = trace(k, { n: 3000 }, SEED).result!;
    const b = trace(k, { n: 3000, [KEY]: 4 }, SEED).result!;
    expect(b.finishes).toEqual(a.finishes);
    expect(b.deterministic).toBe(a.deterministic);
    expect(a.deterministic).toBeCloseTo(206 / 6, 9);
  });
});
