// bayes-update's fixed constants become controls (S4 A1-A2). The grid held the belief in G = 400
// cells and read the central 90% credible interval off it; both are now controls whose defaults
// are the old constants, so the default run is the old run. Checked per control: it exists with
// its default and options, it travels in a shared link, and it drives what the plate reads,
// against the closed-form conjugate posterior Beta(a + events, b + non-events).
import { describe, expect, it } from 'vitest';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as bayes, type BayesResult } from '../src/kernels/stochastic/bayes-update';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'bayes-update';
const k = bayes as StochasticKernel<BayesResult>;
const defOf = (key: string) => k.params?.find((d) => d.key === key) as SelectParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

async function roundTrips(key: string, values: string[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

describe('bayes-update: grid cells', () => {
  const KEY = 'cells';

  it('is a select control with the old constant, 400, as its default', async () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'select', label: 'Grid cells', value: '400', rebuild: true });
    expect(defOf(KEY)!.options.map((o) => o.value)).toEqual(['100', '200', '400']);
    expect((await loadPlate(ID))!.params.find((x) => x.key === KEY)).toEqual(defOf(KEY));
  });

  it('round-trips through a shared link', async () => {
    await roundTrips(KEY, ['100', '200']);
  });

  it('holds the belief in that many cells, the grid mean within one cell of the closed form', () => {
    for (const G of [100, 200, 400]) {
      for (const prior of ['flat', 'jeffreys', 'sceptical', 'hopeful']) {
        for (const seed of [1, 4242]) {
          const t = trace(k, { [KEY]: String(G), prior, n: 500 }, seed);
          const r = t.result;
          expect(r.grid.length).toBe(G);
          expect(r.posterior.length).toBe(G);
          // one pass over the grid per observation, each cell one counted likelihood evaluation
          expect(t.evals).toBe(G * 500);
          const [a, b] = r.prior;
          const exact = (a + r.successes) / (a + b + r.successes + r.failures);
          expect(Math.abs(r.mean - exact), `G=${G} ${prior} seed=${seed}`).toBeLessThanOrEqual(1 / G);
        }
      }
    }
  });

  it('drives the readouts: the cell width shown and the grid mean against the closed form', async () => {
    for (const G of [100, 200]) {
      const ci = await read(ID, claim('90% credible interval', { [KEY]: String(G) }));
      expect(ci.reason).toBeUndefined();
      expect(ci.text).toContain(`to the cell width ${(1 / G).toFixed(4)}`);
      const vs = await read(ID, claim('Posterior mean', { [KEY]: String(G) }, { against: 'Closed form Beta mean', tolerance: 1 / G }));
      expect(vs.reason).toBeUndefined();
      expect(Math.abs(vs.value!), `G=${G}`).toBeLessThanOrEqual(1 / G);
    }
  });

  it('runs the same at the default passed explicitly', () => {
    for (const seed of [1, 4242]) {
      const a = trace(k, { [KEY]: '400', n: 200 }, seed);
      const b = trace(k, { n: 200 }, seed);
      expect(a.frames).toEqual(b.frames);
      expect(a.result).toEqual(b.result);
    }
  });
});

/** ln Γ(z) by the Stirling series after shifting z past 30. */
function lgamma(z: number): number {
  let shift = 0;
  for (; z < 30; z++) shift += Math.log(z);
  return (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * z) - 1 / (360 * z ** 3) - shift;
}

/** The Beta(a, b) q-quantile, by bisection on an independent distribution function: Simpson's
 * rule after the substitution x = sin²φ, whose integrand 2 sin^(2a−1)φ cos^(2b−1)φ / B(a, b) is
 * finite for the shapes of at least ½ the plate builds (the kernel's betaCdf is a continued
 * fraction, not used here). */
function betaQuantile(q: number, a: number, b: number): number {
  const norm = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b));
  const f = (p: number) => 2 * norm * Math.sin(p) ** (2 * a - 1) * Math.cos(p) ** (2 * b - 1);
  const cdf = (x: number) => {
    const top = Math.asin(Math.sqrt(x));
    const m = 2000;
    const h = top / m;
    let s = f(0) + f(top);
    for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(i * h);
    return (s * h) / 3;
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (cdf(mid) < q) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

describe('bayes-update: credible level', () => {
  const KEY = 'credible';
  const LEVELS = ['0.8', '0.9', '0.95', '0.99'];
  const label = (l: string) => `${Math.round(Number(l) * 100)}% credible interval`;

  it('is a select control with the old 90% as its default', async () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'select', label: 'Credible level', value: '0.9', rebuild: true });
    expect(defOf(KEY)!.options.map((o) => o.value)).toEqual(LEVELS);
    expect((await loadPlate(ID))!.params.find((x) => x.key === KEY)).toEqual(defOf(KEY));
  });

  it('round-trips through a shared link', async () => {
    await roundTrips(KEY, ['0.8', '0.95', '0.99']);
  });

  it('names the interval by its level, the default keeping the old label', () => {
    for (const l of LEVELS) {
      const last = trace(k, { [KEY]: l, n: 50 }, 3).frames.at(-1)!;
      expect(last.stats.map((s) => s.label), l).toContain(label(l));
      expect(last.stats.map((s) => s.label)).toContain('Closed form lower end');
      expect(last.stats.map((s) => s.label)).toContain('Closed form upper end');
    }
    expect(label('0.9')).toBe('90% credible interval');
  });

  it('drives the readouts: each end within one cell of the closed-form Beta quantile', async () => {
    for (const l of LEVELS) {
      for (const cells of ['100', '400']) {
        const p = { [KEY]: l, cells };
        const G = Number(cells);
        const ci = await read(ID, claim(label(l), p));
        const mean = await read(ID, claim('Closed form Beta mean', p));
        expect(ci.reason, `${l} ${cells}`).toBeUndefined();
        const [, A, B] = /Beta\(([\d.]+), ([\d.]+)\)/.exec(mean.text!)!.map(Number);
        const tail = (1 - Number(l)) / 2;
        const [lo, hi] = [betaQuantile(tail, A, B), betaQuantile(1 - tail, A, B)];
        const ends = ci.text!.split(' – ').map((x) => Number.parseFloat(x));
        // an end is the right edge of the cell where the grid's cumulative mass crosses: within a
        // cell of the quantile, plus a tenth of a cell for the midpoint rule's error in that mass
        // (h²/24 · |f′/f| for this posterior, under 0.03 of a cell at 100 cells)
        expect(Math.abs(ends[0] - lo), `${l} ${cells} lower`).toBeLessThanOrEqual(1.1 / G);
        expect(Math.abs(ends[1] - hi), `${l} ${cells} upper`).toBeLessThanOrEqual(1.1 / G);
        // the plate's own closed-form ends are the same quantiles, to the four digits shown
        const cl = await read(ID, claim('Closed form lower end', p));
        const cu = await read(ID, claim('Closed form upper end', p));
        expect(Math.abs(cl.value! - lo), `${l} closed lower`).toBeLessThanOrEqual(1e-4);
        expect(Math.abs(cu.value! - hi), `${l} closed upper`).toBeLessThanOrEqual(1e-4);
      }
    }
  });

  it('runs the same at the default passed explicitly', () => {
    for (const seed of [1, 4242]) {
      const a = trace(k, { [KEY]: '0.9', n: 200 }, seed);
      const b = trace(k, { n: 200 }, seed);
      expect(a.frames).toEqual(b.frames);
      expect(a.result).toEqual(b.result);
    }
  });
});
