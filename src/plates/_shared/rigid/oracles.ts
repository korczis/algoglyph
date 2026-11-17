// Closed forms of the rigid body, independent of the integrator in ./rigid.ts: each is computed
// from the conserved quantities at the start (E, L², L_z, L₃) and never from a run.
//
// - Euler's free top (Landau and Lifshitz, Mechanics §37): ω₂ is Jacobi's sn of t, so the body's
//   motion repeats after 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))), with 1 and 3 exchanged when
//   L² < 2EI₂; near the middle axis a tilt grows as e^(λt), λ = ω√((I₃ − I₂)(I₂ − I₁)/(I₁I₃)).
// - The free symmetric top: the axis turns about L at |L|/I⊥, the body about its axis at
//   L_s(1/I_s − 1/I⊥).
// - The heavy symmetric top (Goldstein §5.7): with u = cos θ, u̇² = f(u), a cubic; the nutation
//   between its two lower roots takes 4K(k)/√(β(u₃ − u₁)), and the mean precession is φ̇ =
//   (b − au)/(1 − u²) averaged over that motion, here by the trapezoid rule on a smooth periodic
//   integrand (u = u₁ + (u₂ − u₁) sin²s), which converges exponentially.

/** The complete elliptic integral K from the complementary modulus k′ = √(1 − k²), by the AGM. */
export function ellipticKc(kc: number): number {
  let a = 1;
  let b = kc;
  for (let i = 0; i < 60 && Math.abs(a - b) > 1e-16 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

/** Σ L_i²(I_i − I_ref)/I_i = L² − 2E·I_ref, written without the cancellation of the difference. */
function excess(I: readonly number[], L: ArrayLike<number>, ref: number): number {
  let s = 0;
  for (let i = 0; i < 3; i++) s += (L[i] * L[i] * (I[i] - ref)) / I[i];
  return s;
}

export interface FreePeriod {
  /** The period of the body-frame motion (ω₂ from one upward zero to the next). */
  period: number;
  /** k² of the Jacobi functions. */
  m: number;
  /** Which side of the separatrix: L² > 2EI₂ circles the largest axis, < the smallest. */
  around: 'largest' | 'smallest' | 'separatrix';
}

/**
 * The period of a free asymmetric top's body-frame motion, for ascending moments I₁ < I₂ < I₃ and
 * its body angular momentum L. Infinite on the separatrix L² = 2EI₂.
 */
export function freePeriod(I: readonly number[], L: ArrayLike<number>): FreePeriod {
  const [I1, I2, I3] = I;
  const P = excess(I, L, I1); // L² − 2EI₁ ≥ 0
  const Q = -excess(I, L, I3); // 2EI₃ − L² ≥ 0
  const D = excess(I, L, I2); // L² − 2EI₂
  if (D === 0) return { period: Infinity, m: 1, around: 'separatrix' };
  if (D > 0) {
    const m = ((I2 - I1) * Q) / ((I3 - I2) * P);
    const kc = Math.sqrt(((I3 - I1) * D) / ((I3 - I2) * P));
    return { period: 4 * ellipticKc(kc) * Math.sqrt((I1 * I2 * I3) / ((I3 - I2) * P)), m, around: 'largest' };
  }
  const m = ((I3 - I2) * P) / ((I2 - I1) * Q);
  const kc = Math.sqrt(((I3 - I1) * -D) / ((I2 - I1) * Q));
  return { period: 4 * ellipticKc(kc) * Math.sqrt((I1 * I2 * I3) / ((I2 - I1) * Q)), m, around: 'smallest' };
}

/** The rate a small tilt from the middle axis grows at, spinning at ω about it: e^(λt). */
export function growthRate(I: readonly number[], w: number): number {
  const [I1, I2, I3] = I;
  return Math.abs(w) * Math.sqrt(((I3 - I2) * (I2 - I1)) / (I1 * I3));
}

/** The period of a small wobble about the smallest (axis 0) or largest (axis 2) moment, spinning at ω. */
export function wobblePeriod(I: readonly number[], axis: 0 | 2, w: number): number {
  const [I1, I2, I3] = I;
  const r = axis === 2 ? ((I3 - I1) * (I3 - I2)) / (I1 * I2) : ((I2 - I1) * (I3 - I1)) / (I2 * I3);
  return (2 * Math.PI) / (Math.abs(w) * Math.sqrt(r));
}

export interface SymmetricRates {
  /** The symmetry axis's turn about L in space, |L|/I⊥. */
  wobble: number;
  /** The body's turn about its own axis relative to that, L_s(1/I_s − 1/I⊥). */
  spin: number;
  /** cos θ, the angle between the axis and L. */
  cos: number;
}

export function symmetricRates(Is: number, Iperp: number, Ls: number, Lmag: number): SymmetricRates {
  return { wobble: Lmag / Iperp, spin: Ls * (1 / Is - 1 / Iperp), cos: Ls / Lmag };
}

/**
 * The slow root of steady precession at tilt θ: I⊥ cos θ Ω² − I₃ω₃ Ω + Mgl = 0, or null when the
 * spin is too slow for one (I₃²ω₃² < 4I⊥Mgl cos θ).
 */
export function steadyPrecession(Iperp: number, I3: number, w3: number, mgl: number, theta: number): number | null {
  const c = Math.cos(theta);
  const a = I3 * w3;
  if (Math.abs(c) < 1e-12) return mgl / a;
  const disc = a * a - 4 * Iperp * mgl * c;
  if (disc < 0) return null;
  // the root nearer zero, written to avoid cancelling a − √disc
  return (2 * mgl) / (a + Math.sign(a) * Math.sqrt(disc));
}

export interface TopMotion {
  /** The three roots of f(u), ascending: the axis moves between u₁ and u₂ (u₃ > 1). */
  roots: [number, number, number];
  /** The nutation period, 4K(k)/√(β(u₃ − u₁)), k² = (u₂ − u₁)/(u₃ − u₁). */
  nutation: number;
  /** The mean precession rate over a nutation. */
  precession: number;
}

/** The roots of x² + Bx + C, ascending, without cancelling B against the root of the discriminant. */
function quadratic(B: number, C: number): [number, number] {
  const d = Math.sqrt(Math.max(0, B * B - 4 * C));
  const q = -(B + (B >= 0 ? d : -d)) / 2;
  if (q === 0) return [0, 0];
  const r = [q, C / q].sort((x, y) => x - y);
  return [r[0], r[1]];
}

/**
 * The reduced heavy symmetric top (Goldstein §5.7), from its start: I⊥ about the pivot, Mgl, the
 * orientation R (body to space, row-major, the axis is body axis 2) and the body's angular
 * momentum L. With u = cos θ, u̇² = f(u) = (α − βu)(1 − u²) − (b − au)², a = L₃/I⊥, b = L_z/I⊥,
 * β = 2Mgl/I⊥. Written in x = u − u₀ its coefficients come from the start without cancellation:
 * α − βu₀ = (L₁² + L₂²)/I⊥² and b − au₀ = (the transverse L's vertical part)/I⊥, so the two
 * roots near the start (a double root for steady precession) are as accurate as the start itself;
 * the far root is found first and divided out.
 */
export function topMotion(Iperp: number, mgl: number, R: ArrayLike<number>, L: ArrayLike<number>,
  samples = 512): TopMotion {
  const a = L[2] / Iperp;
  const beta = (2 * mgl) / Iperp;
  const u0 = R[8];
  const w = R[2] * R[2] + R[5] * R[5]; // 1 − u₀², the squared sine of the lean
  const tau = (L[0] * L[0] + L[1] * L[1]) / (Iperp * Iperp);
  const sigma = (R[6] * L[0] + R[7] * L[1]) / Iperp;
  // g(x) = βx³ + c₂x² + c₁x + c₀
  const c2 = -tau + 2 * beta * u0 - a * a;
  const c1 = -2 * tau * u0 - beta * w + 2 * a * sigma;
  const c0 = tau * w - sigma * sigma;
  const g = (x: number) => ((beta * x + c2) * x + c1) * x + c0;
  const dg = (x: number) => (3 * beta * x + 2 * c2) * x + c1;
  // the far root, beyond u = 1 (g(1 − u₀) = −(b − a)² ≤ 0 and g → +∞): bracket, then Newton
  let lo = 1 - u0;
  let hi = Math.max(2 * lo, 1);
  while (g(hi) < 0) hi *= 2;
  let x3 = hi;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < 0) lo = mid; else hi = mid;
    x3 = mid;
    if (hi - lo <= 1e-15 * hi) break;
  }
  for (let i = 0; i < 3; i++) { const d = dg(x3); if (d !== 0) x3 -= g(x3) / d; }
  // g(x)/β = (x − x₃)(x² + Bx + C)
  const B = c2 / beta + x3;
  const C = -c0 / (beta * x3);
  const [x1, x2] = quadratic(B, C);
  const span = Math.max(0, x2 - x1);
  const nutation = (4 * ellipticKc(Math.sqrt(Math.max(0, (x3 - x2) / (x3 - x1))))) / Math.sqrt(beta * (x3 - x1));
  // ⟨φ̇⟩ = ∫ φ̇ dt / ∫ dt, φ̇ = (b − au)/(1 − u²), dt ∝ ds/√(x₃ − x), x = x₁ + (x₂ − x₁) sin²s, s ∈ [0, π)
  let num = 0;
  let den = 0;
  for (let k = 0; k < samples; k++) {
    const x = x1 + span * Math.sin((Math.PI * k) / samples) ** 2;
    const wt = 1 / Math.sqrt(x3 - x);
    num += (wt * (sigma - a * x)) / (w - 2 * u0 * x - x * x);
    den += wt;
  }
  return { roots: [u0 + x1, u0 + x2, u0 + x3], nutation, precession: num / den };
}
