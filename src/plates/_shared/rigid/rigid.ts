// The rigid body (plan S6): a free body of any principal moments and a heavy symmetric top on a
// fixed pivot, integrated by splitting the Hamiltonian into pieces whose flows are exact
// rotations (the method of Hairer, Lubich and Wanner, ch. VII.5). The state is the orientation R
// (body to space, row-major) and the angular momentum in the body frame L. Each piece rotates R
// and L by the same angle in opposite senses, so the spatial angular momentum R·L of a free body
// is kept to round-off and |L| exactly; the energy is kept to the order of the composition.
//
// The free flow of a body with three unequal moments is split by axis, Strang's symmetric
// sequence 1, 2, 3, 2, 1. A body with two equal moments has an exact free flow: a turn about L at
// |L|/I⊥ and one about its symmetry axis, which commute. The top adds the kick of gravity's torque
// at a fixed orientation, half before and half after the free flow. Either second-order step is
// raised to fourth order by Yoshida's triple jump. Nothing here knows the closed forms the plate
// compares against (the elliptic period, the reduced top); those are in ./oracles.ts.

/** Principal moments, a symmetry axis when two of them are equal, and the top's Mgl. */
export interface Body {
  I: [number, number, number];
  /** The axis whose moment differs from the other two equal ones, or -1 for three unequal. */
  sym: -1 | 0 | 1 | 2;
  /** M g l of a top pivoted at the origin with its centre of mass at l along body axis 2; 0 when free. */
  mgl: number;
}

export interface RigidState {
  /** Body to space, row-major: column i is body axis i in space. */
  R: Float64Array;
  /** Angular momentum in the body frame. */
  L: Float64Array;
}

/** Moments within this fraction of the largest are equal: the exact symmetric flow applies. */
export const EQUAL = 1e-12;

/** The symmetry axis of three moments: the odd one when two are equal, -1 otherwise. */
export function symmetryAxis(I: readonly number[]): -1 | 0 | 1 | 2 {
  const tol = EQUAL * Math.max(I[0], I[1], I[2]);
  if (Math.abs(I[0] - I[1]) <= tol && Math.abs(I[1] - I[2]) <= tol) return -1;
  if (Math.abs(I[0] - I[1]) <= tol) return 2;
  if (Math.abs(I[1] - I[2]) <= tol) return 0;
  if (Math.abs(I[0] - I[2]) <= tol) return 1;
  return -1;
}

export function identity(): Float64Array {
  return Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
}

/** R ← R · Rot(e_i, a): a turn of the body about its own axis i. */
function turnAxis(R: Float64Array, i: number, a: number): void {
  const j = (i + 1) % 3;
  const k = (i + 2) % 3;
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let r = 0; r < 3; r++) {
    const x = R[3 * r + j];
    const y = R[3 * r + k];
    R[3 * r + j] = c * x + s * y;
    R[3 * r + k] = -s * x + c * y;
  }
}

/** L ← Rot(e_i, −a) · L: the body's momentum seen from a body turned by a about axis i. */
function counterTurn(L: Float64Array, i: number, a: number): void {
  const j = (i + 1) % 3;
  const k = (i + 2) % 3;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = L[j];
  const y = L[k];
  L[j] = c * x + s * y;
  L[k] = -s * x + c * y;
}

/** R ← R · Rot(n, a) about a unit body vector n, by Rodrigues' formula. */
function turnAbout(R: Float64Array, n: ArrayLike<number>, a: number): void {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  const [x, y, z] = [n[0], n[1], n[2]];
  const Q = [
    c + t * x * x, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, c + t * y * y, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, c + t * z * z,
  ];
  for (let r = 0; r < 3; r++) {
    const a0 = R[3 * r];
    const a1 = R[3 * r + 1];
    const a2 = R[3 * r + 2];
    R[3 * r] = a0 * Q[0] + a1 * Q[3] + a2 * Q[6];
    R[3 * r + 1] = a0 * Q[1] + a1 * Q[4] + a2 * Q[7];
    R[3 * r + 2] = a0 * Q[2] + a1 * Q[5] + a2 * Q[8];
  }
}

/** The exact flow of the piece L_i²/2I_i for a time h: a turn about axis i at L_i/I_i. */
function axisFlow(body: Body, s: RigidState, i: number, h: number): void {
  const a = (s.L[i] / body.I[i]) * h;
  turnAxis(s.R, i, a);
  counterTurn(s.L, i, a);
}

/** The free flow for a time h: exact for a symmetric body, Strang's axis sequence otherwise. */
export function freeFlow(body: Body, s: RigidState, h: number): void {
  const { I, sym } = body;
  if (sym >= 0) {
    // H = |L|²/2I⊥ + L_s²(1/I_s − 1/I⊥)/2: a turn about L (which L does not see), then one about e_s
    const perp = I[(sym + 1) % 3];
    const m = Math.hypot(s.L[0], s.L[1], s.L[2]);
    if (m > 0) turnAbout(s.R, [s.L[0] / m, s.L[1] / m, s.L[2] / m], (m / perp) * h);
    const a = s.L[sym] * (1 / I[sym as 0 | 1 | 2] - 1 / perp) * h;
    turnAxis(s.R, sym, a);
    counterTurn(s.L, sym, a);
    return;
  }
  axisFlow(body, s, 0, h / 2);
  axisFlow(body, s, 1, h / 2);
  axisFlow(body, s, 2, h);
  axisFlow(body, s, 1, h / 2);
  axisFlow(body, s, 0, h / 2);
}

/** Gravity's kick for a time h at a fixed orientation: L in space gains h·τ, τ = −Mgl (R e₂) × ẑ. */
export function kick(body: Body, s: RigidState, h: number): void {
  if (body.mgl === 0) return;
  const { R, L } = s;
  // the symmetry axis in space, column 2 of R; τ = −Mgl (a_y, −a_x, 0)
  const tx = -body.mgl * R[5];
  const ty = body.mgl * R[2];
  // L_b += h Rᵀ τ
  for (let j = 0; j < 3; j++) L[j] += h * (R[j] * tx + R[3 + j] * ty);
}

/** One second-order step: kick, free flow, kick (the kick is nothing for a free body). */
export function strang(body: Body, s: RigidState, h: number): void {
  kick(body, s, h / 2);
  freeFlow(body, s, h);
  kick(body, s, h / 2);
}

const CBRT2 = Math.cbrt(2);
/** Yoshida's weights: three second-order steps of w₁h, w₀h, w₁h make one of fourth order. */
export const YOSHIDA = { w1: 1 / (2 - CBRT2), w0: -CBRT2 / (2 - CBRT2) };

/** One step of order 2 (Strang) or 4 (Yoshida's triple jump of it). */
export function step(body: Body, s: RigidState, h: number, order: 2 | 4 = 4): void {
  if (order === 2) { strang(body, s, h); return; }
  strang(body, s, YOSHIDA.w1 * h);
  strang(body, s, YOSHIDA.w0 * h);
  strang(body, s, YOSHIDA.w1 * h);
}

/** Kinetic plus potential energy: Σ L_i²/2I_i + Mgl (R e₂)_z. */
export function energy(body: Body, s: RigidState): number {
  const { I } = body;
  const { L, R } = s;
  return L[0] * L[0] / (2 * I[0]) + L[1] * L[1] / (2 * I[1]) + L[2] * L[2] / (2 * I[2]) + body.mgl * R[8];
}

/** The angular momentum in space, R·L. */
export function spatial(s: RigidState, out: Float64Array = new Float64Array(3)): Float64Array {
  const { R, L } = s;
  for (let r = 0; r < 3; r++) out[r] = R[3 * r] * L[0] + R[3 * r + 1] * L[1] + R[3 * r + 2] * L[2];
  return out;
}

/** The angular velocity in the body frame, L_i/I_i. */
export function omega(body: Body, s: RigidState, out: Float64Array = new Float64Array(3)): Float64Array {
  for (let i = 0; i < 3; i++) out[i] = s.L[i] / body.I[i];
  return out;
}

/** A rotation (row-major) taking the unit vector n to ẑ: the start that stands L upright. */
export function toVertical(n: ArrayLike<number>): Float64Array {
  const m = Math.hypot(n[0], n[1], n[2]);
  const [x, y, z] = [n[0] / m, n[1] / m, n[2] / m];
  // axis n × ẑ = (y, −x, 0), angle acos(z)
  const s = Math.hypot(x, y);
  const R = identity();
  if (s < 1e-15) {
    if (z < 0) { R[4] = -1; R[8] = -1; }
    return R;
  }
  turnAbout(R, [y / s, -x / s, 0], Math.atan2(s, z));
  return R;
}

/** The rotation about space x by θ: the top's start, its axis leaning from ẑ towards −y. */
export function leanX(theta: number): Float64Array {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return Float64Array.from([1, 0, 0, 0, c, -s, 0, s, c]);
}

/** Moments of a solid box of unit mass and sides a, b, c about its centre: (b² + c²)/12, … */
export function boxMoments(a: number, b: number, c: number): [number, number, number] {
  return [(b * b + c * c) / 12, (a * a + c * c) / 12, (a * a + b * b) / 12];
}

export interface Principal {
  /** Moments, ascending. */
  I: [number, number, number];
  /** Principal axes as the columns of a row-major rotation, in the order of I. */
  V: Float64Array;
  /** The centre of mass. */
  centre: [number, number, number];
  /** The total mass. */
  mass: number;
}

/**
 * The principal moments and axes of point masses about their centre of mass: the inertia tensor
 * diagonalised by cyclic Jacobi rotations (a 3 × 3 symmetric matrix converges in a few sweeps).
 */
export function principal(x: ArrayLike<number>, y: ArrayLike<number>, z: ArrayLike<number>,
  m: ArrayLike<number>): Principal {
  let M = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < m.length; i++) { M += m[i]; cx += m[i] * x[i]; cy += m[i] * y[i]; cz += m[i] * z[i]; }
  if (M > 0) { cx /= M; cy /= M; cz /= M; }
  const T = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < m.length; i++) {
    const p = [x[i] - cx, y[i] - cy, z[i] - cz];
    const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) T[3 * r + c] += m[i] * ((r === c ? r2 : 0) - p[r] * p[c]);
  }
  const V = identity();
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = Math.abs(T[1]) + Math.abs(T[2]) + Math.abs(T[5]);
    if (off <= 1e-300 || off <= 1e-17 * (Math.abs(T[0]) + Math.abs(T[4]) + Math.abs(T[8]))) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = T[3 * p + q];
      if (apq === 0) continue;
      const theta = (T[3 * q + q] - T[3 * p + p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      // T ← Jᵀ T J, V ← V J, with J the rotation in the (p, q) plane
      for (let k = 0; k < 3; k++) {
        const tkp = T[3 * k + p];
        const tkq = T[3 * k + q];
        T[3 * k + p] = c * tkp - s * tkq;
        T[3 * k + q] = s * tkp + c * tkq;
      }
      for (let k = 0; k < 3; k++) {
        const tpk = T[3 * p + k];
        const tqk = T[3 * q + k];
        T[3 * p + k] = c * tpk - s * tqk;
        T[3 * q + k] = s * tpk + c * tqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[3 * k + p];
        const vkq = V[3 * k + q];
        V[3 * k + p] = c * vkp - s * vkq;
        V[3 * k + q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((a, b) => T[4 * a] - T[4 * b]);
  const W = new Float64Array(9);
  order.forEach((src, dst) => { for (let r = 0; r < 3; r++) W[3 * r + dst] = V[3 * r + src]; });
  // keep it a rotation (det +1): flip the last axis when the sort made it a reflection
  const det = W[0] * (W[4] * W[8] - W[5] * W[7]) - W[1] * (W[3] * W[8] - W[5] * W[6]) + W[2] * (W[3] * W[7] - W[4] * W[6]);
  if (det < 0) for (let r = 0; r < 3; r++) W[3 * r + 2] = -W[3 * r + 2];
  return { I: [T[4 * order[0]], T[4 * order[1]], T[4 * order[2]]], V: W, centre: [cx, cy, cz], mass: M };
}
