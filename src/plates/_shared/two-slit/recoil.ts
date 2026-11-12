// A slit wall free to recoil (FLP III/1, the thought experiment with the movable wall), as a
// quantum state of the wall's position X along the slit axis.
//
// A particle that reaches screen point x through slit j leaves the wall with transverse momentum
// −p(x − sⱼ)/L (paraxial); the two paths differ by Δq = p·d/L whatever x is. So the wall ends in
//   φⱼ = e^{−i qⱼ X/ħ} φ,  and the paths' overlap is  γ = ⟨φ₁|φ₂⟩ = ⟨φ| e^{iΔq X/ħ} |φ⟩,
// the characteristic function of the wall's position density at Δq/ħ = 2π/Λ (Λ = λL/d = 2πħ/Δq).
// The pattern on the screen is 1 + |γ| cos(2πx/Λ − arg γ): the same as the fringe pattern smeared
// by the wall's position uncertainty, the two readings of one formula.
//
// Reading the wall's momentum to learn the path distinguishes the two kicked momentum densities
// |φ̃(k)|² and |φ̃(k − Δq/ħ)|² at best by their total-variation distance D. Englert's duality then
// bounds D² + V² ≤ 1, with equality only for the optimal (Helstrom) measurement, which a momentum
// reading is not: D² + V² < 1 strictly for a Gaussian wall with 0 < σₚ < ∞.
// For a minimum-uncertainty Gaussian (σₓσₚ = ħ/2): V = exp(−Δq²σₓ²/2ħ²) = exp(−Δq²/8σₚ²) and
// D = erf(Δq/(2√2 σₚ)). A chirped Gaussian, e^{−X²(1 − ic)/4σₓ²}, has the same |φ|² and so the same
// V, with σₓσₚ = (ħ/2)√(1 + c²): more momentum spread, the same visibility.
//
// Idealisations: the wall is heavy enough that its packet does not spread while the particle
// passes (σₚτ/M ≪ σₓ), plane-wave illumination, point-like slits (the envelope is flat across the
// fringes measured). ΔxΔp here are standard deviations (≥ ħ/2), not the lecture's order-of-
// magnitude Δx·Δp ≈ h.
import { Fft } from '../fft/fft';
import { erf } from './math';

export type WallState = 'gaussian' | 'chirped';

/** The chirp c of the chirped state: σₓσₚ = (ħ/2)√(1 + c²) = (ħ/2)·√5. */
export const CHIRP = 2;
/** Grid points of the wall's state (a power of two for the FFT). */
export const POINTS = 4096;

/** The ratio σₓσₚ/(ħ/2) a state has in closed form. */
export const uncertaintyRatio = (state: WallState): number =>
  state === 'chirped' ? Math.sqrt(1 + CHIRP * CHIRP) : 1;

/**
 * The wall's state on a grid, in units where ħ = 1 and the fringe period Λ = 1, so Δq/ħ = 2π.
 * `sigmaP` is the momentum spread σₚ in units of Δq. The window is a whole number of periods,
 * wide enough (64 σₓ) to resolve the momentum density, and the kick 2π is then a whole number of
 * momentum cells.
 */
export class Wall {
  readonly state: WallState;
  readonly sigmaP: number;
  readonly sigmaX: number;
  readonly periods: number;
  readonly h: number;
  readonly x: Float64Array;
  readonly re: Float64Array;
  readonly im: Float64Array;
  /** |φ|² h, summing to 1. */
  readonly rho: Float64Array;
  /** The kick Δq/ħ in momentum cells. */
  readonly shift: number;

  constructor(state: WallState, sigmaP: number) {
    this.state = state;
    this.sigmaP = sigmaP;
    const dq = 2 * Math.PI; // Δq/ħ with Λ = 1
    const sk = sigmaP * dq; // σₖ = σₚ/ħ
    this.sigmaX = uncertaintyRatio(state) / (2 * sk);
    this.periods = Math.max(4, Math.ceil(64 * this.sigmaX));
    const width = this.periods;
    this.h = width / POINTS;
    this.shift = this.periods; // 2π / (2π/width) cells
    this.x = new Float64Array(POINTS);
    this.re = new Float64Array(POINTS);
    this.im = new Float64Array(POINTS);
    this.rho = new Float64Array(POINTS);
    const c = state === 'chirped' ? CHIRP : 0;
    const s2 = 4 * this.sigmaX * this.sigmaX;
    let norm = 0;
    for (let i = 0; i < POINTS; i++) {
      const X = (i - POINTS / 2) * this.h;
      this.x[i] = X;
      const amp = Math.exp(-(X * X) / s2);
      const phase = (c * X * X) / s2;
      this.re[i] = amp * Math.cos(phase);
      this.im[i] = amp * Math.sin(phase);
      norm += amp * amp;
    }
    const scale = 1 / Math.sqrt(norm * this.h);
    for (let i = 0; i < POINTS; i++) {
      this.re[i] *= scale;
      this.im[i] *= scale;
      this.rho[i] = (this.re[i] ** 2 + this.im[i] ** 2) * this.h;
    }
  }

  /** Δx and Δk (standard deviations) from the grid: position from |φ|², momentum from |FFT φ|². */
  spreads(): { dx: number; dk: number } {
    let m = 0;
    let m2 = 0;
    for (let i = 0; i < POINTS; i++) {
      m += this.rho[i] * this.x[i];
      m2 += this.rho[i] * this.x[i] * this.x[i];
    }
    const pk = this.momentum();
    const dk = (2 * Math.PI) / (POINTS * this.h);
    let k1 = 0;
    let k2 = 0;
    for (let j = 0; j < POINTS; j++) {
      const k = (j < POINTS / 2 ? j : j - POINTS) * dk;
      k1 += pk[j] * k;
      k2 += pk[j] * k * k;
    }
    return { dx: Math.sqrt(m2 - m * m), dk: Math.sqrt(k2 - k1 * k1) };
  }

  /** The momentum density |φ̃(k)|², summing to 1, in FFT order. */
  momentum(): Float64Array {
    const re = Float64Array.from(this.re);
    const im = Float64Array.from(this.im);
    new Fft(POINTS).transform(re, im);
    const out = new Float64Array(POINTS);
    let s = 0;
    for (let j = 0; j < POINTS; j++) {
      out[j] = re[j] * re[j] + im[j] * im[j];
      s += out[j];
    }
    for (let j = 0; j < POINTS; j++) out[j] /= s;
    return out;
  }

  /** γ = Σ |φ|² e^{iΔq X/ħ} h, the overlap of the two kicked wall states (a numerical integral). */
  overlap(): { re: number; im: number } {
    let re = 0;
    let im = 0;
    for (let i = 0; i < POINTS; i++) {
      const a = 2 * Math.PI * this.x[i];
      re += this.rho[i] * Math.cos(a);
      im += this.rho[i] * Math.sin(a);
    }
    return { re, im };
  }

  /**
   * The fringe contrast read from the screen: the pattern 1 + cos(2πx) (Λ = 1) smeared by the
   * wall's position density, convolved numerically onto a screen grid of `cells` per period over
   * four periods, then measured by projection on the fringe. Returns |contrast|.
   */
  smearedContrast(cells = 64): number {
    const n = 4 * cells;
    let c = 0;
    let s = 0;
    let si = 0;
    for (let i = 0; i < n; i++) {
      const xs = i / cells;
      let p = 0;
      for (let j = 0; j < POINTS; j++) {
        const r = this.rho[j];
        if (r < 1e-18) continue;
        p += r * (1 + Math.cos(2 * Math.PI * (xs - this.x[j])));
      }
      c += p * Math.cos(2 * Math.PI * xs);
      si += p * Math.sin(2 * Math.PI * xs);
      s += p;
    }
    return (2 * Math.hypot(c, si)) / s;
  }

  /** D: the total-variation distance between the momentum densities the two paths leave. */
  distinguishability(): number {
    const pk = this.momentum();
    let d = 0;
    for (let j = 0; j < POINTS; j++) d += Math.abs(pk[j] - pk[(j - this.shift + POINTS) % POINTS]);
    return d / 2;
  }

  /** A wall position drawn from |φ|² (in periods), by its cumulative on the grid. */
  sampler(): (rnd: () => number) => number {
    const cdf = new Float64Array(POINTS + 1);
    for (let i = 0; i < POINTS; i++) cdf[i + 1] = cdf[i] + this.rho[i];
    const top = cdf[POINTS];
    return (rnd) => {
      const u = rnd() * top;
      let lo = 0;
      let hi = POINTS;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] <= u) lo = mid;
        else hi = mid;
      }
      const span = cdf[lo + 1] - cdf[lo];
      const t = span > 0 ? (u - cdf[lo]) / span : 0.5;
      return this.x[Math.min(POINTS - 1, lo)] + (t - 0.5) * this.h;
    };
  }
}

/** Closed forms for a wall with momentum spread σₚ (units of Δq): V and D. */
export function closedForm(state: WallState, sigmaP: number): { v: number; d: number } {
  const sigmaX = uncertaintyRatio(state) / (2 * sigmaP * 2 * Math.PI); // in Λ
  return {
    v: Math.exp(-2 * Math.PI * Math.PI * sigmaX * sigmaX),
    d: erf(1 / (2 * Math.SQRT2 * sigmaP)),
  };
}
