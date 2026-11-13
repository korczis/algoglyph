// Special relativity in units where c = 1: events, boosts, intervals, worldlines and proper time,
// four-momenta, and the transformation of the electromagnetic field. Shared by the relativity
// still plates; pure (no p5, no randomness), so each identity it states is a unit test.
//
// A boost along x with rapidity φ (velocity v = tanh φ, γ = cosh φ, γv = sinh φ) maps
//   t' = t cosh φ − x sinh φ,   x' = x cosh φ − t sinh φ,
// keeps the interval s² = t² − x² (− y² − z²), and composes by adding rapidities, which is the
// velocity-addition law (u + v)/(1 + uv) read in another variable.
import { adaptiveSimpson } from '../../../kernels/numeric/adaptive-quadrature';

export interface Event { t: number; x: number }

export const gammaOf = (v: number): number => 1 / Math.sqrt(1 - v * v);
export const rapidityOf = (v: number): number => Math.atanh(v);

/** The event as an observer moving at rapidity φ along x records it. */
export function boost(e: Event, phi: number): Event {
  const ch = Math.cosh(phi); const sh = Math.sinh(phi);
  return { t: e.t * ch - e.x * sh, x: e.x * ch - e.t * sh };
}

/** s² = t² − x²: positive for timelike separations, zero on the light cone, negative for spacelike. */
export const interval = (e: Event, o: Event = { t: 0, x: 0 }): number => (e.t - o.t) ** 2 - (e.x - o.x) ** 2;

/** The 2×2 boost matrix [[cosh, −sinh], [−sinh, cosh]] acting on (t, x). */
export function boostMatrix(phi: number): [[number, number], [number, number]] {
  const ch = Math.cosh(phi); const sh = Math.sinh(phi);
  return [[ch, -sh], [-sh, ch]];
}

export function multiply(a: [[number, number], [number, number]], b: [[number, number], [number, number]]): [[number, number], [number, number]] {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

/** Einstein's velocity addition, written as the formula, not through rapidities. */
export const addVelocities = (u: number, v: number): number => (u + v) / (1 + u * v);

/** A worldline: velocity as a function of coordinate time, its position (x(0) = 0), its end,
 * and the times where its acceleration jumps (a quadrature is split there). */
export interface Worldline { v(t: number): number; x(t: number): number; end: number; corners: number[] }

/** Proper time along a worldline from 0 to its end: ∫ √(1 − v²) dt, by adaptive Simpson, split
 * at the worldline's corners so every piece the quadrature sees is smooth. */
export function properTime(w: Worldline, eps = 1e-12): { tau: number; evals: number } {
  const cuts = [0, ...w.corners.filter((c) => c > 0 && c < w.end), w.end];
  let tau = 0; let evals = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const r = adaptiveSimpson((t) => Math.sqrt(Math.max(0, 1 - w.v(t) ** 2)), cuts[i], cuts[i + 1], eps / (cuts.length - 1));
    tau += r.value; evals += r.evals;
  }
  return { tau, evals };
}

/** Constant proper acceleration a from rest at x = 0 (hyperbolic motion), for coordinate time T. */
export function hyperbolic(a: number, T: number): Worldline {
  return {
    v: (t) => (a * t) / Math.sqrt(1 + (a * t) ** 2),
    x: (t) => (Math.sqrt(1 + (a * t) ** 2) - 1) / a,
    end: T,
    corners: [],
  };
}

/** The closed form of hyperbolic motion's proper time: τ = asinh(aT)/a. */
export const hyperbolicTau = (a: number, T: number): number => Math.asinh(a * T) / a;

/**
 * The travelling twin: four legs of constant proper acceleration ±a, each of coordinate time
 * T/4 (out, brake, back, brake), so the twin leaves and returns at rest at x = 0 after T.
 * Each leg is hyperbolic motion, so the closed form is 4 asinh(aT/4)/a.
 */
export function twin(a: number, T: number): Worldline {
  const q = T / 4;
  const leg = (t: number) => {
    // velocity rises on legs 1 and 4 measured from their own starts, mirrored on 2 and 3
    const k = Math.min(3, Math.floor(t / q));
    const s = t - k * q;
    const up = (u: number) => (a * u) / Math.sqrt(1 + (a * u) ** 2);
    if (k === 0) return up(s);
    if (k === 1) return up(q - s);
    if (k === 2) return -up(s);
    return -up(q - s);
  };
  const xUp = (u: number) => (Math.sqrt(1 + (a * u) ** 2) - 1) / a;
  const top = xUp(q);
  return {
    v: leg,
    x: (t) => {
      const k = Math.min(3, Math.floor(t / q));
      const s = t - k * q;
      if (k === 0) return xUp(s);
      if (k === 1) return 2 * top - xUp(q - s);
      if (k === 2) return 2 * top - xUp(s);
      return xUp(q - s);
    },
    end: T,
    corners: [q, 2 * q, 3 * q],
  };
}

export const twinTau = (a: number, T: number): number => (4 * Math.asinh((a * T) / 4)) / a;

// ---- four-vectors and fields -----------------------------------------------------------------

export type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A four-momentum (E, p) with c = 1. */
export interface FourMomentum { e: number; p: V3 }

export const mass = (k: FourMomentum): number => Math.sqrt(Math.max(0, k.e * k.e - dot(k.p, k.p)));

export function boostMomentum(k: FourMomentum, phi: number): FourMomentum {
  const ch = Math.cosh(phi); const sh = Math.sinh(phi);
  return { e: k.e * ch - k.p[0] * sh, p: [k.p[0] * ch - k.e * sh, k.p[1], k.p[2]] };
}

export const add = (a: FourMomentum, b: FourMomentum): FourMomentum =>
  ({ e: a.e + b.e, p: [a.p[0] + b.p[0], a.p[1] + b.p[1], a.p[2] + b.p[2]] });

/**
 * The fields an observer moving at velocity v along x measures (c = 1):
 *   E′∥ = E∥, B′∥ = B∥,  E′⊥ = γ (E + v × B)⊥,  B′⊥ = γ (B − v × E)⊥.
 */
export function boostFields(E: V3, B: V3, v: number): { E: V3; B: V3 } {
  const g = gammaOf(v);
  const vv: V3 = [v, 0, 0];
  const vxB = cross(vv, B); const vxE = cross(vv, E);
  return {
    E: [E[0], g * (E[1] + vxB[1]), g * (E[2] + vxB[2])],
    B: [B[0], g * (B[1] - vxE[1]), g * (B[2] - vxE[2])],
  };
}

/** The two invariants of the field: E·B and E² − B². */
export const invariants = (E: V3, B: V3): [number, number] => [dot(E, B), dot(E, E) - dot(B, B)];

/** The field tensor F^{μν} (signature +−−−, c = 1): F^{0i} = −E_i, F^{ij} = −ε_{ijk} B_k. */
export function fieldTensor(E: V3, B: V3): number[][] {
  return [
    [0, -E[0], -E[1], -E[2]],
    [E[0], 0, -B[2], B[1]],
    [E[1], B[2], 0, -B[0]],
    [E[2], -B[1], B[0], 0],
  ];
}

/** The tensor under a boost along x: F′ = Λ F Λᵀ, with Λ the 4×4 boost. */
export function boostTensor(F: number[][], phi: number): number[][] {
  const ch = Math.cosh(phi); const sh = Math.sinh(phi);
  const L = [[ch, -sh, 0, 0], [-sh, ch, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const out = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let m = 0; m < 4; m++) for (let n = 0; n < 4; n++) {
    let s = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s += L[m][a] * F[a][b] * L[n][b];
    out[m][n] = s;
  }
  return out;
}

/** E and B read back from a tensor. */
export const fieldsOf = (F: number[][]): { E: V3; B: V3 } => ({
  E: [F[1][0], F[2][0], F[3][0]],
  B: [F[3][2], F[1][3], F[2][1]],
});
