// page-hinkley (catalogue/entries/page-hinkley.md): "An alarm is raised the first time the climb
// exceeds λ." The highest climb so far, the peak of m_t − min m, is a readout of its own, so that a
// claim can say how far below λ a stationary stream stays; it is the largest statistic the run
// computed, recomputed here. The entry's claims rest on Ville's inequality over start times (a
// false alarm with probability at most n·e^(−2δλ), or n·e^(−2(δ−s)λ) for a shift s below δ) and
// on the drift after a shift; both are checked here against counted runs on a named seed set
// disjoint from the claims' seed.
import { describe, expect, it } from 'vitest';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel, type PageHinkleyResult } from '../src/kernels/stochastic/page-hinkley';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'page-hinkley';
/** The seed every claim runs on (DEFAULT_SEED: no claim sets its own). */
const CLAIM_SEEDS = [4242];
/** The seeds of the counted runs, disjoint from CLAIM_SEEDS. */
const RUN_SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);
const k = kernel as StochasticKernel<PageHinkleyResult>;
const probe = (readout: string, params: Record<string, number>, seed: number): Claim =>
  ({ id: 'probe', statement: 'a readout test reading', readout, expect: { above: -1 }, setup: { params, seed } });

describe('page-hinkley: the peak of m_t − min m is a readout', () => {
  for (const params of [{}, { shift: 0 }, { shift: 0.4, n: 2000 }, { shift: 3, lambda: 60 }] as Record<string, number>[]) {
    it(`reads the largest statistic of the run at ${JSON.stringify(params)}`, async () => {
      for (const seed of [4242, 7]) {
        const r = await read(ID, probe('Peak of m_t − min m', params, seed));
        expect(r.reason, `seed ${seed}`).toBeUndefined();
        const res = trace(k, params, seed).result!;
        expect(r.value, `seed ${seed}: ${r.text}`).toBe(Number(Math.max(...res.statistic).toFixed(2)));
      }
    });
  }
});

describe('page-hinkley: the claims\' bounds against counted runs', () => {
  it('the seed sets are disjoint', () => {
    for (const s of CLAIM_SEEDS) expect(RUN_SEEDS).not.toContain(s);
  });

  it('at shift 2 every run alarms after the change, within 30 samples', () => {
    for (const seed of RUN_SEEDS) {
      const r = trace(k, { shift: 2 }, seed).result!;
      expect(r.change, `seed ${seed}`).toBeGreaterThanOrEqual(210);
      expect(r.change, `seed ${seed}`).toBeLessThanOrEqual(389);
      expect(r.alarm - r.change, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(r.alarm - r.change, `seed ${seed}`).toBeLessThanOrEqual(30);
    }
  });

  it('a stationary stream never climbs to λ, and one shifted by 0.1 hardly ever', () => {
    // bounds 601·e^(−15) and 601·e^(−12) per run: at most 0.09 and 1.9 alarms expected in 500
    expect(601 * Math.exp(-2 * 0.5 * 15)).toBeLessThan(2e-4);
    expect(601 * Math.exp(-2 * 0.4 * 15)).toBeLessThan(0.004);
    let small = 0;
    for (const seed of RUN_SEEDS) {
      const quiet = trace(k, { shift: 0 }, seed).result!;
      expect(Math.max(...quiet.statistic), `seed ${seed}`).toBeLessThan(15);
      if (Math.max(...trace(k, { shift: 0.1 }, seed).result!.statistic) >= 15) small++;
    }
    expect(small).toBeLessThanOrEqual(2);
  });
});
