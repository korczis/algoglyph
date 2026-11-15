// Spin rotations (src/plates/_shared/quantum/rotation.ts) and the analyser chain of the
// stern-gerlach-analyzers plate, beyond the entry's claims: the exponential of the generator against
// Wigner's formula for j up to 2, the group law R(a)R(b) = R(a + b), the sign a turn of 2π gives a
// half-integer spin, the spin-½ matrix in closed form, and the chain's probabilities summing to one,
// with an open middle analyser leaving the state as it was.
import { describe, expect, it } from 'vitest';
import { mul, rotationY, wignerMatrix } from '../src/plates/_shared/quantum/rotation';
import { chain } from '../src/plates/stern-gerlach-analyzers/plate';

const close = (a: number[][], b: number[][], tol: number) =>
  a.forEach((row, i) => row.forEach((v, k) => expect(Math.abs(v - b[i][k])).toBeLessThan(tol)));

describe('stern-gerlach-analyzers', () => {
  it('rotates by the exponential of the generator exactly as Wigner’s formula says', () => {
    for (const j of [0.5, 1, 1.5, 2]) for (const t of [0.3, 1.2, 2.5, Math.PI, 5.9]) close(rotationY(j, t), wignerMatrix(j, t), 1e-12);
  });

  it('composes rotations about one axis by adding the angles', () => {
    for (const j of [0.5, 1.5]) close(mul(rotationY(j, 0.7), rotationY(j, 1.9)), rotationY(j, 2.6), 1e-12);
  });

  it('turns a half-integer spin into minus itself after 2π, an integer one into itself', () => {
    for (const j of [0.5, 1, 1.5, 2]) {
      const R = rotationY(j, 2 * Math.PI);
      const s = Number.isInteger(j) ? 1 : -1;
      R.forEach((row, i) => row.forEach((v, k) => expect(v).toBeCloseTo(i === k ? s : 0, 12)));
    }
  });

  it('gives the spin-½ rotation in closed form', () => {
    const t = 1.1;
    close(rotationY(0.5, t), [[Math.cos(t / 2), -Math.sin(t / 2)], [Math.sin(t / 2), Math.cos(t / 2)]], 1e-14);
  });

  it('sends every particle somewhere, and an open middle analyser changes nothing', () => {
    for (const j of [0.5, 1, 1.5]) {
      const R = (t: number) => rotationY(j, t);
      for (const keep of [null, 0, Math.round(2 * j)]) {
        const { pC } = chain(R, 1.3, 0.4, keep);
        expect(pC.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
      }
      const open = chain(R, 1.3, 0.4, null).pC;
      const direct = wignerMatrix(j, 0.4).map((row) => row[0] ** 2);
      open.forEach((v, c) => expect(v).toBeCloseTo(direct[c], 12));
    }
  });
});
