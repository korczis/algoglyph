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
