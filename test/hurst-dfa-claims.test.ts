// hurst-dfa's claims (catalogue/entries/hurst-dfa.md) are Monte-Carlo tolerances: each estimate
// at the claim's seed lies within four standard deviations of its planted value, the standard
// deviation measured here on a named set of seeds disjoint from the claim's. The rescaled range's
// expected value is not ½ on short windows: for n independent normal samples the expected R/S is
// E_n = Γ((n − 1)/2) / (√π Γ(n/2)) · Σ_{i=1}^{n−1} √((n − i)/i), checked here against a simulation
// of the plate's own rescaledRange(), and the slope of log E_n over the plate's window sizes is
// the claim's centre.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { gaussian, mulberry32 } from '../src/core/random';
import { logSlope } from '../src/engines/numeric/trace';
import { boxSizes, fluctuation, profile, rescaledRange, seriesFor } from '../src/kernels/numeric/hurst-dfa';
import type { Claim } from './support/claims';

const N = 2048;
/** The seed every claim runs on (DEFAULT_SEED: no claim sets its own). */
const CLAIM_SEEDS = [4242];
/** The seeds the standard deviations come from, disjoint from CLAIM_SEEDS. */
const SD_SEEDS = Array.from({ length: 2000 }, (_, i) => i + 1);

const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === 'hurst-dfa')!.claims;
const claimOn = (readout: string, series: string) =>
  claims.find((c) => c.readout === readout && String(c.setup?.params?.series ?? 'fgn-0.8') === series);

/** α and the rescaled-range slope as the plate computes them, over every box size. */
function estimates(series: string, seed: number): [number, number] {
  const { x } = seriesFor(series, N, seed);
  const y = profile(x);
  const sizes = boxSizes(N);
  return [
    logSlope(sizes.map((n) => [n, fluctuation(y, n).F] as [number, number])),
    logSlope(sizes.map((n) => [n, rescaledRange(x, n)] as [number, number])),
  ];
}

function meanSd(v: number[]): [number, number] {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return [m, Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))];
}

/** ln Γ(z) by the Stirling series after shifting z above 8. */
function lgamma(z: number): number {
  let shift = 0;
  while (z < 8) { shift += Math.log(z); z += 1; }
  const s = 1 / z;
  return (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI)
    + s / 12 - s ** 3 / 360 + s ** 5 / 1260 - s ** 7 / 1680 - shift;
}

/** The expected rescaled range of n independent normal samples. */
function expectedRS(n: number): number {
  let sum = 0;
  for (let i = 1; i < n; i++) sum += Math.sqrt((n - i) / i);
  return Math.exp(lgamma((n - 1) / 2) - lgamma(n / 2)) / Math.sqrt(Math.PI) * sum;
}

describe('hurst-dfa: the seed sets are disjoint', () => {
  it('no claim seed is among the standard-deviation seeds', () => {
    for (const s of CLAIM_SEEDS) expect(SD_SEEDS).not.toContain(s);
    for (const c of claims) expect(CLAIM_SEEDS).toContain(c.setup?.seed ?? 4242);
  });
});

describe('hurst-dfa: DFA α within four standard deviations of the planted exponent', () => {
  for (const [series, planted] of [['white', 0.5], ['walk', 1.5], ['fgn-0.8', 0.8], ['fgn-0.3', 0.3]] as const) {
    it(`${series}: the claim is ${planted} ± at least 4 sd over ${SD_SEEDS.length} other seeds`, () => {
      const c = claimOn('DFA exponent α so far', series);
      expect(c, `a DFA claim on ${series}`).toBeDefined();
      const [mean, sd] = meanSd(SD_SEEDS.map((s) => estimates(series, s)[0]));
      expect(c!.expect.value).toBe(planted);
      expect(c!.expect.tolerance as number).toBeGreaterThanOrEqual(4 * sd);
      expect(c!.expect.tolerance as number).toBeLessThan(4 * sd + 0.01);
      // the estimator is centred on the planted exponent to within a standard deviation, so the
      // interval around the planted value is the estimator's own
      expect(Math.abs(mean - planted), `mean ${mean}, sd ${sd}`).toBeLessThan(sd);
    });
  }
});

describe('hurst-dfa: the rescaled range of white noise is centred on the expected R/S slope', () => {
  const sizes = boxSizes(N);
  const centre = logSlope(sizes.map((n) => [n, expectedRS(n)] as [number, number]));

  it('E_n matches the plate’s rescaledRange() on simulated windows', () => {
    const rnd = mulberry32(99);
    for (const n of [8, 40, 447]) {
      const reps = Math.floor(400_000 / n);
      const v = Array.from({ length: reps }, () => rescaledRange(Array.from({ length: n }, () => gaussian(rnd)), n));
      const [m, sd] = meanSd(v);
      expect(Math.abs(m - expectedRS(n)), `n ${n}: ${m} against ${expectedRS(n)}`).toBeLessThan(4 * sd / Math.sqrt(reps));
    }
  });

  it('the claim is the slope of log E_n ± at least 4 sd over the other seeds', () => {
    const c = claimOn('Rescaled range H so far', 'white');
    expect(c, 'an R/S claim on white noise').toBeDefined();
    const [mean, sd] = meanSd(SD_SEEDS.map((s) => estimates('white', s)[1]));
    expect(Math.abs((c!.expect.value as number) - centre)).toBeLessThanOrEqual(0.0005);
    expect(c!.expect.tolerance as number).toBeGreaterThanOrEqual(4 * sd);
    expect(c!.expect.tolerance as number).toBeLessThan(4 * sd + 0.01);
    expect(Math.abs(mean - centre), `mean ${mean}, sd ${sd}, centre ${centre}`).toBeLessThan(sd);
  });
});
