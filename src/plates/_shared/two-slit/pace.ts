// The pace of the two-slit plates, provisional until ADR 0008's paceParam (config/pacing.yaml)
// is on main: the owner's ceiling is 30 visible changes a second, and every particle that lands
// is one. The control is the number of particles a frame across all runs, on a log₁₀ slider; its
// default, 10^−0.4 ≈ 0.40 a frame, is 24 a second at 60 frames a second. The fraction is carried,
// never rounded up: 0.4 a frame is two particles every five frames. Claims pin the slider's top,
// which changes how fast a run is drawn and nothing it measures: each run draws from its own
// seeded stream in its own order (test/two-slit.test.ts runs a plate at both ends to show it).
import type { RangeParam } from '../../../core/plate';

/** log₁₀ of the calm default, particles a frame across all runs. */
export const CALM = -0.4;
/** log₁₀ of the fastest pace: the per-frame work the main-thread budget measures. */
export const FASTEST = 3.3;

export function rateParam(noun: string): RangeParam {
  return {
    kind: 'range', key: 'rate', label: `${noun} per frame, all runs (log₁₀)`, min: -1, max: FASTEST,
    step: 0.1, value: CALM,
    hint: 'Provisional pace: the default stays under 30 landings a second.',
  };
}

/** Whole particles for this frame at 10^rate a frame, the fraction carried to the next. */
export class Pacer {
  private carry = 0;

  take(rate: number): number {
    this.carry += 10 ** rate;
    const whole = Math.floor(this.carry + 1e-9);
    this.carry -= whole;
    return whole;
  }
}

/**
 * Hand `budget` single steps, each to the run with the most left to do (the lowest index on a
 * tie), so runs of one length shown side by side grow together across frames as well as within
 * one. `step(r)` advances run r by one particle.
 */
export function roundRobin(budget: number, remaining: (r: number) => number, runs: number,
  step: (r: number) => void): void {
  for (let left = budget; left > 0; left--) {
    let pick = -1;
    let most = 0;
    for (let r = 0; r < runs; r++) {
      const m = remaining(r);
      if (m > most) {
        most = m;
        pick = r;
      }
    }
    if (pick < 0) return;
    step(pick);
  }
}
