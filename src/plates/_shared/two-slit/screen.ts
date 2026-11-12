// Two slits in the far field, the amplitude model shared by the figure pages of FLP III/1.
//
// Two slits of width a, centres ±d/2, lit by a monochromatic, spatially coherent plane wave of
// wavelength λ; a screen at distance L in the Fraunhofer regime (L ≫ a²/λ, paraxial). Through slit
// j alone the amplitude at screen position x is
//   ψⱼ(x) = √(a / 2λL) · sinc(π a x / λL) · e^{∓iπ d x / λL},
// so each slit alone gives the density |ψⱼ|² = e(x)/2 with the envelope
//   e(x) = (a/λL) · sinc²(π a x / λL),   ∫ e dx = 1 over the whole line,
// and both slits, with a relative phase θ added to the second path, give
//   |ψ₁ + e^{iθ}ψ₂|² = e(x) · (1 + cos(2πx/Λ + θ)),   Λ = λL/d,
// because the envelope is real and only its square enters. The cross term integrates to zero over
// the line whenever d ≥ a (the Fourier transform of sinc² is a triangle of half-width a/λL), so a
// passing particle lands somewhere with probability one whatever θ is.
//
// Densities are per emitted particle: with one slit closed, half of what is emitted is stopped by
// it (the source lights the two openings equally), so P₁ + P₂ and P₁₂ compare at the same flux.
// Pure: no p5, and the only randomness is the generator passed in.
import { cumulative, integrate, sinc } from './math';

export interface Slits {
  /** Wavelength (m). */
  lambda: number;
  /** Slit separation, centre to centre (m). */
  d: number;
  /** Slit width (m). */
  a: number;
  /** Slit to screen (m). */
  L: number;
}

/** The fringe period on the screen, Λ = λL/d (m). */
export const fringePeriod = (s: Slits): number => (s.lambda * s.L) / s.d;

/** The single-slit envelope e(x), normalised to 1 over the line (1/m). */
export function envelope(s: Slits, x: number): number {
  const u = (Math.PI * s.a * x) / (s.lambda * s.L);
  const k = sinc(u);
  return (s.a / (s.lambda * s.L)) * k * k;
}

/** P₁ (or P₂): the density per emitted particle with the other slit closed (1/m). */
export const oneSlit = (s: Slits, x: number): number => envelope(s, x) / 2;

/** P₁₂ with relative phase θ: e(x)·(1 + cos(2πx/Λ + θ)) per emitted particle (1/m). */
export function twoSlit(s: Slits, x: number, theta = 0): number {
  return envelope(s, x) * (1 + Math.cos((2 * Math.PI * x) / fringePeriod(s) + theta));
}

/** The screen half-width the plates show: past the first envelope zero at λL/a. */
export const halfWidth = (s: Slits): number => (1.5 * s.lambda * s.L) / s.a;

/** Cells of the sampling table across the screen window. */
export const TABLE_CELLS = 4096;
/** Simpson cells of every integral of the closed form (finer than the table, a different rule). */
export const FINE_CELLS = 65_536;

export type Outcome = 'hit' | 'blocked' | 'missed';

/**
 * The screen window [−X, X] and a sampler for arrivals on it. Positions are drawn from a table of
 * the envelope (its value at each cell's midpoint, a piecewise-constant density whose cumulative
 * is linear within a cell, inverted exactly) and accepted with probability
 * (1 + cos(2πx/Λ + θ))/2, which turns the envelope into the two-slit density for that θ. The table
 * never sees the fringes, so the interference in the hits is the acceptance's doing alone.
 */
export class Screen {
  readonly s: Slits;
  readonly X: number;
  readonly period: number;
  /** ∫ over the window of e(x) and of e(x)·cos(2πx/Λ): the window's share at any θ is
   * W(θ) = We + Wc·cos θ (the sine part vanishes on a symmetric window). */
  readonly We: number;
  readonly Wc: number;
  private readonly cdf: Float64Array;

  constructor(s: Slits, X = halfWidth(s), cells = TABLE_CELLS) {
    this.s = s;
    this.X = X;
    this.period = fringePeriod(s);
    const h = (2 * X) / cells;
    const cdf = new Float64Array(cells + 1);
    for (let i = 0; i < cells; i++) cdf[i + 1] = cdf[i] + envelope(s, -X + (i + 0.5) * h);
    const top = cdf[cells];
    for (let i = 0; i <= cells; i++) cdf[i] /= top;
    this.cdf = cdf;
    this.We = integrate((x) => envelope(s, x), -X, X, FINE_CELLS);
    const k = (2 * Math.PI) / this.period;
    this.Wc = integrate((x) => envelope(s, x) * Math.cos(k * x), -X, X, FINE_CELLS);
  }

  /** The window position whose table cumulative is u, u in [0, 1). */
  inverse(u: number): number {
    const cdf = this.cdf;
    let lo = 0;
    let hi = cdf.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] <= u) lo = mid;
      else hi = mid;
    }
    const span = cdf[hi] - cdf[lo];
    const t = span > 0 ? (u - cdf[lo]) / span : 0.5;
    const h = (2 * this.X) / (cdf.length - 1);
    return -this.X + (lo + t) * h;
  }

  /** A window position drawn from the two-slit density with phase θ (rejection on the envelope). */
  fringe(rnd: () => number, theta: number): number {
    const k = (2 * Math.PI) / this.period;
    for (;;) {
      const x = this.inverse(rnd());
      if (2 * rnd() < 1 + Math.cos(k * x + theta)) return x;
    }
  }

  /**
   * One emitted particle with one slit open: stopped by the closed slit half the time, otherwise
   * arriving inside the window with probability We or outside it.
   */
  emitOne(rnd: () => number): { outcome: Outcome; x: number } {
    if (rnd() < 0.5) return { outcome: 'blocked', x: 0 };
    if (rnd() >= this.We) return { outcome: 'missed', x: 0 };
    return { outcome: 'hit', x: this.inverse(rnd()) };
  }

  /** One emitted particle with both slits open and relative phase θ on the second path. */
  emitTwo(rnd: () => number, theta = 0): { outcome: Outcome; x: number } {
    if (rnd() >= this.We + this.Wc * Math.cos(theta)) return { outcome: 'missed', x: 0 };
    return { outcome: 'hit', x: this.fringe(rnd, theta) };
  }
}

/**
 * The cumulative of the density e(x)·(1 + V cos(2πx/Λ)) over the window, conditioned on landing
 * in it, by Simpson's rule on FINE_CELLS cells: the reference the samples are judged against. It
 * is computed from the closed form, not from the sampler's table.
 */
export function referenceCdf(s: Slits, X: number, V: number, cells = FINE_CELLS): Float64Array {
  const k = (2 * Math.PI) / fringePeriod(s);
  return cumulative((x) => envelope(s, x) * (1 + V * Math.cos(k * x)), -X, X, cells);
}

/**
 * The moments c₀, c₁, c₂ of the envelope over the window against 1, cos and cos² of the fringe
 * phase, which turn a mean of cos(2πx/Λ) over hits into the visibility V of a density
 * e(x)·(1 + V cos(2πx/Λ)): with m that mean, m = (c₁ + V c₂)/(c₀ + V c₁), so
 * V = (c₁ − m c₀)/(m c₁ − c₂), with derivative dV/dm = (c₀c₂ − c₁²)/(m c₁ − c₂)².
 */
export function visibilityMoments(s: Slits, X: number): { c0: number; c1: number; c2: number } {
  const k = (2 * Math.PI) / fringePeriod(s);
  const e = (x: number) => envelope(s, x);
  return {
    c0: integrate(e, -X, X, FINE_CELLS),
    c1: integrate((x) => e(x) * Math.cos(k * x), -X, X, FINE_CELLS),
    c2: integrate((x) => e(x) * Math.cos(k * x) ** 2, -X, X, FINE_CELLS),
  };
}

/**
 * Running estimate of the signed visibility from hits: the mean of cos(2πx/Λ), turned into V by
 * the window moments, with its standard error from the sample variance of the cosine.
 */
export class VisibilityEstimate {
  private n = 0;
  private sum = 0;
  private sumSq = 0;
  constructor(private readonly period: number,
    private readonly m: { c0: number; c1: number; c2: number }) {}

  add(x: number): void {
    const c = Math.cos((2 * Math.PI * x) / this.period);
    this.n++;
    this.sum += c;
    this.sumSq += c * c;
  }

  get count(): number { return this.n; }

  /** V and its standard error; NaN before two hits. */
  value(): { v: number; se: number } {
    if (this.n < 2) return { v: NaN, se: NaN };
    const { c0, c1, c2 } = this.m;
    const mean = this.sum / this.n;
    const variance = Math.max(0, (this.sumSq - this.n * mean * mean) / (this.n - 1));
    const den = mean * c1 - c2;
    const v = (c1 - mean * c0) / den;
    const dvdm = (c0 * c2 - c1 * c1) / (den * den);
    return { v, se: Math.abs(dvdm) * Math.sqrt(variance / this.n) };
  }
}
