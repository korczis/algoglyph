// Reading and predicting the fringes on a detector line. Measured: the local maxima and minima of
// a sampled intensity, each placed between cells by the parabola through it and its neighbours.
// Predicted: where the waves of two coherent point sources arrive in phase, from the exact path
// lengths r₁, r₂ to each point of the line and the wavenumber each path travels with, the grid's
// own k(θ) from its dispersion relation (or the continuum ω/c): a maximum wherever
//   (φ₁ − k(θ₁) r₁) − (φ₂ − k(θ₂) r₂) = 2πm.
// The far-field spacing λL/d is src/plates/_shared/two-slit/screen.ts's fringePeriod; this is the
// near-field, grid-aware prediction it is compared with.
import { numericalWavenumber } from './wave';

export interface Extremum {
  /** Position in cells along the line, between cells. */
  at: number;
  value: number;
}

/** Local maxima and minima of `I` strictly inside [from, to), placed by a parabola. */
export function extrema(I: ArrayLike<number>, from: number, to: number): { maxima: Extremum[]; minima: Extremum[] } {
  const maxima: Extremum[] = [];
  const minima: Extremum[] = [];
  for (let i = Math.max(1, from + 1); i < Math.min(I.length - 1, to - 1); i++) {
    const l = I[i - 1];
    const c = I[i];
    const r = I[i + 1];
    const isMax = c > l && c >= r;
    const isMin = c < l && c <= r;
    if (!isMax && !isMin) continue;
    const den = l - 2 * c + r;
    const p = den !== 0 ? (0.5 * (l - r)) / den : 0;
    const e = { at: i + p, value: c - 0.25 * (l - r) * p };
    (isMax ? maxima : minima).push(e);
  }
  return { maxima, minima };
}

export interface PointSource {
  x: number;
  y: number;
  /** Phase added to the source's drive (radians). */
  phase: number;
  /** Drive amplitude (default 1). */
  amplitude?: number;
}

export interface Prediction {
  sources: [PointSource, PointSource];
  /** The detector line x = detectorX, scanned for y in [from, to]. */
  detectorX: number;
  from: number;
  to: number;
  omega: number;
  courant: number;
  /** Use the continuum k = ω/c instead of the grid's k(θ). */
  continuum?: boolean;
}

/** The phase difference of the two arrivals at (detectorX, y), in cycles. */
export function phaseCycles(p: Prediction, y: number): number {
  const arrival = (s: PointSource) => {
    const dx = p.detectorX - s.x;
    const dy = y - s.y;
    const r = Math.hypot(dx, dy);
    const k = p.continuum ? p.omega / p.courant : numericalWavenumber(p.omega, p.courant, Math.atan2(dy, dx));
    return s.phase - k * r;
  };
  return (arrival(p.sources[0]) - arrival(p.sources[1])) / (2 * Math.PI);
}

/**
 * The intensity the two sources make at (detectorX, y), up to a constant: each arrives with the
 * 2-D far-field amplitude of a point source, a/√r, and the phase of its path, so
 *   I = a₁²/r₁ + a₂²/r₂ + 2 a₁a₂/√(r₁r₂) · cos(Δψ).
 * Its maxima sit where the phases agree only when the two amplitudes are flat across the fringe;
 * off the axis, or with a phase offset, the a/√r slopes pull them a little.
 */
export function predictedIntensity(p: Prediction, y: number): number {
  const parts = p.sources.map((s) => {
    const dx = p.detectorX - s.x;
    const dy = y - s.y;
    const r = Math.hypot(dx, dy);
    const k = p.continuum ? p.omega / p.courant : numericalWavenumber(p.omega, p.courant, Math.atan2(dy, dx));
    const amp = (s.amplitude ?? 1) / Math.sqrt(r);
    const ph = s.phase - k * r;
    return [amp * Math.cos(ph), amp * Math.sin(ph)];
  });
  const re = parts[0][0] + parts[1][0];
  const im = parts[0][1] + parts[1][1];
  return re * re + im * im;
}

/** The maxima of predictedIntensity on the line, from a scan every twentieth of a cell, each
 * placed by the parabola through the scan's three points around it. */
export function predictedIntensityMaxima(p: Prediction): number[] {
  const step = 0.05;
  const n = Math.floor((p.to - p.from) / step);
  const out: number[] = [];
  let a = predictedIntensity(p, p.from);
  let b = predictedIntensity(p, p.from + step);
  for (let i = 2; i <= n; i++) {
    const c = predictedIntensity(p, p.from + i * step);
    if (b > a && b >= c) {
      const den = a - 2 * b + c;
      out.push(p.from + (i - 1) * step + (den !== 0 ? (0.5 * (a - c)) / den : 0) * step);
    }
    a = b;
    b = c;
  }
  return out;
}

/** Positions y on the line where the two arrive in phase, ascending. */
export function predictedMaxima(p: Prediction): number[] {
  // a hundredth of a cell on a detector line, at most 100,000 points on a long one
  const steps = Math.min(100_000, Math.max(2000, Math.ceil((p.to - p.from) / 0.01)));
  const h = (p.to - p.from) / steps;
  const out: number[] = [];
  let y0 = p.from;
  let g0 = phaseCycles(p, y0);
  for (let s = 1; s <= steps; s++) {
    const y1 = p.from + s * h;
    const g1 = phaseCycles(p, y1);
    const lo = Math.min(g0, g1);
    const hi = Math.max(g0, g1);
    for (let m = Math.ceil(lo); m <= hi; m++) {
      if (m === lo && s > 1) continue; // a crossing exactly on a scan point is counted once
      out.push(g1 === g0 ? y0 : y0 + ((m - g0) / (g1 - g0)) * h);
    }
    y0 = y1;
    g0 = g1;
  }
  return out;
}
