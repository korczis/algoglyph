// The numeric engine's hot loops without imported calls per cell (the grid layer ramped in place; scripts/check-hot-loops.mjs),
// against the engine's modules as they were (test/fixtures/hot-loops-before: numeric/index.ts): for live
// kernels that reach the rewritten loop, the plate each engine makes from the same kernel records
// every p5 call, every pixel of every blit and every readout equal, frame by frame, within one run,
// at the defaults and at every range control's top. The clock is a counter reset per recording, so
// the time-sliced work slices the same way in both. A planted change (a control nudged
// one step) must fail the same comparison.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Params, PlateCode } from '../../src/core/plate';
import { engine as now } from '../../src/engines/numeric/index';
import type { NumericKernel } from '../../src/engines/numeric/trace';
import { engine as before } from '../fixtures/hot-loops-before/src/engines/numeric/index';
import { kernel as k0 } from '../../src/kernels/numeric/topsis';
import { kernel as k1 } from '../../src/kernels/numeric/gaussian-elimination';
import { firstDifference, record, type Recording } from '../support/identity';

const KERNELS: [string, NumericKernel][] = [['topsis', k0], ['gaussian-elimination', k1]];
const FRAMES = 40;

let clock = 0;
const run = (plate: PlateCode, over: Params): Recording => { clock = 0; return record(plate, over, FRAMES); };

/** The defaults, and every range control of the plate at its top. */
function corners(plate: PlateCode): Params[] {
  const top: Params = {};
  for (const d of plate.params) if (d.kind === 'range') top[d.key] = d.max;
  return [{}, top];
}

describe('numeric engine: no imported call in its hot loops', () => {
  beforeEach(() => { vi.spyOn(performance, 'now').mockImplementation(() => (clock += 0.05)); });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const [id, kernel] of KERNELS) {
    const info = { id, title: id, group: 'hot-loops' };
    it(`${id}: records exactly what the engine before recorded, every frame, at the defaults and the top`, () => {
      const a = now.plate(info, kernel); const b = before.plate(info, kernel);
      for (const c of corners(a)) expect(firstDifference(run(a, c), run(b, c)), JSON.stringify(c)).toBe(-1);
    }, 120_000);

    it(`${id}: a planted change (a control nudged one step) fails the same comparison`, () => {
      const a = now.plate(info, kernel); const b = before.plate(info, kernel);
      // the plate's first range control other than the pace: the kernel's own, or its input size
      const d = a.params.find((q) => q.kind === 'range' && q.key !== 'pace');
      if (!d || d.kind !== 'range') throw new Error(`${id}: no range control to nudge`);
      const v = d.value as number;
      const nudged = v + d.step <= d.max ? v + d.step : v - d.step;
      expect(firstDifference(run(a, { [d.key]: nudged }), run(b, { [d.key]: v }))).toBeGreaterThanOrEqual(0);
    }, 120_000);
  }
});
