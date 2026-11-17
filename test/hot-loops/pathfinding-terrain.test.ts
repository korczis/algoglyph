// pathfinding-terrain's paint loop without imported calls or an array per cell (scripts/check-hot-loops.mjs),
// against its module as it was (test/fixtures/hot-loops-before): every p5 call, every pixel of
// every blit and every readout equal, frame by frame, within one run. A planted change (a
// parameter nudged) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import type { Params } from '../../src/core/plate';
import before from '../fixtures/hot-loops-before/src/plates/pathfinding-terrain/plate';
import now from '../../src/plates/pathfinding-terrain/plate';
import { firstDifference, record } from '../support/identity';

const CORNERS: Params[] = [{}, { algorithm: 'dijkstra', cell: 4 }];

describe('pathfinding-terrain: no imported call in its paint loop', () => {
  it('records exactly what the module before recorded, every frame, at the defaults and a heavy corner', () => {
    for (const c of CORNERS) expect(firstDifference(record(now, c, 30), record(before, c, 30)), JSON.stringify(c)).toBe(-1);
  });

  it('a planted change (a parameter nudged) fails the same comparison', () => {
    expect(firstDifference(record(now, { rough: 1.3 }, 30), record(before, { rough: 1.2 }, 30))).toBeGreaterThanOrEqual(0);
  });
});
