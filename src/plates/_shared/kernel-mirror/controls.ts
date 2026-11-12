// The pace the bespoke sorting plates share (ADR 0008): an endless stream of kernel steps (trials,
// runs, checks), so their calm rate is a stream's ceiling (config/pacing.yaml), and the pace
// control multiplies it up to the old select's top of sixteen thousand steps per frame, the
// budget gate's heaviest corner. A thumbnail is drawn from a few frames and keeps its old speed.
import { calm, Pacer, paceParam, type PaceDecl } from '../../../core/pace';
import type { RangeParam } from '../../../core/plate';

/** The most kernel steps a frame runs: the old speed select's top. */
export const MAX_STEPS_PER_FRAME = 16384;

/** How these plates are paced. */
export const STEP_PACE: PaceDecl = { kind: 'stream', unit: 'kernel steps' };

/** The pace control, reaching MAX_STEPS_PER_FRAME at its top. */
export function stepPaceParam(): RangeParam {
  return { ...paceParam(), max: MAX_STEPS_PER_FRAME / calm('stream') };
}

/** One plate's pace: whole kernel steps per frame from the fractional calm rate. */
export function stepPacer(): Pacer {
  return new Pacer('stream', 'kernel steps', MAX_STEPS_PER_FRAME);
}
