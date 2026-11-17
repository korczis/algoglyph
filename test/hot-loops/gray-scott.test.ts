// gray-scott's stencil and shading without imported calls per cell (scripts/check-hot-loops.mjs),
// against its modules as they were (test/fixtures/hot-loops-before): every p5 call, every pixel of
// every blit and every readout equal, frame by frame, within one run. A planted change (the
// uniform perturbation nudged) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/gray-scott/plate';
import now from '../../src/plates/gray-scott/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { preset: 'coral', res: 2, speed: 40 }];

describe('gray-scott: no imported call in its hot loops', () => {
  it('records exactly what the modules before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) expect(firstDifference(record(now, c, 12), record(before, c, 12)), JSON.stringify(c)).toBe(-1);
  });

  it('a planted change (the perturbation nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { dv: 0.0011 }, 12), record(before, { dv: 0.001 }, 12))).toBeGreaterThanOrEqual(0);
  });
});
