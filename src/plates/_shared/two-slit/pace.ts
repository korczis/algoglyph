// How the two-slit plates share their particles out (ADR 0008 paces them: every particle that
// lands is one change, paced by src/core/pace.ts from the run's own count of particles). Claims pin
// the pace control's top, which changes how fast a run is drawn and nothing it measures: each run
// draws from its own seeded stream in its own order (test/two-slit.test.ts runs a plate at both
// ends to show it).

/** The most particles a frame lands, at the pace control's top: the per-frame work the
 * main-thread budget measures (the provisional log₁₀ slider's top, 10^3.3). */
export const MAX_PER_FRAME = 2000;

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
