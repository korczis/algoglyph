// Two angular momenta coupled (plan S10, finite quantum). In the product basis |j₁ m₁⟩|j₂ m₂⟩ the
// total J² = J₁² + J₂² + 2J₁zJ₂z + J₁₊J₂₋ + J₁₋J₂₊ is real and keeps M = m₁ + m₂, so it is
// diagonalised block by block; each block's eigenvectors, with the Condon–Shortley signs (the
// component with m₁ = j₁ of |J J⟩ positive, and ⟨J M|J₋|J M + 1⟩ positive below it), are the
// Clebsch–Gordan coefficients. Racah's closed sum gives them a second, independent way. The
// hyperfine Hamiltonian A I·S + b S_z of a nucleus I and an electron S = ½ in a field is diagonalised
// the same way, to be held to the Breit–Rabi formula. Every eigenproblem goes through the one-sided
// Jacobi SVD of the numeric engine's pca-svd kernel, applied to the matrix shifted to be positive
// definite, whose singular vectors are then its eigenvectors. Pure.
import { jacobiSVD } from '../../../kernels/numeric/pca-svd';

export type Real = number[][];

/** The real symmetric matrix's eigenvalues (ascending) and eigenvectors (columns), by the SVD of
 * M + cI with c above every Gershgorin bound, so that the shifted matrix is positive definite. */
export function symmetricEigen(M: Real): { values: number[]; vectors: Real } {
  const n = M.length;
  if (n === 1) return { values: [M[0][0]], vectors: [[1]] };
  let c = 1;
  for (let i = 0; i < n; i++) c = Math.max(c, M[i].reduce((s, v) => s + Math.abs(v), 0) + 1);
  const shifted = M.map((row, i) => row.map((v, k) => v + (i === k ? c : 0)));
  const { s, V } = jacobiSVD(shifted, false, 1e-15, 60);
  // singular values descend; the eigenvalues ascend
  const order = s.map((_, k) => n - 1 - k);
  return { values: order.map((k) => s[k] - c), vectors: V.map((row) => order.map((k) => row[k])) };
}

const ladder = (j: number, m: number, up: boolean) => Math.sqrt(j * (j + 1) - m * (m + (up ? 1 : -1)));

export interface ProductState { m1: number; m2: number }

/** The product states of one M, in the order m₁ = j₁, j₁ − 1, … */
export function block(j1: number, j2: number, M: number): ProductState[] {
  const out: ProductState[] = [];
  for (let m1 = j1; m1 >= -j1 - 1e-9; m1--) {
    const m2 = M - m1;
    if (Math.abs(m2) <= j2 + 1e-9) out.push({ m1, m2 });
  }
  return out;
}

/** ⟨a|J²|b⟩ between product states of one block. */
function j2Element(j1: number, j2: number, a: ProductState, b: ProductState): number {
  if (a.m1 === b.m1 && a.m2 === b.m2) return j1 * (j1 + 1) + j2 * (j2 + 1) + 2 * a.m1 * a.m2;
  // J₁₊J₂₋ raises m₁ by one and lowers m₂ by one, J₁₋J₂₊ the reverse
  if (Math.abs(a.m1 - b.m1 - 1) < 1e-9) return ladder(j1, b.m1, true) * ladder(j2, b.m2, false);
  if (Math.abs(a.m1 - b.m1 + 1) < 1e-9) return ladder(j1, b.m1, false) * ladder(j2, b.m2, true);
  return 0;
}

/** Clebsch–Gordan coefficients by diagonalising J², keyed `J,M` to their components on block(M). */
export function cgByDiagonalising(j1: number, j2: number): Map<string, { states: ProductState[]; c: number[] }> {
  const out = new Map<string, { states: ProductState[]; c: number[] }>();
  for (let M = j1 + j2; M >= -(j1 + j2) - 1e-9; M--) {
    const states = block(j1, j2, M);
    const H = states.map((a) => states.map((b) => j2Element(j1, j2, a, b)));
    const { values, vectors } = symmetricEigen(H);
    values.forEach((lambda, k) => {
      const J = Math.round(2 * ((-1 + Math.sqrt(1 + 4 * lambda)) / 2)) / 2;
      let c = vectors.map((row) => row[k]);
      // Condon–Shortley: at M = J the m₁ = j₁ component is positive; below, the overlap with J₋|J M + 1⟩
      const above = out.get(`${J},${M + 1}`);
      let sign = 1;
      if (!above) sign = c[0] < 0 ? -1 : 1;
      else {
        let overlap = 0;
        above.states.forEach((s, i) => {
          // J₋ = J₁₋ + J₂₋ applied to the state above, projected on this block's states
          states.forEach((t, k2) => {
            if (Math.abs(t.m1 - (s.m1 - 1)) < 1e-9 && Math.abs(t.m2 - s.m2) < 1e-9) overlap += c[k2] * above.c[i] * ladder(j1, s.m1, false);
            if (Math.abs(t.m2 - (s.m2 - 1)) < 1e-9 && Math.abs(t.m1 - s.m1) < 1e-9) overlap += c[k2] * above.c[i] * ladder(j2, s.m2, false);
          });
        });
        sign = overlap < 0 ? -1 : 1;
      }
      c = c.map((v) => sign * v);
      out.set(`${J},${M}`, { states, c });
    });
  }
  return out;
}

const fact = (x: number): number => { const n = Math.round(x); let f = 1; for (let k = 2; k <= n; k++) f *= k; return f; };

/** Racah's formula for ⟨j₁ m₁ j₂ m₂|J M⟩. */
export function cgRacah(j1: number, m1: number, j2: number, m2: number, J: number, M: number): number {
  if (Math.abs(m1 + m2 - M) > 1e-9) return 0;
  const pre = Math.sqrt(((2 * J + 1) * fact(J + j1 - j2) * fact(J - j1 + j2) * fact(j1 + j2 - J)) / fact(j1 + j2 + J + 1))
    * Math.sqrt(fact(J + M) * fact(J - M) * fact(j1 - m1) * fact(j1 + m1) * fact(j2 - m2) * fact(j2 + m2));
  let sum = 0;
  for (let k = 0; k <= 2 * (j1 + j2 + J); k++) {
    const args = [k, j1 + j2 - J - k, j1 - m1 - k, j2 + m2 - k, J - j2 + m1 + k, J - j1 - m2 + k];
    if (args.some((a) => a < -1e-9)) continue;
    sum += (k % 2 === 0 ? 1 : -1) / args.reduce((d, a) => d * fact(a), 1);
  }
  return pre * sum;
}

/** The hyperfine levels of a nucleus I and an electron S = ½ in a field: A I·S + b S_z, the nuclear
 * moment neglected, diagonalised in each block of m = m_I + m_S; ascending within each block. */
export function hyperfineLevels(I: number, A: number, b: number): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const S = 0.5;
  for (let M = I + S; M >= -(I + S) - 1e-9; M--) {
    const states = block(I, S, M);
    const H = states.map((p) => states.map((q) => {
      if (p.m1 === q.m1 && p.m2 === q.m2) return A * p.m1 * p.m2 + b * p.m2;
      // A(I₊S₋ + I₋S₊)/2
      if (Math.abs(p.m1 - q.m1 - 1) < 1e-9) return (A / 2) * ladder(I, q.m1, true) * ladder(S, q.m2, false);
      if (Math.abs(p.m1 - q.m1 + 1) < 1e-9) return (A / 2) * ladder(I, q.m1, false) * ladder(S, q.m2, true);
      return 0;
    }));
    out.set(M, symmetricEigen(H).values);
  }
  return out;
}

/** The Breit–Rabi formula for the same levels, ascending within each m. */
export function breitRabi(I: number, A: number, b: number, m: number): number[] {
  const dE = A * (I + 0.5);
  if (Math.abs(Math.abs(m) - (I + 0.5)) < 1e-9) return [(A * I) / 2 + Math.sign(m) * (b / 2)];
  const x = b / dE;
  const root = (dE / 2) * Math.sqrt(1 + (4 * m * x) / (2 * I + 1) + x * x);
  const base = -dE / (2 * (2 * I + 1));
  return [base - root, base + root];
}
