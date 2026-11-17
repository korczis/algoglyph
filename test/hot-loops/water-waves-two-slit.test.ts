// water-waves-two-slit's tank (src/plates/_shared/wave2d/wave.ts: the per-cell flush inlined) and
// its shading (ramp/mix in place) without imported calls per cell (scripts/check-hot-loops.mjs),
// against its modules as they were (test/fixtures/hot-loops-before: plate and wave.ts frozen
// together): every p5 call, every pixel of every blit and every readout equal, frame by frame,
// within one run, in both views. A planted change (the separation nudged) must fail the same
// comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/water-waves-two-slit/plate';
import now from '../../src/plates/water-waves-two-slit/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [
  {},
  { scenario: 'slits', view: 'intensity', damping: 10, lambda: 6, pace: 16 },
  { scenario: 'pulse', courant: 0.7, pace: 16 },
];
const FRAMES = 12;

describe('water-waves-two-slit: no imported call in its hot loops', () => {
  it('records exactly what the modules before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the separation nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { d: 32 }, FRAMES), record(before, { d: 30 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
