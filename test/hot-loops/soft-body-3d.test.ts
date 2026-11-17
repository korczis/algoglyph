// soft-body-3d's springs and velocity Verlet step (src/plates/soft-body-3d/softbody.ts: three
// flush calls inlined) without imported calls per spring or component
// (scripts/check-hot-loops.mjs), against its modules as they were (test/fixtures/hot-loops-before:
// plate and softbody.ts frozen together): every p5 call and every readout equal, frame by frame,
// within one run. A planted change (the stiffness nudged) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/soft-body-3d/plate';
import now from '../../src/plates/soft-body-3d/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [
  {},
  { preset: 'ball', res: 10, pressure: 40, wire: true },
  { preset: 'column', res: 10, damping: 0.5, substeps: 40 },
];
const FRAMES = 16;

describe('soft-body-3d: no imported call in its hot loops', () => {
  it('records exactly what the modules before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the stiffness nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { stiffness: 210 }, FRAMES), record(before, { stiffness: 200 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
