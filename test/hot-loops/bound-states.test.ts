// bound-states uses the split-step solver of src/plates/_shared/quantum/schrodinger.ts, whose
// flush calls were inlined for quantum-tunnelling; its own code is unchanged. It is run against
// itself and the solver as they were (test/fixtures/hot-loops-before, frozen together): every p5
// call, every pixel and every readout equal, frame by frame, within one run, at the default
// double well (the one setup that steps the solver) and the other potentials. A planted change
// (the barrier nudged) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/bound-states/plate';
import now from '../../src/plates/bound-states/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [
  {},
  { potential: 'double', v0: 16, barrier: 1, levels: 8, pace: 64 },
  { potential: 'hydrogen', l: 3, levels: 8 },
];
const FRAMES = 16;

describe('bound-states: the solver without imported calls records what it recorded', () => {
  it('records exactly what the modules before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the barrier nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { barrier: 4.5 }, FRAMES), record(before, { barrier: 4 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
