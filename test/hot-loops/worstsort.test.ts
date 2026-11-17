// worstsort's hot loops without imported calls per cell (the list raster ramped and mixed in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the key count nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/worstsort/plate';
import now from '../../src/plates/worstsort/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { n: 5, levels: '1' }, { n: 4, levels: '2' }];
const FRAMES = 40;

describe('worstsort: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the key count nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { n: 4 }, FRAMES), record(before, { n: 5 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
