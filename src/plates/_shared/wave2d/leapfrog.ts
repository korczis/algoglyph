// The S2 wave stencil: explicit leapfrog in time with the central second difference in space, a
// unit cell and a unit time step,
//   u[n+1] = (2 u[n] − u[n−1] + C² · Δu[n]) · damp,   C² = (c·dt/dx)²,
// with Δ the three-point Laplacian on a line (u_E + u_W − 2u) or the five-point one on a grid
// (u_E + u_W + u_N + u_S − 4u). Stable for C² ≤ 1 on a line and C² ≤ 1/2 on a grid. Cells marked
// as walls and the outer ring are held at zero, and `damp` (1 with no sponge) multiplies the new
// value. The 2-D step is ripple-tank's stencil, hoisted here unchanged, so the string, the
// dispersive line and the tank share one scheme and one dispersion relation.
//
// A damped field decays towards zero and would end in subnormal floats, which x86 runs far slower
// than normal ones; with `flushed` every stored value goes through `flush` (src/core/budget.ts).
// Pure: typed arrays only, no p5, no randomness.
import { TINY } from '../../../core/budget';

type Field = Float32Array | Float64Array;

/**
 * One step on a w × h grid: reads u (now) and prev (a step ago), writes nxt for every inner
 * cell; the outer ring of nxt is left as it is (the caller keeps it at zero).
 */
export function leapfrog2d(
  u: Field, prev: Field, nxt: Field, w: number, h: number, c2: number,
  damp: Field, wall: Uint8Array, flushed: boolean,
): void {
  // flush inlined against a local copy of TINY, and u[i] read once: the same arithmetic in the
  // same order, so every stored value is bit-equal to the loop that called flush(v)
  // (test/wave-stencil-hoist.test.ts). An imported binding read inside the loop is a property
  // access per cell under the test runner's module transform (vite-node), which the budget gate
  // measures; a local is not.
  const tiny = TINY;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      if (wall[i]) {
        nxt[i] = 0;
        continue;
      }
      const ui = u[i];
      const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 4 * ui;
      const v = (2 * ui - prev[i] + c2 * lap) * damp[i];
      nxt[i] = flushed ? (v > tiny || v < -tiny ? v : 0) : v;
    }
  }
}

/**
 * One step on a line of n cells, both ends held at zero (a string fixed at both ends): reads u
 * and prev, writes nxt for cells 1 … n − 2. `damp` may be omitted (no damping).
 */
export function leapfrog1d(
  u: Field, prev: Field, nxt: Field, n: number, c2: number, damp?: Field, flushed = false,
): void {
  // flush inlined against a local copy of TINY, as in leapfrog2d: bit-equal, no imported call
  const tiny = TINY;
  for (let i = 1; i < n - 1; i++) {
    const lap = u[i - 1] + u[i + 1] - 2 * u[i];
    const v = (2 * u[i] - prev[i] + c2 * lap) * (damp ? damp[i] : 1);
    nxt[i] = flushed ? (v > tiny || v < -tiny ? v : 0) : v;
  }
  nxt[0] = 0;
  nxt[n - 1] = 0;
}

/**
 * The scheme's dispersion relation on a line: a mode e^{i(kx − ωt)} with k in radians per cell
 * steps exactly when sin(ω/2) = C · sin(k/2), C = √C². Returns ω in radians per step; NaN beyond
 * the stability limit (C·sin(k/2) > 1).
 */
export function leapfrogOmega(k: number, c2: number): number {
  const s = Math.sqrt(c2) * Math.sin(k / 2);
  return Math.abs(s) > 1 ? NaN : 2 * Math.asin(s);
}

/** The group velocity dω/dk of the scheme, in cells per step: C cos(k/2) / √(1 − C² sin²(k/2)). */
export function leapfrogGroupVelocity(k: number, c2: number): number {
  const c = Math.sqrt(c2);
  const s = c * Math.sin(k / 2);
  return (c * Math.cos(k / 2)) / Math.sqrt(1 - s * s);
}

/** The phase velocity ω/k of the scheme, in cells per step. */
export function leapfrogPhaseVelocity(k: number, c2: number): number {
  return leapfrogOmega(k, c2) / k;
}
