// langton-turmites's hot loops without imported calls per cell (the colour tables ramped and mixed in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the trail fade nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/langton-turmites/plate';
import now from '../../src/plates/langton-turmites/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { ants: 8, cell: 2, speed: 4000, fade: 0.8 }];
const FRAMES = 12;

describe('langton-turmites: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the trail fade nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { fade: 0.9 }, FRAMES), record(before, { fade: 0.91 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
