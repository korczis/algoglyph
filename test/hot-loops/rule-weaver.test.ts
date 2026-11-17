// rule-weaver's hot loops without imported calls per cell (the row shading ramped in place; scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of every
// blit and every readout equal, frame by frame, within one run. A planted change (the rule nudged) must
// fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/rule-weaver/plate';
import now from '../../src/plates/rule-weaver/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { rule: 110, cell: 2, start: 'random' }, { rule: 90, cell: 2 }];
const FRAMES = 12;

describe('rule-weaver: no imported call in its hot loops', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and heavy corners', () => {
    for (const c of CORNERS) {
      expect(firstDifference(record(now, c, FRAMES), record(before, c, FRAMES)), JSON.stringify(c)).toBe(-1);
    }
  }, 120_000);

  it('a planted change (the rule nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { rule: 30 }, FRAMES), record(before, { rule: 31 }, FRAMES))).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
