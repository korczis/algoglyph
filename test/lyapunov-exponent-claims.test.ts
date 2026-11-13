// The oracles behind lyapunov-exponent's claims (catalogue/entries/lyapunov-exponent.md), each
// computed here independently of the claim's own run (seed 4242):
//   the logistic map at r = 4 is conjugate to the tent map by x = sin²(πy/2), whose slope is 2
//   everywhere, so the chain rule telescopes: λ_N = ln 2 + (ln|sin πy_N| − ln|sin πy_0|)/N, an
//   error O(1/N), not the O(1/√N) of a mean;
//   at r = 3.5 the orbit is an attracting 4-cycle, whose exponent is ln|Π r(1 − 2x_i)|/4;
//   the Lorenz flow's long-run value is Sprott's 0.906, and the tolerance of a 200-time-unit run
//   is the spread of the estimate over a named seed set disjoint from the claim's seed.
import { describe, expect, it } from 'vitest';
import { lorenzExponent, mapExponent } from '../src/kernels/numeric/lyapunov-exponent';

const CLAIM_SEED = 4242;
/** The seeds the Lorenz estimate's spread is measured on: 1 … 60, none of them the claim's. */
const SPREAD_SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
/** The seeds the logistic identity is checked on beside the claim's: 1 … 200. */
const IDENTITY_SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const SPROTT = 0.906;
const LORENZ_TOLERANCE = 0.065; // the claim's
const LN2_TOLERANCE = 0.005; // the claim's

describe('lyapunov-exponent: the logistic map at r = 4 telescopes to ln 2 + O(1/N)', () => {
  const y = (x: number) => (2 / Math.PI) * Math.asin(Math.sqrt(x));
  const telescoped = (seed: number) => {
    const e = mapExponent('logistic', seed);
    const N = e.running.length;
    const x0 = e.orbit[0][0]; const xN = e.orbit[N - 1][1];
    const correction = (Math.log(Math.abs(Math.sin(Math.PI * y(xN)))) - Math.log(Math.abs(Math.sin(Math.PI * y(x0))))) / N;
    return { lambda: e.lambda, N, correction };
  };

  it('the estimate is ln 2 plus the conjugacy’s end terms over N, to the linearisation error', () => {
    for (const seed of [CLAIM_SEED, ...IDENTITY_SEEDS]) {
      const t = telescoped(seed);
      expect(t.N).toBe(20000);
      expect(Math.abs(t.lambda - (Math.log(2) + t.correction)), `seed ${seed}`).toBeLessThan(1e-5);
    }
  });

  it('the end terms over N = 20000 stay inside the claim’s 0.005, less the readout’s rounding', () => {
    // |ln|sin πy|| ≤ 100 would allow 0.005; the four printed digits take another 0.00005
    for (const seed of [CLAIM_SEED, ...IDENTITY_SEEDS]) {
      expect(Math.abs(telescoped(seed).correction), `seed ${seed}`).toBeLessThan(LN2_TOLERANCE - 5e-5);
    }
  });
});

describe('lyapunov-exponent: r = 3.5 is the 4-cycle’s exponent', () => {
  it('equals ln|Π r(1 − 2x_i)|/4 over the attracting cycle, which prints as −0.8725', () => {
    let x = 0.3;
    for (let i = 0; i < 5000; i++) x = 3.5 * x * (1 - x);
    let prod = 1;
    for (let i = 0; i < 4; i++) { prod *= Math.abs(3.5 * (1 - 2 * x)); x = 3.5 * x * (1 - x); }
    const cycle = Math.log(prod) / 4;
    expect(Math.abs(cycle - -0.8725)).toBeLessThan(5e-5);
    expect(Math.abs(mapExponent('logistic-periodic', CLAIM_SEED).lambda - cycle)).toBeLessThan(1e-6);
  });
});

describe('lyapunov-exponent: the Lorenz estimate’s spread, on seeds disjoint from the claim’s', () => {
  it('4 sd over seeds 1 … 60 plus the finite-time bias against 0.906 fits the claim’s tolerance', () => {
    expect(SPREAD_SEEDS).not.toContain(CLAIM_SEED);
    const v = SPREAD_SEEDS.map((s) => lorenzExponent(s).lambda);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
    // measured: sd 0.0143, mean 0.9014 (a bias of −0.0046 at T = 200): 0.0617 ≤ 0.065
    expect(4 * sd + Math.abs(mean - SPROTT)).toBeLessThanOrEqual(LORENZ_TOLERANCE);
  });
});
