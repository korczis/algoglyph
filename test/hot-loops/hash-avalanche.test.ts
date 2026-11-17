// hash-avalanche's hot loops without imported calls per cell (the bit-flip matrix's neutral grey hoisted and ramp written in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the gain nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/hash-avalanche/plate';
import now from '../../src/plates/hash-avalanche/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { fn: 'fnv1a', trials: 1024, gain: 40 }, { trials: 1024, gain: 1 }];
const FRAMES = 12;

describe('hash-avalanche: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the gain nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { gain: 9 }, FRAMES), record(before, { gain: 8 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
