// Rotations of a spin j (plan S10, finite quantum): the matrix ⟨j m′|e^(−iθJy)|j m⟩, Wigner's small
// d-matrix, two independent ways. One exponentiates the generator: Jy from the ladder formula
// (spin.ts) makes −iθJy a real antisymmetric matrix, whose exponential is summed as a Taylor
// series after scaling θ down by a power of two and squaring back. The other is Wigner's closed
// sum over factorials. Basis order m = j, j − 1, …, −j, as in spin.ts. Pure.
import { spinMatrices } from './spin';

export type Real = number[][];

const identity = (n: number): Real => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

export function mul(a: Real, b: Real): Real {
  const n = a.length;
  const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const v = a[i][k];
    if (v === 0) continue;
    for (let j = 0; j < n; j++) out[i][j] += v * b[k][j];
  }
  return out;
}

/** e^(−iθJy) for spin j, by scaling and squaring a Taylor series of the real generator θ·Im(Jy). */
export function rotationY(j: number, theta: number): Real {
  const { y, dim } = spinMatrices(j);
  // Jy is purely imaginary, Jy = i·Y with Y = y.im, so −iθJy = θY: real and antisymmetric
  let squarings = 0;
  let scale = Math.abs(theta) * (j + 1);
  while (scale > 0.25) { scale /= 2; squarings++; }
  const t = theta / 2 ** squarings;
  const A = y.im.map((row) => row.map((v) => t * v));
  let term = identity(dim);
  let sum = identity(dim);
  for (let k = 1; k <= 30; k++) {
    term = mul(term, A).map((row) => row.map((v) => v / k));
    let size = 0;
    for (let a = 0; a < dim; a++) for (let b = 0; b < dim; b++) { sum[a][b] += term[a][b]; size = Math.max(size, Math.abs(term[a][b])); }
    if (size < 1e-18) break;
  }
  for (let s = 0; s < squarings; s++) sum = mul(sum, sum);
  return sum;
}

const fact = (n: number): number => { let f = 1; for (let k = 2; k <= n; k++) f *= k; return f; };

/** Wigner's formula for d^j_{m′m}(θ). */
export function wignerD(j: number, mp: number, m: number, theta: number): number {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  const pre = Math.sqrt(fact(Math.round(j + mp)) * fact(Math.round(j - mp)) * fact(Math.round(j + m)) * fact(Math.round(j - m)));
  let sum = 0;
  const lo = Math.max(0, Math.round(m - mp));
  const hi = Math.min(Math.round(j + m), Math.round(j - mp));
  for (let k = lo; k <= hi; k++) {
    const den = fact(Math.round(j + m - k)) * fact(k) * fact(Math.round(mp - m + k)) * fact(Math.round(j - mp - k));
    const sign = Math.round(mp - m + k) % 2 === 0 ? 1 : -1;
    sum += (sign * c ** Math.round(2 * j + m - mp - 2 * k) * s ** Math.round(mp - m + 2 * k)) / den;
  }
  return pre * sum;
}

/** The whole matrix by Wigner's formula, rows m′ and columns m in the order j … −j. */
export function wignerMatrix(j: number, theta: number): Real {
  const dim = Math.round(2 * j + 1);
  return Array.from({ length: dim }, (_, a) => Array.from({ length: dim }, (_, b) => wignerD(j, j - a, j - b, theta)));
}
