// Runs shown side by side (one slit shut, the other shut, both open) grow together: the pace
// (src/core/pace.ts, ADR 0008) says how many particles a frame lands, this says which run gets each.

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
