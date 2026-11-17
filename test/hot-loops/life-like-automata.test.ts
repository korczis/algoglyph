// life-like-automata's hot loops without imported calls per cell (the age and trace tables ramped and mixed in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the soup density nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/life-like-automata/plate';
import now from '../../src/plates/life-like-automata/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { cell: 2, density: 0.6, fade: 0.8 }];
const FRAMES = 12;

describe('life-like-automata: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the soup density nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { density: 0.3 }, FRAMES), record(before, { density: 0.31 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
