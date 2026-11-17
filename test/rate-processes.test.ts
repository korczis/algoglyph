// Rate processes (src/plates/_shared/ensemble/rates.ts) beyond the entry's claims: Gillespie's
// method on processes whose laws are known exactly (a pure decay's survivors are binomial at every
// time; a birth-death level's time integrals add up), and the band of every stochastic claim
// measured over seeds 101-130, disjoint from the claims' 1-5: four standard deviations of the
// claim's reading must fit inside its tolerance, and their mean must sit within a quarter of it.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { mulberry32 } from '../src/core/random';
import { gillespie, levelExchange, stateAt, timeStats, type Reaction } from '../src/plates/_shared/ensemble/rates';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

describe('rate-processes: Gillespie\'s method', () => {
  it('leaves a pure decay\'s survivors binomial with p = e^(−λt), over many runs', () => {
    const decay: Reaction[] = [{ rate: (x) => 0.5 * x[0], apply: (x) => { x[0]--; } }];
    const rnd = mulberry32(11);
    const runs = 400;
    let sum = 0;
    let sumSq = 0;
    for (let r = 0; r < runs; r++) {
      const v = stateAt(gillespie([200], decay, 3, rnd), 2)[0];
      sum += v;
      sumSq += v * v;
    }
    const p = Math.exp(-1);
    const mean = sum / runs;
    const variance = sumSq / runs - mean * mean;
    // the mean within four standard errors of 200p, the variance within 20 per cent of 200p(1 − p)
    expect(Math.abs(mean - 200 * p)).toBeLessThan(4 * Math.sqrt((200 * p * (1 - p)) / runs));
    expect(variance / (200 * p * (1 - p))).toBeGreaterThan(0.8);
    expect(variance / (200 * p * (1 - p))).toBeLessThan(1.2);
  });

  it('integrates the counts exactly: the time average is the sum of each state times its stay', () => {
    const run = gillespie([0], levelExchange('bose', 0.7), 300, mulberry32(4), { from: 20 });
    let acc = 0;
    for (let k = 0; k < run.times.length; k++) {
      const t0 = Math.max(run.times[k], 20);
      const t1 = k + 1 < run.times.length ? run.times[k + 1] : run.end;
      if (t1 > t0) acc += run.states[k] * (t1 - t0);
    }
    expect(timeStats(run, 0).mean).toBeCloseTo(acc / (run.end - 20), 12);
    // a fermion level never holds two
    const f = gillespie([0], levelExchange('fermi', 0.2), 300, mulberry32(5));
    expect(Math.max(...f.states)).toBe(1);
  });
});

describe('rate-processes: the claims\' bands, from seeds 101–130', () => {
  const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
  const claims = model.entries.find((e) => e.id === 'rate-processes')!.claims.filter((c) => c.setup?.seeds);
  const SEEDS = Array.from({ length: 30 }, (_, i) => 101 + i);
  for (const claim of claims) {
    it(`${claim.id}: four standard deviations fit the tolerance, and the mean sits near the closed form`, async () => {
      const x = claim.expect;
      const values: number[] = [];
      for (const seed of SEEDS) {
        const one: Claim = { ...claim, setup: { params: claim.setup?.params, seed } };
        const r = await read('rate-processes', one);
        expect(r.reason, `seed ${seed}`).toBeUndefined();
        values.push(r.value! - (x.against === undefined ? (x.value ?? 0) : 0));
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
      expect(4 * sd, `${claim.id}: 4 sd = ${(4 * sd).toFixed(4)}`).toBeLessThanOrEqual(x.tolerance!);
      expect(Math.abs(mean), `${claim.id}: mean gap ${mean.toFixed(4)}`).toBeLessThanOrEqual(x.tolerance! / 4);
    });
  }
});
