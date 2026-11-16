// Coupled angular momenta (src/plates/_shared/quantum/coupling.ts) beyond the
// angular-momentum-coupling entry's claims: the eigen-solver on a matrix with known eigenvalues, the
// textbook Clebsch–Gordan values of ½ ⊗ ½ and 1 ⊗ ½ with their Condon–Shortley signs, Racah's
// formula's orthogonality, and the hyperfine levels at zero and very high field against their limits.
import { describe, expect, it } from 'vitest';
import { block, cgByDiagonalising, cgRacah, hyperfineLevels, symmetricEigen } from '../src/plates/_shared/quantum/coupling';

describe('angular-momentum-coupling', () => {
  it('finds the eigenvalues and eigenvectors of a symmetric matrix with a negative eigenvalue', () => {
    // [[2, 1], [1, 2]] has 1 and 3; [[0, 2], [2, 0]] has −2 and 2
    for (const [M, want] of [[[[2, 1], [1, 2]], [1, 3]], [[[0, 2], [2, 0]], [-2, 2]]] as const) {
      const { values, vectors } = symmetricEigen(M.map((r) => [...r]));
      values.forEach((v, k) => expect(v).toBeCloseTo(want[k], 12));
      for (let k = 0; k < 2; k++) {
        const x = vectors.map((r) => r[k]);
        const Mx = M.map((r) => r[0] * x[0] + r[1] * x[1]);
        Mx.forEach((v, i) => expect(v).toBeCloseTo(values[k] * x[i], 12));
      }
    }
  });

  it('gives the textbook coefficients and signs of ½ ⊗ ½ and 1 ⊗ ½', () => {
    const t = cgByDiagonalising(0.5, 0.5);
    // |1 0⟩ = (|↑↓⟩ + |↓↑⟩)/√2, |0 0⟩ = (|↑↓⟩ − |↓↑⟩)/√2
    expect(t.get('1,0')!.c).toEqual([expect.closeTo(Math.SQRT1_2, 12), expect.closeTo(Math.SQRT1_2, 12)]);
    expect(t.get('0,0')!.c).toEqual([expect.closeTo(Math.SQRT1_2, 12), expect.closeTo(-Math.SQRT1_2, 12)]);
    // |½ ½⟩ = √(2/3)|1, −½⟩ − √(1/3)|0, ½⟩, with block(½) ordered m₁ = 1, 0
    const u = cgByDiagonalising(1, 0.5).get('0.5,0.5')!;
    expect(u.states.map((s) => s.m1)).toEqual([1, 0]);
    expect(u.c[0]).toBeCloseTo(Math.sqrt(2 / 3), 12);
    expect(u.c[1]).toBeCloseTo(-Math.sqrt(1 / 3), 12);
  });

  it('has Racah’s coefficients orthonormal over the product states of each M', () => {
    const [j1, j2] = [1.5, 1];
    for (let M = j1 + j2; M >= -(j1 + j2); M--) {
      const states = block(j1, j2, M);
      const Js: number[] = [];
      for (let J = j1 + j2; J >= Math.max(Math.abs(j1 - j2), Math.abs(M)); J--) Js.push(J);
      for (const a of Js) for (const b of Js) {
        const dot = states.reduce((s, p) => s + cgRacah(j1, p.m1, j2, p.m2, a, M) * cgRacah(j1, p.m1, j2, p.m2, b, M), 0);
        expect(dot).toBeCloseTo(a === b ? 1 : 0, 12);
      }
    }
  });

  it('splits the levels by A(I + ½) at zero field and by the electron spin at a very high field', () => {
    const I = 1.5;
    const zero = [...hyperfineLevels(I, 1, 0).values()].flat();
    expect(Math.max(...zero) - Math.min(...zero)).toBeCloseTo(2, 12);
    // at b ≫ A the levels are b·m_S + A m_I m_S: two groups ±b/2, each 2I + 1 levels
    const b = 1e6;
    const high = [...hyperfineLevels(I, 1, b).values()].flat();
    expect(high.filter((e) => e > 0).length).toBe(4);
    for (const e of high) expect(Math.abs(Math.abs(e) - b / 2)).toBeLessThan(1);
  });
});
