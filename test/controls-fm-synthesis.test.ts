// The fm-synthesis plate: its measurement reads every sideband where sampling puts it (folded
// about 0 Hz and the Nyquist frequency, as the prediction does), and its carrier is a control
// whose default is the constant it replaced (2000 Hz).
import { describe, expect, it } from 'vitest';
import { defaults, type RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { Meter, recordAll } from '../src/engines/signal/trace';
import { besselJ, kernel, predicted, sidebands } from '../src/kernels/signal/fm-synthesis';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

describe('fm-synthesis measurement reads folded sidebands', () => {
  // fm 250 Hz around the 2000 Hz carrier: order −9 sits at −250 Hz and order +9 at 4250 Hz,
  // above the 4096 Hz Nyquist frequency; sampled, they read at 250 Hz and 3942 Hz
  it('reads a sideband below 0 Hz and one above Nyquist in the bin they fold to', () => {
    for (const beta of [3, 6]) {
      const got = sidebands(250, beta, 10);
      const want = predicted(250, beta, 10);
      for (let i = 0; i < got.length; i++) {
        expect(Math.abs(got[i] - want[i]), `β ${beta} order ${i - 10}`).toBeLessThan(1e-9);
      }
    }
    // at β = 6 the folded orders are not empty: the measurement must find them, not read 0
    const want = predicted(250, 6, 10);
    expect(want[1], 'order −9').toBeGreaterThan(1e-3);
    expect(want[19], 'order +9').toBeGreaterThan(1e-3);
  });
});

const PLATE = 'fm-synthesis';
const probe = (readout: string, params: Record<string, number | string>, expect: Claim['expect']): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params } });

/** The test's own fold, independent of the kernel's alias(): sampled at 8192 Hz, a sine at f
 * reads at f mod 8192, mirrored and inverted above 4096 Hz, not at all on 0 or 4096 Hz. */
function folded(fc: number, fm: number, beta: number, n: number): number {
  const fs = 8192;
  const at = fc + n * fm;
  const g0 = ((at % fs) + fs) % fs;
  const bin = g0 > fs / 2 ? fs - g0 : g0;
  let sum = 0;
  for (let m = -40; m <= 40; m++) {
    const j = (m < 0 && m % 2 ? -1 : 1) * besselJ(Math.abs(m), beta);
    const g = (((fc + m * fm) % fs) + fs) % fs;
    if (g === 0 || g === fs / 2) continue;
    if (g < fs / 2 && g === bin) sum += j;
    if (g > fs / 2 && fs - g === bin) sum -= j;
  }
  return Math.abs(sum);
}

describe('fm-synthesis carrier', () => {
  it('is a range 500..3500 Hz in steps of 50 whose default is the old constant 2000', async () => {
    const plate = await loadPlate(PLATE);
    const d = plate!.params.find((p) => p.key === 'fc') as RangeParam | undefined;
    expect(d).toBeDefined();
    expect(d!.kind).toBe('range');
    expect(d!.label).toBe('Carrier (Hz)');
    expect([d!.min, d!.max, d!.step, d!.value]).toEqual([500, 3500, 50, 2000]);
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate(PLATE);
    for (const fc of [500, 3500, 2650]) {
      const want = { ...defaults(plate!), fc };
      const back = parse(plate!.params, serialise(plate!.params, want, 7));
      expect(back.seed).toBe(7);
      expect(back.params.fc).toBe(fc);
    }
  });

  it('moves the carrier the run synthesises, measures and marks', () => {
    for (const fc of [500, 3500]) {
      const views = recordAll(kernel.run({ fm: '125', beta: 5, fc }, 1, new Meter()));
      const last = views[views.length - 1];
      const spec = last.panels[1] as { marks?: { at: number }[] };
      expect(spec.marks?.[0].at).toBe(fc);
      // every order, folded or not, matches the test's own fold of the Bessel series
      const s = sidebands(125, 5, 8, undefined, fc);
      for (let n = -8; n <= 8; n++) expect(Math.abs(s[n + 8] - folded(fc, 125, 5, n)), `fc ${fc} n ${n}`).toBeLessThan(1e-9);
    }
    // the moved carrier puts sidebands past the edges: 3500 + 5·125 = 4125 Hz reads alone at
    // 4067 Hz, |J5(5)|; 500 − 5·125 = −125 Hz folds inverted onto order −3 at 125 Hz, and the two
    // cancel in part: |J_−3(5) − J_−5(5)| = |J5(5) − J3(5)|
    expect(sidebands(125, 5, 8, undefined, 3500)[13]).toBeCloseTo(Math.abs(besselJ(5, 5)), 9);
    expect(sidebands(125, 5, 8, undefined, 500)[3]).toBeCloseTo(Math.abs(besselJ(5, 5) - besselJ(3, 5)), 9);
    expect(sidebands(125, 5, 8, undefined, 500)[5]).toBeCloseTo(Math.abs(besselJ(5, 5) - besselJ(3, 5)), 9);
  });

  // Budget, counted: the carrier changes where the sidebands land, never the work; every view
  // synthesises and transforms the same 8192 samples, so the counts at either end equal the
  // default's for the heaviest modulator and index
  it('does the same work at every carrier', () => {
    const counts = (fc: number) => {
      const views = recordAll(kernel.run({ fm: '250', beta: 6, fc }, 1, new Meter()));
      return { views: views.length, counts: views[views.length - 1].counts };
    };
    const base = counts(2000);
    expect(counts(500)).toEqual(base);
    expect(counts(3500)).toEqual(base);
  });

  for (const fc of [500, 3500]) {
    it(`reads the folded series to rounding at ${fc} Hz, where sidebands fold`, async () => {
      const r = await read(PLATE, probe('Largest disagreement with the folded series', { fc }, { below: 1e-9 }));
      expect(r.reason).toBeUndefined();
      expect(r.value).toBeLessThan(1e-9);
    }, 120_000);
  }

  it('holds 99 % of the power within the sixth sideband at 3000 Hz: 2·6·125 = 1500 Hz', async () => {
    // the oracle: Σ_{|m|≤5} J_m(5)² < 0.99 ≤ Σ_{|m|≤6} J_m(5)², and nothing folds into the band
    const cum = (n: number) => besselJ(0, 5) ** 2 + 2 * Array.from({ length: n }, (_, k) => besselJ(k + 1, 5) ** 2).reduce((a, b) => a + b, 0);
    expect(cum(5)).toBeLessThan(0.99);
    expect(cum(6)).toBeGreaterThanOrEqual(0.99);
    const r = await read(PLATE, probe('99 % power bandwidth (measured)', { fc: 3000 }, { value: 1500 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(2 * 6 * 125);
  }, 120_000);
});
