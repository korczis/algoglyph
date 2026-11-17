// What the ripple tank's second-pass experiments measure from their own field, and the closed
// forms each is compared with. Pure: typed arrays and numbers, no p5.
//
// - Phased array: the time-averaged intensity along an arc about the array's centre, the angle
//   of its maximum. Its oracle is the array factor summed element by element (cylindrical waves
//   at the scheme's own wavenumber, numericalWavenumber), at the same radius; far from the array
//   that tends to sin α = Δφ / (k d).
// - Moving source: the Mach cone's half-angle, from the cone's front at several distances behind
//   the source. A source faster than the waves leaves a cone with sin μ = c / v.
// - Drum: a membrane fixed at its rim; a pickup's record, Hann-windowed, gives the modes'
//   frequencies. On the grid, mode (m, n) obeys sin²(ω/2) = C²[sin²(mπ/2(W−1)) + sin²(nπ/2(H−1))];
//   the continuous membrane's f_mn = (c/2)√((m/a)² + (n/b)²).
import { numericalWavenumber } from '../_shared/wave2d/wave';
import { omega, type Tank } from './wave';

/** Bilinear sample of a w-wide field at (x, y). */
function sample(f: Float32Array, w: number, x: number, y: number): number {
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const fx = x - x0; const fy = y - y0;
  const i = y0 * w + x0;
  return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + w] * (1 - fx) + f[i + w + 1] * fx) * fy;
}

/** The arc's angular span and step, in degrees. */
const ARC_SPAN = 64;
const ARC_STEP = 0.25;

/** The array's centre and the arc's radius: as far as the sponge and the far edge allow. */
export function arcOf(t: Tank): { cx: number; cy: number; r: number } {
  const cx = t.sources[0][0];
  const cy = t.sources.reduce((s, q) => s + q[1], 0) / t.sources.length;
  return { cx, cy, r: Math.floor(Math.min(t.w - cx - 22, t.h / 2 - 22)) };
}

/**
 * The main lobe's direction (degrees, positive towards the top rows): the centroid of g over the
 * arc where it exceeds half its maximum. A broad lobe's single peak wanders with its ripple; the
 * centroid above half maximum does not, and it is the same estimator for the field and the oracle.
 */
function lobeOverArc(g: (deg: number) => number): number {
  const xs: number[] = []; const vs: number[] = [];
  for (let a = -ARC_SPAN; a <= ARC_SPAN + 1e-9; a += ARC_STEP) { xs.push(a); vs.push(g(a)); }
  let i0 = 0;
  for (let i = 1; i < vs.length; i++) if (vs[i] > vs[i0]) i0 = i;
  const half = vs[i0] / 2;
  let lo = i0; while (lo > 0 && vs[lo - 1] > half) lo--;
  let hi = i0; while (hi < vs.length - 1 && vs[hi + 1] > half) hi++;
  let sum = 0; let wsum = 0;
  for (let i = lo; i <= hi; i++) { sum += xs[i] * (vs[i] - half); wsum += vs[i] - half; }
  return wsum > 0 ? sum / wsum : NaN;
}

/** The main lobe's angle, measured: where the time-averaged intensity peaks on the arc. */
export function measuredLobe(t: Tank): number {
  const { cx, cy, r } = arcOf(t);
  return lobeOverArc((deg) => {
    const a = (deg * Math.PI) / 180;
    return sample(t.intensity, t.w, cx + r * Math.cos(a), cy - r * Math.sin(a));
  });
}

/** The main lobe's angle from the array factor: each element a cylindrical wave e^{i(φₙ − k rₙ)}/√rₙ. */
export function predictedLobe(t: Tank, lambda: number): number {
  const { cx, cy, r } = arcOf(t);
  const w = omega(lambda, t.c2);
  const phases = t.phases ?? t.sources.map(() => 0);
  return lobeOverArc((deg) => {
    const a = (deg * Math.PI) / 180;
    const px = cx + r * Math.cos(a); const py = cy - r * Math.sin(a);
    let re = 0; let im = 0;
    t.sources.forEach(([sx, sy], n) => {
      const dx = px - sx; const dy = py - sy;
      const rn = Math.hypot(dx, dy);
      const k = numericalWavenumber(w, Math.sqrt(t.c2), Math.atan2(dy, dx));
      const ph = phases[n] - k * rn;
      re += Math.cos(ph) / Math.sqrt(rn); im += Math.sin(ph) / Math.sqrt(rn);
    });
    return re * re + im * im;
  });
}

/** The far-field steering angle, sin α = Δφ / (k d), with the scheme's wavenumber along the axis. */
export function farFieldLobe(t: Tank, lambda: number, phaseStep: number): number {
  const spacing = t.sources.length > 1 ? t.sources[1][1] - t.sources[0][1] : 1;
  const k = numericalWavenumber(omega(lambda, t.c2), Math.sqrt(t.c2), 0);
  return (Math.asin(Math.max(-1, Math.min(1, phaseStep / (k * spacing)))) * 180) / Math.PI;
}

/** Distances behind the moving source at which the cone's front is read. */
export const MACH_BEHIND = [30, 45, 60, 75, 90];
/** |u| above which a cell is inside the cone: outside it the field is the stencil's precursor, far below the drive's 1.4. */
export const MACH_THRESHOLD = 0.005;

/**
 * The Mach cone's half-angle (degrees): at each distance D behind the source, the farthest row
 * from the track (either side) where |u| exceeds MACH_THRESHOLD; the slope of that offset against
 * D is tan μ. NaN while the source is too close to the left edge.
 */
export function measuredMach(t: Tank): number {
  const m = t.mover;
  if (!m) return NaN;
  const xs = m.x0 + m.v * t.step;
  const pts: [number, number][] = [];
  for (const D of MACH_BEHIND) {
    const x = Math.round(xs - D);
    if (x < 22 || x > t.w - 22) return NaN;
    for (const dir of [-1, 1]) {
      let off = 0;
      for (let dy = 1; m.y + dir * dy > 0 && m.y + dir * dy < t.h - 1; dy++) {
        if (Math.abs(t.u[(m.y + dir * dy) * t.w + x]) > MACH_THRESHOLD) off = dy;
      }
      pts.push([D, off]);
    }
  }
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n; const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0; let sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return (Math.atan(sxy / sxx) * 180) / Math.PI;
}

/** The Mach angle in closed form, sin μ = c / v (degrees). */
export const machAngle = (c: number, v: number) => (Math.asin(Math.min(1, c / v)) * 180) / Math.PI;

/** The drum: W × H cells including the fixed rim. */
export const DRUM_W = 81;
export const DRUM_H = 51;
/** Where the drum is struck and where its pickup sits (fractions of its width and height). */
export const DRUM_STRIKE: [number, number] = [0.3, 0.36];
export const DRUM_PICKUP: [number, number] = [0.23, 0.31];

/** Mode (m, n)'s frequency on the grid, in cycles per step. */
export function drumModeScheme(m: number, n: number, c2: number, W = DRUM_W, H = DRUM_H): number {
  const s = c2 * (Math.sin((m * Math.PI) / (2 * (W - 1))) ** 2 + Math.sin((n * Math.PI) / (2 * (H - 1))) ** 2);
  return (2 * Math.asin(Math.sqrt(s))) / (2 * Math.PI);
}

/** The continuous membrane's f_mn = (c/2)√((m/a)² + (n/b)²), a = W − 1, b = H − 1 cells. */
export function drumModeClosed(m: number, n: number, c2: number, W = DRUM_W, H = DRUM_H): number {
  return (Math.sqrt(c2) / 2) * Math.hypot(m / (W - 1), n / (H - 1));
}

/** Steps the drum's pickup records: twenty periods of its fundamental. */
export const drumRecordSteps = (c2: number) => Math.round(20 / drumModeScheme(1, 1, c2));

/** The record's spectral peak nearest frequency f (cycles per step), Hann-windowed, parabola-refined. */
export function peakNear(record: ArrayLike<number>, T: number, f: number): number {
  const mag = (b: number) => {
    let re = 0; let im = 0;
    for (let t = 0; t < T; t++) {
      const w = record[t] * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / T));
      re += w * Math.cos((2 * Math.PI * b * t) / T); im -= w * Math.sin((2 * Math.PI * b * t) / T);
    }
    return Math.hypot(re, im);
  };
  let b = Math.round(f * T);
  let m0 = mag(b);
  for (let k = 0; k < 3; k++) {
    const up = mag(b + 1); const dn = mag(b - 1);
    if (up > m0 && up >= dn) { b++; m0 = up; } else if (dn > m0) { b--; m0 = dn; } else break;
  }
  const a = Math.log(mag(b - 1)); const c = Math.log(m0); const d = Math.log(mag(b + 1));
  const den = a - 2 * c + d;
  return (b + (den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - d)) / den)) : 0)) / T;
}
