// The oracles behind lissajous's claims (catalogue/entries/lissajous.md), computed here apart from
// the claims' own runs (seed 4242):
//   the ellipse reading interpolates y linearly between samples where x crosses 0 upwards: with
//   the phase step h = 2πa/N the error is at most h²/8 (y'' ≤ 1) plus h³/8 for the crossing's
//   own interpolation error;
//   white noise of sd σ on N samples puts a complex Gaussian of sd σ√(N/2) per component in each
//   bin, against the peak's N/2, so each channel's phase has sd σ√(2/N) and δ = φx − (a/b)φy has
//   sd σ√(2/N)·√(1 + (a/b)²), checked on a named seed set disjoint from the claim's.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engines/signal/input';
import { figure, read } from '../src/kernels/signal/lissajous';

const N = 1024;
const CLAIM_SEED = 4242;
/** The seeds the phase spread is measured on: 1 … 2000, none of them the claim's. */
const SPREAD_SEEDS = Array.from({ length: 2000 }, (_, i) => i + 1);

/** The mean |y| where x crosses 0 upwards, interpolated as the plate does. */
function ellipse(x: Float64Array, y: Float64Array): number {
  let sum = 0; let c = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (x[i] <= 0 && x[j] > 0) { const f = -x[i] / (x[j] - x[i]); sum += Math.abs(y[i] + f * (y[j] - y[i])); c++; }
  }
  return sum / c;
}

describe('lissajous: the ellipse reading is within the interpolation bound', () => {
  it('at a = b = 3, |reading − |sin δ|| ≤ h²/8 + h³/8 for every whole degree of δ', () => {
    const h = (2 * Math.PI * 3) / N;
    const bound = (h * h) / 8 + (h * h * h) / 8; // 4.24e-5
    expect(bound + 1e-4).toBeLessThan(2e-4); // with both printed numbers' rounding, the claim's 2e-4
    for (let deg = 0; deg < 360; deg++) {
      const d = (deg * Math.PI) / 180;
      const [x, y] = figure(3, 3, d);
      expect(Math.abs(ellipse(x, y) - Math.abs(Math.sin(d))), `δ ${deg}°`).toBeLessThanOrEqual(bound);
    }
  });
});

describe('lissajous: the phase under noise spreads as σ√(2/N)·√(1 + (a/b)²)', () => {
  it('on seeds 1 … 2000 at noise 0.2 and a : b = 3 : 2 the measured sd is the predicted 0.913°, and 4° is over 4 sd', () => {
    expect(SPREAD_SEEDS).not.toContain(CLAIM_SEED);
    const predicted = 0.2 * Math.sqrt(2 / N) * Math.sqrt(1 + (3 / 2) ** 2) * (180 / Math.PI);
    const errs = SPREAD_SEEDS.map((s) => {
      const d = (208 * Math.PI) / 180;
      const [x, y] = figure(3, 2, d, 0.2, mulberry32(s));
      let e = read(x, y).delta - d;
      e -= 2 * Math.PI * Math.round(e / (2 * Math.PI));
      return (e * 180) / Math.PI;
    });
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / (errs.length - 1));
    // the sd of a sample sd over 2000 draws is about 1.6%: 10% is far outside it
    expect(Math.abs(sd / predicted - 1)).toBeLessThan(0.1);
    expect(4 * Math.max(sd, predicted) + 0.01).toBeLessThan(4);
  });
});
