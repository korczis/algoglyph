// U-stochastic (ADR 0010), shared by test/u-stochastic/*.test.ts: the stochastic engine and its adopting kernels read a reader's table, and on
// every seeded input they must run exactly as before. The current engine with each current kernel
// and the engine and kernel as they were before U-stochastic (test/fixtures/u-stochastic-before) make
// their plates, and both record every p5 call, every pixel of every blit and every readout, frame
// by frame, within one run: at the defaults and at every option of every select. The clock is a
// counter reset per recording, so time-sliced work slices the same in both. A planted change (a
// select moved to its next option on one side, or a range nudged a step) must fail the same comparison,
// within a window that grows to 16 times the identity window when the change acts late.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Params, PlateCode } from '../../src/core/plate';
import { engine as now } from '../../src/engines/stochastic/index';
import type { StochasticKernel } from '../../src/engines/stochastic/trace';
import { engine as before } from '../fixtures/u-stochastic-before/src/engines/stochastic/index';
import { firstDifference, record, type Recording } from '../support/identity';

const FRAMES = 30;

// A control can act late in a run (tornado-sensitivity's n only after the 100 frames of its
// build-up), so the planted change is looked for over windows that grow until one shows it.
const PLANTED_WINDOWS = [FRAMES, 4 * FRAMES, 16 * FRAMES];

let clock = 0;
const run = (plate: PlateCode, over: Params, frames = FRAMES): Recording => { clock = 0; return record(plate, over, frames); };

/** The defaults, and each option of each select in turn. */
function corners(plate: PlateCode): Params[] {
  const out: Params[] = [{}];
  for (const d of plate.params) if (d.kind === 'select' && !d.cosmetic) for (const o of d.options) out.push({ [d.key]: o.value });
  return out;
}

/** The identity proof for one adopting kernel: call it at the top level of its test file. */
export function sameSeededRuns(id: string, k: StochasticKernel, kb: StochasticKernel): void {
  describe(`U-stochastic: ${id}'s every seeded run is the run it was`, () => {
    beforeEach(() => { vi.spyOn(performance, 'now').mockImplementation(() => (clock += 0.05)); });
    afterEach(() => { vi.restoreAllMocks(); });

    const info = { id, title: id, group: 'u-stochastic' };
    it(`${id}: records exactly what the engine and kernel before recorded, at the defaults and every option`, () => {
      const a = now.plate(info, k); const b = before.plate(info, kb);
      for (const c of corners(a)) expect(firstDifference(run(a, c), run(b, c)), JSON.stringify(c)).toBe(-1);
    }, 120_000);

    it(`${id}: a planted change (a select moved to its next option, or a range nudged a step) fails the same comparison`, () => {
      const a = now.plate(info, k); const b = before.plate(info, kb);
      const sel = a.params.find((q) => q.kind === 'select' && !q.cosmetic && q.options.length > 1);
      const rng = a.params.find((q) => q.kind === 'range' && q.key !== 'pace');
      let mine: Params; let theirs: Params;
      if (sel && sel.kind === 'select') {
        mine = { [sel.key]: sel.options[1].value }; theirs = { [sel.key]: sel.options[0].value };
      } else if (rng && rng.kind === 'range') {
        const v = rng.value as number;
        mine = { [rng.key]: v + rng.step <= rng.max ? v + rng.step : v - rng.step }; theirs = { [rng.key]: v };
      } else throw new Error(`${id}: no control to plant a change on`);
      let at = -1;
      for (const w of PLANTED_WINDOWS) {
        at = firstDifference(run(a, mine, w), run(b, theirs, w));
        if (at >= 0) break;
      }
      expect(at, `${JSON.stringify(mine)} against ${JSON.stringify(theirs)}, up to ${PLANTED_WINDOWS.at(-1)} frames`).toBeGreaterThanOrEqual(0);
    }, 120_000);
  });
}
