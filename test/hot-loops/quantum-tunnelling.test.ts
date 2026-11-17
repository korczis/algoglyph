// quantum-tunnelling's split-step solver (src/plates/_shared/quantum/schrodinger.ts: the packet's
// flush and the absorbing edges' flush inlined) and its colour tables (ramp/mix in place) without
// imported calls per cell (scripts/check-hot-loops.mjs), against its modules as they were
// (test/fixtures/hot-loops-before: plate, experiment and solver frozen together): every p5 call,
// every pixel of every blit and every readout equal, frame by frame, within one run. A planted
// change (the packet's width nudged) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/quantum-tunnelling/plate';
import now from '../../src/plates/quantum-tunnelling/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [
  {},
  { preset: 'double', speed: 64, colour: 'phase' },
  { preset: 'step', speed: 64, k0: 3, v0: 4, parts: false },
];
const FRAMES = 16;

describe('quantum-tunnelling: no imported call in its hot loops', () => {
  it('records exactly what the modules before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the packet width nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { sigma: 5.5 }, FRAMES), record(before, { sigma: 5 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
