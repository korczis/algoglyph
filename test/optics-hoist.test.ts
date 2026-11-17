// The hoist of the two slits' far-field screen and finite detector from src/plates/_shared/two-slit
// to src/plates/_shared/optics (slice 26), shown to change no number: every export of each hoisted
// module is evaluated on a grid of inputs, and the same for the module as it stood before
// (test/fixtures/two-slit-before), and the two snapshots must be equal to the last bit. A planted
// change of one unit in the last place on the hoisted side must make them differ, so the
// comparison is shown able to see a change that small.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import * as detectorNew from '../src/plates/_shared/optics/detector';
import * as screenNew from '../src/plates/_shared/optics/screen';
import * as detectorOld from './fixtures/two-slit-before/detector';
import * as screenOld from './fixtures/two-slit-before/screen';

type ScreenModule = typeof screenNew;
type DetectorModule = typeof detectorNew;

const SLITS = [
  { lambda: 5e-7, d: 1e-4, a: 2e-5, L: 1 },
  { lambda: 6.33e-7, d: 2.5e-4, a: 1e-4, L: 2.5 },
  { lambda: 1e-10, d: 1e-6, a: 1e-7, L: 0.3 },
];

function screenSnapshot(m: ScreenModule): unknown[] {
  const out: unknown[] = [m.TABLE_CELLS, m.FINE_CELLS];
  for (const s of SLITS) {
    const X = m.halfWidth(s);
    out.push(m.fringePeriod(s), X);
    for (let i = -40; i <= 40; i++) {
      const x = (i / 40) * X;
      out.push(m.envelope(s, x), m.oneSlit(s, x), m.twoSlit(s, x), m.twoSlit(s, x, 0.7), m.twoSlit(s, x, -2.9));
    }
    const screen = new m.Screen(s, X, 512);
    out.push(screen.We, screen.Wc, screen.period);
    for (let i = 0; i < 50; i++) out.push(screen.inverse(i / 50));
    const rnd = mulberry32(17);
    for (let i = 0; i < 40; i++) out.push(screen.fringe(rnd, 0.4), screen.emitOne(rnd), screen.emitTwo(rnd, 1.1));
    out.push(Array.from(m.referenceCdf(s, X, 0.6, 256)), m.visibilityMoments(s, X));
    const est = new m.VisibilityEstimate(screen.period, m.visibilityMoments(s, X));
    for (let i = 0; i < 30; i++) est.add(screen.fringe(rnd, 0));
    out.push(est.count, est.value());
  }
  return out;
}

function detectorSnapshot(m: DetectorModule): unknown[] {
  const out: unknown[] = [m.CELLS_PER_PERIOD, m.TRUNCATE, m.MAX_GRID_WIDTH];
  for (const kind of ['gaussian', 'box'] as const) {
    for (const w of [0, 0.05, 0.3, 1, 1.37, 2.5, 4]) {
      out.push(m.attenuation(kind, w), Array.from(m.sampledKernel(kind, w, 1 / m.CELLS_PER_PERIOD)));
      const r = m.gridReading(kind, w);
      out.push(r && { ...r, truth: Array.from(r.truth), measured: Array.from(r.measured) });
    }
  }
  out.push(m.gridContrast(Float64Array.from({ length: 256 }, (_, i) => 1 + 0.4 * Math.cos(i / 3))));
  return out;
}

/** One unit in the last place more on a single export: the smallest change a number can show. */
const nudge = (v: number) => v + Math.abs(v) * Number.EPSILON;

describe('the optics hoist (screen and detector) changes no number', () => {
  it('the hoisted screen computes what the two slits\' screen computed', () => {
    expect(screenSnapshot(screenNew)).toEqual(screenSnapshot(screenOld as unknown as ScreenModule));
  });

  it('the hoisted detector computes what the two slits\' detector computed', () => {
    expect(detectorSnapshot(detectorNew)).toEqual(detectorSnapshot(detectorOld as unknown as DetectorModule));
  });

  it('the comparison sees a planted change of one unit in the last place, on either module', () => {
    const plantedScreen: ScreenModule = { ...screenNew, envelope: (s, x) => nudge(screenNew.envelope(s, x)) };
    expect(screenSnapshot(plantedScreen)).not.toEqual(screenSnapshot(screenOld as unknown as ScreenModule));
    const plantedDetector: DetectorModule = { ...detectorNew, attenuation: (k, w) => nudge(detectorNew.attenuation(k, w)) };
    expect(detectorSnapshot(plantedDetector)).not.toEqual(detectorSnapshot(detectorOld as unknown as DetectorModule));
  });
});
