// U-signal (ADR 0010), shared by test/u-signal/*.test.ts: the signal engine and its adopting kernels read a reader's series, and on
// every seeded input they must run exactly as before. The current engine with each current kernel
// and the engine and kernel as they were before U-signal (test/fixtures/u-signal-before) make
// their plates, and both record every p5 call, every pixel of every blit and every readout, frame
// by frame, within one run: at the defaults and at every option of every select. The clock is a
// counter reset per recording, so time-sliced work slices the same in both. A planted change (a
// select moved to its next option on one side) must fail the same comparison.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Params, PlateCode } from '../../src/core/plate';
import { engine as now } from '../../src/engines/signal/index';
import type { SignalKernel } from '../../src/engines/signal/trace';
import { engine as before } from '../fixtures/u-signal-before/src/engines/signal/index';
import { firstDifference, record, type Recording } from '../support/identity';

const FRAMES = 30;

let clock = 0;
const run = (plate: PlateCode, over: Params): Recording => { clock = 0; return record(plate, over, FRAMES); };

/** The defaults, and each option of each select in turn. */
function corners(plate: PlateCode): Params[] {
  const out: Params[] = [{}];
  for (const d of plate.params) if (d.kind === 'select' && !d.cosmetic) for (const o of d.options) out.push({ [d.key]: o.value });
  return out;
}

/** The identity proof for one adopting kernel: call it at the top level of its test file. */
export function sameSeededRuns(id: string, k: SignalKernel, kb: SignalKernel): void {
  describe(`U-signal: ${id}'s every seeded run is the run it was`, () => {
    beforeEach(() => { vi.spyOn(performance, 'now').mockImplementation(() => (clock += 0.05)); });
    afterEach(() => { vi.restoreAllMocks(); });

    const info = { id, title: id, group: 'u-signal' };
    it(`${id}: records exactly what the engine and kernel before recorded, at the defaults and every option`, () => {
      const a = now.plate(info, k); const b = before.plate(info, kb);
      for (const c of corners(a)) expect(firstDifference(run(a, c), run(b, c)), JSON.stringify(c)).toBe(-1);
    }, 120_000);

    it(`${id}: a planted change (a select moved to its next option) fails the same comparison`, () => {
      const a = now.plate(info, k); const b = before.plate(info, kb);
      const d = a.params.find((q) => q.kind === 'select' && !q.cosmetic && q.options.length > 1);
      if (!d || d.kind !== 'select') throw new Error(`${id}: no select to move`);
      expect(firstDifference(run(a, { [d.key]: d.options[1].value }), run(b, { [d.key]: d.options[0].value }))).toBeGreaterThanOrEqual(0);
    }, 120_000);
  });
}
