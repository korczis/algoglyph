// far-field-diffraction's aperture and photon shading (ramp/mix in place) without imported calls
// per cell or photon (scripts/check-hot-loops.mjs), against its module as it was
// (test/fixtures/hot-loops-before): every p5 call, every pixel of every blit and every readout
// equal, frame by frame, within one run. A planted change (the slit width nudged) must fail the
// same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/far-field-diffraction/plate';
import now from '../../src/plates/far-field-diffraction/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [
  {},
  { aperture: 'circle', D: 240, pace: 64 },
  { aperture: 'grating', N: 16, d: 16, ga: 15, pace: 64 },
];
const FRAMES = 16;

describe('far-field-diffraction: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the slit width nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { a: 21 }, FRAMES), record(before, { a: 20 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
