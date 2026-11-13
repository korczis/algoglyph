// topsis' swept criterion becomes a control (S4 B7): the weight slider always weighed Quality,
// the other three criteria sharing the rest equally; the criterion it weighs is now the control
// `swept`, and the slider is "Weight of the chosen criterion". At the default, Quality, the
// weights, the run and its readouts are what they were. Checked: the control exists with the old
// choice as its default, it travels in a shared link, and it drives what the plate reads: the
// chosen criterion gets the weight and the others (1 − w)/3 each; at w = 0.25, on the slider's
// 0.05 grid, every weight is exactly 0.25 whichever criterion is chosen, so closeness, ranking
// and best option are identical for all four, and equal to an independent TOPSIS at equal weights.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, SelectParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { CRITERIA, kernel, weightsFor } from '../src/kernels/numeric/topsis';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'topsis';
const KEY = 'swept';
const SEED = 4242;
const SWEPT = ['quality', 'coverage', 'cost', 'risk'];
const defOf = (key: string) => kernel.params?.find((d) => d.key === key);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
const weights = weightsFor as unknown as (w1: number, j?: number) => number[];
const last = (params: Params) => kernel.run({ seed: SEED, params }).steps.at(-1)!.stats;
const stat = (params: Params, label: string) => last(params).find((s) => s.label === label)?.value;

/** TOPSIS at equal weights on the plate's own options, written out here: each column over its
 * norm, the ideal the best (Quality and Coverage the most, Cost and Risk the least), closeness
 * D− / (D+ + D−). */
function equalWeights(n: number, seed: number): { best: number; closeness: number; dPlus: number } {
  const rnd = mulberry32(seed);
  const X = Array.from({ length: n }, () => [1 + 9 * rnd(), 1 + 9 * rnd(), 10 + 90 * rnd(), 1 + 4 * rnd()]);
  const V = X.map((r) => r.map((v, j) => (0.25 * v) / Math.hypot(...X.map((q) => q[j]))));
  const pick = (j: number, best: boolean) => (best === j < 2 ? Math.max : Math.min)(...V.map((r) => r[j]));
  const ideal = [0, 1, 2, 3].map((j) => pick(j, true));
  const anti = [0, 1, 2, 3].map((j) => pick(j, false));
  const dist = (r: number[], p: number[]) => Math.hypot(...r.map((v, j) => v - p[j]));
  const c = V.map((r) => dist(r, anti) / (dist(r, ideal) + dist(r, anti)));
  const best = c.indexOf(Math.max(...c));
  return { best, closeness: c[best], dPlus: dist(V[best], ideal) };
}

describe('topsis: criterion to weigh', () => {
  it('is a select control with the old choice as its default, and the slider weighs the choice', () => {
    const d = defOf(KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Criterion to weigh', value: 'quality', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(SWEPT);
    expect(d!.options.map((o) => o.label)).toEqual(CRITERIA);
    expect(defOf('w1')).toMatchObject({ kind: 'range', label: 'Weight of the chosen criterion', min: 0.05, max: 0.85, step: 0.05, value: 0.4 });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of ['coverage', 'risk']) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('gives the chosen criterion the weight and the others a third of the rest each', () => {
    SWEPT.forEach((s, j) => {
      const w = weights(0.7, j);
      expect(w[j]).toBe(0.7);
      w.forEach((v, i) => { if (i !== j) expect(v).toBeCloseTo(0.1, 12); });
      expect(stat({ [KEY]: s, w1: 0.7 }, 'Weights')).toContain(`${CRITERIA[j]} 0.7`);
      expect(kernel.run({ seed: SEED, params: { [KEY]: s } }).chart!.title).toBe(`Closeness as the weight of ${CRITERIA[j]} moves`);
    });
    expect(stat({ [KEY]: 'cost', w1: 0.7 }, 'Ranking')).not.toBe(stat({ [KEY]: 'quality', w1: 0.7 }, 'Ranking'));
  });

  it('drives the readouts: at equal weights every choice ranks the same, the independent TOPSIS', async () => {
    const o = equalWeights(7, SEED);
    const texts = new Set<string>();
    for (const s of SWEPT) {
      const rank = await read(ID, claim('Ranking', { [KEY]: s, w1: 0.25 }));
      const best = await read(ID, claim('Best', { [KEY]: s, w1: 0.25 }));
      expect(rank.reason).toBeUndefined();
      expect(best.reason).toBeUndefined();
      expect(rank.text!.startsWith(`${'ABCDEFG'[o.best]} `), `${s}: ${rank.text}`).toBe(true);
      expect(Math.abs(rank.value! - o.closeness)).toBeLessThanOrEqual(0.0005);
      expect(Math.abs(best.value! - o.dPlus)).toBeLessThanOrEqual(0.00005);
      texts.add(`${rank.text} | ${best.text}`);
    }
    expect(texts.size).toBe(1);
  });
});

describe('topsis at its default is what it was before the control', () => {
  // readout texts (strings), recorded on the code before the control existed (5f091c7)
  const READOUTS = 'e9dd98d8d5008d74';

  it('reads the same at its default', () => {
    const out = [4, 7, 12].flatMap((options) => [0.05, 0.4, 0.85].map((w1) => last({ options, w1 }).map((s) => s.value)));
    expect(hash(out), JSON.stringify(out.slice(0, 1))).toBe(READOUTS);
  });

  it('passing the default explicitly gives the same run', () => {
    for (const w1 of [0.05, 0.4, 0.85]) {
      expect(kernel.run({ seed: SEED, params: { w1, [KEY]: 'quality' } })).toEqual(kernel.run({ seed: SEED, params: { w1 } }));
    }
    expect(weights(0.4, 0)).toEqual(weightsFor(0.4));
  });
});
