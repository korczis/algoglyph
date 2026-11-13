// isotonic-calibration's overconfidence becomes a control (S4 C3): with overconfident scores the
// true probability of a positive label at score x was 0.5 + 0.55 · (x − 0.5); the slope is now
// the control, shown only for overconfident scores, with the same draws in the same order, so
// the default 0.55 is the old set. Checked: the control exists with the old constant as its
// default, it travels in a shared link, it drives what the plate reads (the held-out Brier score
// before calibration has the expectation E[x²] − 2E[x · t(x)] + E[t(x)] = (23 − 10 · slope) / 72
// for scores ~ Beta(1.3, 1.3), whose variance is 5/72, and the run reads it within four standard
// errors), and the runs at the defaults are what they were.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { Sampler } from '../src/engines/stochastic/sample';
import { scoredSet } from '../src/engines/stochastic/scenarios';
import { trace } from '../src/engines/stochastic/trace';
import { kernel } from '../src/kernels/stochastic/isotonic-calibration';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'isotonic-calibration';
const KEY = 'slope';
const SEEDS = [1, 7, 4242];

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const defOf = () => kernel.params?.find((d) => d.key === KEY) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, string | number> } });
type Set = { score: number[]; label: number[]; truth: (x: number) => number };
/** Run the generator to its end. */
const drain = (g: Generator<void, Set, void>): Set => { for (;;) { const r = g.next(); if (r.done) return r.value; } };
const set = (seed: number, n: number, distortion: string, slope?: number) =>
  drain((scoredSet as (s: Sampler, n: number, d: string, sl?: number) => Generator<void, Set, void>)(
    new Sampler(mulberry32(seed)), n, distortion, slope));
/** The expected held-out Brier score of the raw overconfident scores. */
const brier = (slope: number) => (23 - 10 * slope) / 72;

describe('isotonic-calibration: true-probability slope', () => {
  it('is a range control with the old constant as its default, shown for overconfident scores', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'True-probability slope', min: 0, max: 0.7, step: 0.05, value: 0.55, rebuild: true,
      when: { key: 'distortion', values: ['over'] },
    });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    expect(defs.find((d) => d.key === KEY)).toEqual(defOf());
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 0.2, 0.7]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('sets the true curve, with the same scores, only for overconfident scores', () => {
    expect(defOf(), 'the kernel declares the control').toBeDefined();
    for (const seed of SEEDS) {
      const base = set(seed, 2000, 'over');
      for (const sl of [0, 0.2, 0.7, 1]) {
        const a = set(seed, 2000, 'over', sl);
        expect(a.score).toEqual(base.score);
        for (const x of [0, 0.25, 0.5, 1]) expect(a.truth(x)).toBeCloseTo(0.5 + sl * (x - 0.5), 12);
      }
      for (const d of ['under', 'skewed']) {
        const a = set(seed, 2000, d, 0.2);
        const b = set(seed, 2000, d);
        expect({ ...a, truth: null }).toEqual({ ...b, truth: null });
      }
    }
  });

  it('drives the readouts: the held-out Brier score before calibration is (23 − 10 · slope) / 72', async () => {
    for (const [sl, tol] of [[0, 0.032], [0.2, 0.031], [0.7, 0.027]]) {
      const r = await read(ID, claim('Brier score (held out)', { [KEY]: sl }));
      expect(r.reason).toBeUndefined();
      expect(Math.abs(r.value! - brier(sl)), `slope ${sl}: ${r.text} against ${brier(sl)}`).toBeLessThanOrEqual(tol);
    }
    for (const sl of [0, 0.7]) {
      const e = await read(ID, claim('Expected calibration error', { [KEY]: sl }, { against: 'Expected calibration error', against_number: 2, above: 0 }));
      expect(e.reason).toBeUndefined();
      expect(e.value!, `slope ${sl}: ${e.text}`).toBeGreaterThan(0);
    }
  });
});

describe('isotonic-calibration at the defaults is what it was before the control', () => {
  // scores and labels are integers or arithmetic on uniform draws through the Beta sampler, whose
  // gamma draws take a log and a power: compared within this run, never pinned
  it('runs the same with the default passed explicitly, for every distortion', () => {
    for (const distortion of ['over', 'under', 'skewed']) {
      for (const seed of [1, 4242]) {
        const a = trace(kernel, { distortion, n: 300 }, seed);
        const b = trace(kernel, { distortion, n: 300, [KEY]: 0.55 }, seed);
        expect(b.frames).toEqual(a.frames);
        expect(b.result).toEqual(a.result);
      }
    }
  });

  it('draws the same labels at the default as with the old constant written out', () => {
    // the old curve, 0.5 + 0.55 · (x − 0.5), recomputed from the drawn scores: one label draw each
    for (const seed of SEEDS) {
      const a = set(seed, 1500, 'over');
      const s = new Sampler(mulberry32(seed));
      const label: number[] = [];
      for (let i = 0; i < 1500; i++) { const x = s.beta(1.3, 1.3); label.push(s.bernoulli(0.5 + 0.55 * (x - 0.5)) ? 1 : 0); }
      expect(hash(a.label)).toBe(hash(label));
    }
  });

  it('no other stochastic kernel draws a scored set', () => {
    const dir = 'src/kernels/stochastic';
    const users = readdirSync(dir).filter((f) => readFileSync(`${dir}/${f}`, 'utf8').includes('scoredSet'));
    expect(users).toEqual([`${ID}.ts`]);
  });
});
