// voronoi-relax's hot loops without imported calls per cell (the cushion shading scaled in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the relaxation nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/voronoi-relax/plate';
import now from '../../src/plates/voronoi-relax/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { sites: 400, res: 1, relax: 1 }, { sites: 400, res: 1, leading: false }];
const FRAMES = 8;

describe('voronoi-relax: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the relaxation nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { relax: 0.5 }, FRAMES), record(before, { relax: 0.51 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
