// Maxwell's equations in one dimension on Yee's staggered grid (plan S9a): E_z at whole cells, H_y at
// half cells, leapfrogged in time, in units where c = ε₀ = μ₀ = 1 and a cell is one length unit. A
// cell may hold a dielectric (ε), a conductor (σ, centred in time), and a medium of bound electrons
// whose polarisation P obeys P'' + γP' + ω₀²P = fω_p²E, the equation of the driven oscillator,
// advanced by central differences beside the field (an auxiliary differential equation; the
// parameters are those of src/plates/_shared/lumped/medium.ts). The ends absorb by Mur's first-order
// condition, exact for a wave in vacuum at the Courant number 1, so a vacuum margin precedes them.
// Measured, never assumed: the flux ∫E H dt past a probe, an amplitude and phase by lock-in.
import type { Resonance } from '../lumped/medium';

export interface Cells {
  n: number;
  /** Relative permittivity and conductivity per cell (E nodes). */
  eps: Float64Array;
  sigma: Float64Array;
  /** Bound electrons per cell (null where there are none) and the medium's ω_p². */
  lorentz: (Resonance | null)[];
  wp2: number;
}

export function vacuum(n: number): Cells {
  return { n, eps: new Float64Array(n).fill(1), sigma: new Float64Array(n), lorentz: new Array(n).fill(null), wp2: 0 };
}

/** One run of the grid: fields, polarisation, time, and a soft source added to E at `src`. */
export class Yee {
  readonly E: Float64Array;
  readonly H: Float64Array;
  private readonly P: Float64Array;
  private readonly Pold: Float64Array;
  private readonly D: Float64Array;
  private readonly ca: Float64Array;
  private readonly cb: Float64Array;
  private readonly bound: Int32Array;
  t = 0;
  steps = 0;

  /** dt = S (cells), S ≤ 1 for stability in vacuum. */
  constructor(readonly cells: Cells, readonly S: number, readonly src: number, readonly drive: (t: number) => number) {
    const { n } = cells;
    this.E = new Float64Array(n);
    this.H = new Float64Array(n);
    this.P = new Float64Array(n);
    this.Pold = new Float64Array(n);
    this.D = new Float64Array(n);
    this.ca = new Float64Array(n);
    this.cb = new Float64Array(n);
    const bound: number[] = [];
    for (let i = 0; i < n; i++) {
      const e = cells.eps[i];
      const loss = (cells.sigma[i] * S) / (2 * e);
      this.ca[i] = (1 - loss) / (1 + loss);
      this.cb[i] = S / e / (1 + loss);
      if (cells.lorentz[i]) bound.push(i);
    }
    this.bound = Int32Array.from(bound);
  }

  step(): void {
    const { E, H, P, Pold, D, ca, cb, S, cells } = this;
    const n = cells.n;
    for (let i = 0; i < n - 1; i++) H[i] += S * (E[i + 1] - E[i]);
    const e0 = E[1];
    const eN = E[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (cells.lorentz[i]) continue;
      E[i] = ca[i] * E[i] + cb[i] * (H[i] - H[i - 1]);
    }
    // bound electrons: D advances with the curl, P with its oscillator, E = (D − P)/ε
    const dt = S;
    for (const i of this.bound) {
      const r = cells.lorentz[i]!;
      D[i] += S * (H[i] - H[i - 1]);
      const next = ((2 - r.w0 * r.w0 * dt * dt) * P[i] - (1 - (r.gamma * dt) / 2) * Pold[i] + r.f * cells.wp2 * dt * dt * E[i])
        / (1 + (r.gamma * dt) / 2);
      Pold[i] = P[i];
      P[i] = next;
      E[i] = (D[i] - P[i]) / cells.eps[i];
    }
    this.t += dt;
    this.steps++;
    E[this.src] += this.drive(this.t);
    // Mur's first-order absorbing ends: exact in vacuum at S = 1, otherwise first order
    const k = (S - 1) / (S + 1);
    E[0] = e0 + k * (E[1] - E[0]);
    E[n - 1] = eN + k * (E[n - 2] - E[n - 1]);
  }
}

/** A Gaussian pulse of carrier ω and envelope width `width` (time), centred at t0. */
export const pulse = (w: number, width: number, t0: number) => (t: number) =>
  Math.exp(-(((t - t0) / width) ** 2)) * Math.sin(w * (t - t0));

/** A sinusoid switched on smoothly over `ramp`. */
export const cw = (w: number, ramp: number) => (t: number) =>
  (t < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * t) / ramp) : 1) * Math.sin(w * t);
