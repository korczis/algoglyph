// A spin j in a magnetic field (plan S10, the finite-quantum solver): the (2j + 1)-dimensional
// matrices of Jx, Jy, Jz from the ladder formula ⟨m + 1|J₊|m⟩ = √(j(j + 1) − m(m + 1)), the
// Hamiltonian H = −γ B(t)·J (ħ = 1), and its evolution by Crank–Nicolson with H taken at each step's
// midpoint (second order, unitary to rounding; src/plates/_shared/ode). Basis order: m = j, j − 1,
// …, −j, so index 0 is "up". Pure: no p5, no randomness.
import { crankNicolson } from '../ode/ode';

export interface CMatrix {
  re: number[][];
  im: number[][];
}

export interface Spin {
  j: number;
  dim: number;
  x: CMatrix;
  y: CMatrix;
  z: CMatrix;
}

export interface State {
  re: Float64Array;
  im: Float64Array;
}

/** B(t) = [Bx, By, Bz]. */
export type Field = (t: number) => [number, number, number];

const zeros = (n: number) => Array.from({ length: n }, () => new Array<number>(n).fill(0));

export function spinMatrices(j: number): Spin {
  const dim = Math.round(2 * j + 1);
  const x = { re: zeros(dim), im: zeros(dim) };
  const y = { re: zeros(dim), im: zeros(dim) };
  const z = { re: zeros(dim), im: zeros(dim) };
  for (let a = 0; a < dim; a++) {
    const m = j - a;
    z.re[a][a] = m;
    if (a > 0) {
      // J₊ takes m (index a) to m + 1 (index a − 1)
      const up = Math.sqrt(j * (j + 1) - m * (m + 1));
      // Jx = (J₊ + J₋)/2, Jy = (J₊ − J₋)/2i
      x.re[a - 1][a] += up / 2;
      x.re[a][a - 1] += up / 2;
      y.im[a - 1][a] += -up / 2;
      y.im[a][a - 1] += up / 2;
    }
  }
  return { j, dim, x, y, z };
}

/** |j, m = j⟩. */
export function spinUp(j: number): State {
  const dim = Math.round(2 * j + 1);
  const re = new Float64Array(dim);
  re[0] = 1;
  return { re, im: new Float64Array(dim) };
}

/** Re ⟨ψ|M|ψ⟩ for a Hermitian M. */
export function expectation(s: State, M: CMatrix): number {
  let total = 0;
  const n = s.re.length;
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      // conj(ψa) M_ab ψb, real part
      const mr = M.re[a][b];
      const mi = M.im[a][b];
      const vr = mr * s.re[b] - mi * s.im[b];
      const vi = mr * s.im[b] + mi * s.re[b];
      total += s.re[a] * vr + s.im[a] * vi;
    }
  }
  return total;
}

/** ⟨a|b⟩. */
export function overlap(a: State, b: State): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let k = 0; k < a.re.length; k++) {
    re += a.re[k] * b.re[k] + a.im[k] * b.im[k];
    im += a.re[k] * b.im[k] - a.im[k] * b.re[k];
  }
  return { re, im };
}

/** H = −γ B·J as real and imaginary parts. */
export function hamiltonian(sp: Spin, B: [number, number, number], gamma: number): { re: number[][]; im: number[][] } {
  const n = sp.dim;
  const re = zeros(n);
  const im = zeros(n);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      re[a][b] = -gamma * (B[0] * sp.x.re[a][b] + B[1] * sp.y.re[a][b] + B[2] * sp.z.re[a][b]);
      im[a][b] = -gamma * (B[0] * sp.x.im[a][b] + B[1] * sp.y.im[a][b] + B[2] * sp.z.im[a][b]);
    }
  }
  return { re, im };
}

/** Advance `s` (in place) by one Crank–Nicolson step of h from t, with H at t + h/2. */
export function step(s: State, sp: Spin, field: Field, t: number, h: number, gamma: number): void {
  const H = hamiltonian(sp, field(t + h / 2), gamma);
  crankNicolson(H.re, s.re, s.im, h, H.im);
}

/** The state after time T in `steps` steps, from `start` (left unchanged). */
export function evolve(start: State, sp: Spin, field: Field, T: number, steps: number, gamma: number): State {
  const s = { re: Float64Array.from(start.re), im: Float64Array.from(start.im) };
  const h = T / steps;
  for (let i = 0; i < steps; i++) step(s, sp, field, i * h, h, gamma);
  return s;
}
