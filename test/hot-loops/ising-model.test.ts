// ising-model's hot loops without imported calls per cell (the spin shading mixed in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the temperature nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/ising-model/plate';
import now from '../../src/plates/ising-model/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { cell: 2, temperature: 2.27, glow: true }, { cell: 2, drive: 'sweep', amplitude: 2, rate: 1, glow: true }];
const FRAMES = 12;

describe('ising-model: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the temperature nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { temperature: 2.3 }, FRAMES), record(before, { temperature: 2.31 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
