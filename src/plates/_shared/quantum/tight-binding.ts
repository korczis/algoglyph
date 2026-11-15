// A particle hopping along a chain of sites (plan S10, tight binding), ħ = 1, sites b = 1 apart:
// H = Σ εₙ|n⟩⟨n| − A Σ (|n⟩⟨n + 1| + |n + 1⟩⟨n|), the chain open at both ends. Its spectrum is the
// same symmetric tridiagonal problem as the finite-difference Schrödinger equation of eigen.ts with
// the grid step h = 1/√(2A): that matrix is H + 2A, so its Sturm-bisection eigenvalues less 2A are
// the chain's. Time evolution is Crank–Nicolson, (1 + iΔtH/2)ψ′ = (1 − iΔtH/2)ψ, one complex
// tridiagonal solve per step: unitary to round-off and exact on every eigenstate's probability.
// Nothing here knows the cosine band, the bound state of an impurity or its transmission. Pure.
import { eigenvalues, eigenvector } from './eigen';

/** The grid step that maps the chain onto eigen.ts's Schrödinger matrix. */
export const stepFor = (A: number): number => 1 / Math.sqrt(2 * A);

/** The chain's lowest `count` energies. */
export function chainSpectrum(eps: ArrayLike<number>, A: number, count = eps.length): number[] {
  return eigenvalues(eps, stepFor(A), count).map((e) => e - 2 * A);
}

/** The eigenvector of energy E, normalised to Σ|ψₙ|² = 1. */
export function chainMode(eps: ArrayLike<number>, A: number, E: number): Float64Array {
  const h = stepFor(A);
  const v = eigenvector(eps, h, E + 2 * A);
  // eigen.ts normalises Σψ²h = 1
  const s = Math.sqrt(v.reduce((t, x) => t + x * x, 0));
  return v.map((x) => x / s);
}

export interface Wave {
  re: Float64Array;
  im: Float64Array;
}

/** A Gaussian packet exp(−(n − n₀)²/4σ² + ik₀n), normalised. */
export function packet(N: number, n0: number, sigma: number, k0: number): Wave {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let s = 0;
  for (let n = 0; n < N; n++) {
    const a = Math.exp(-((n - n0) ** 2) / (4 * sigma * sigma));
    re[n] = a * Math.cos(k0 * n);
    im[n] = a * Math.sin(k0 * n);
    s += a * a;
  }
  const f = 1 / Math.sqrt(s);
  for (let n = 0; n < N; n++) { re[n] *= f; im[n] *= f; }
  return { re, im };
}

/** One Crank–Nicolson step of dt, in place, with scratch of the chain's length. */
export class CrankNicolsonChain {
  private readonly cr: Float64Array;
  private readonly ci: Float64Array;
  private readonly rr: Float64Array;
  private readonly ri: Float64Array;

  constructor(readonly eps: ArrayLike<number>, readonly A: number, readonly dt: number) {
    const N = eps.length;
    this.cr = new Float64Array(N);
    this.ci = new Float64Array(N);
    this.rr = new Float64Array(N);
    this.ri = new Float64Array(N);
  }

  step(w: Wave): void {
    const { eps, A, dt } = this;
    const N = eps.length;
    const a = dt / 2;
    const { re, im, } = w;
    const { rr, ri, cr, ci } = this;
    // r = (1 − iaH)ψ, Hψ = εψ − A(ψ₋ + ψ₊)
    for (let n = 0; n < N; n++) {
      const hr = eps[n] * re[n] - A * ((n > 0 ? re[n - 1] : 0) + (n + 1 < N ? re[n + 1] : 0));
      const hi = eps[n] * im[n] - A * ((n > 0 ? im[n - 1] : 0) + (n + 1 < N ? im[n + 1] : 0));
      rr[n] = re[n] + a * hi;
      ri[n] = im[n] - a * hr;
    }
    // (1 + iaH)x = r: diagonal 1 + iaεₙ, off-diagonal −iaA; Thomas in complex arithmetic
    const offI = -a * A;
    let pr = 1;
    let pi = a * eps[0];
    let d = pr * pr + pi * pi;
    // c₀ = off / p₀, x₀ = r₀ / p₀ (off is purely imaginary)
    cr[0] = (offI * pi) / d;
    ci[0] = (offI * pr) / d;
    re[0] = (rr[0] * pr + ri[0] * pi) / d;
    im[0] = (ri[0] * pr - rr[0] * pi) / d;
    for (let n = 1; n < N; n++) {
      // p = diag − off·c₋, with off = i·offI
      pr = 1 + offI * ci[n - 1];
      pi = a * eps[n] - offI * cr[n - 1];
      d = pr * pr + pi * pi;
      cr[n] = (offI * pi) / d;
      ci[n] = (offI * pr) / d;
      // x = (r − off·x₋) / p
      const nr = rr[n] + offI * im[n - 1];
      const ni = ri[n] - offI * re[n - 1];
      re[n] = (nr * pr + ni * pi) / d;
      im[n] = (ni * pr - nr * pi) / d;
    }
    for (let n = N - 2; n >= 0; n--) {
      const xr = re[n + 1];
      const xi = im[n + 1];
      re[n] -= cr[n] * xr - ci[n] * xi;
      im[n] -= cr[n] * xi + ci[n] * xr;
    }
  }
}

/** Σ|ψₙ|², ⟨n⟩, and the probability beyond site `from`. */
export function moments(w: Wave, from = Infinity): { norm: number; mean: number; beyond: number } {
  let norm = 0;
  let mean = 0;
  let beyond = 0;
  for (let n = 0; n < w.re.length; n++) {
    const p = w.re[n] * w.re[n] + w.im[n] * w.im[n];
    norm += p;
    mean += n * p;
    if (n > from) beyond += p;
  }
  return { norm, mean: mean / norm, beyond };
}
