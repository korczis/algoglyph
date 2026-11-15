// The discrete action (src/plates/_shared/particles/action.ts) beyond the least-action entry's claims:
// its gradient against a finite difference of the action itself, the Thomas solve against a dense
// residual, the Sturm count of negative eigenvalues against the closed-form spectrum of the
// oscillator's Hessian, second-order convergence of the stationary path to the closed form, and
// Newton's convergence on the nonlinear pendulum.
import { describe, expect, it } from 'vitest';
import {
  action, gradient, harmonic, hessianDiagonal, morseIndex, pendulum, stationaryPath, thomas, verletShoot,
} from '../src/plates/_shared/particles/action';
import { closedPath } from '../src/plates/least-action/plate';

describe('least-action', () => {
  it('has the gradient a central difference of the action gives', () => {
    const pot = pendulum(1);
    const N = 12;
    const h = 0.25;
    const q = Float64Array.from({ length: N + 1 }, (_, k) => Math.sin(0.7 * k) + 0.1 * k);
    const g = new Float64Array(N + 1);
    gradient(pot, q, h, g);
    for (let k = 1; k < N; k++) {
      const d = 1e-6;
      const up = Float64Array.from(q); up[k] += d;
      const dn = Float64Array.from(q); dn[k] -= d;
      expect(g[k]).toBeCloseTo((action(pot, up, h) - action(pot, dn, h)) / (2 * d), 6);
    }
  });

  it('solves a tridiagonal system to round-off', () => {
    const d = [4, 5, 3.5, 6, 4.2];
    const e = -1.3;
    const r = [1, -2, 0.5, 3, -1];
    const x = thomas(d, e, r);
    for (let i = 0; i < d.length; i++) {
      const lhs = d[i] * x[i] + (i > 0 ? e * x[i - 1] : 0) + (i + 1 < d.length ? e * x[i + 1] : 0);
      expect(lhs).toBeCloseTo(r[i], 12);
    }
  });

  it('counts the negative eigenvalues of the oscillator Hessian that its closed-form spectrum has', () => {
    // H = tridiag(−1/h, 2/h − hω², −1/h): eigenvalues (2/h)(1 − cos(jπ/N)) − hω², j = 1 … N − 1
    for (const [T, N] of [[2, 100], [4, 100], [7, 140], [11.5, 400]]) {
      const h = T / N;
      const q = new Float64Array(N + 1);
      const d = hessianDiagonal(harmonic(1), q, h);
      let negative = 0;
      for (let j = 1; j < N; j++) if ((2 / h) * (1 - Math.cos((j * Math.PI) / N)) - h < 0) negative++;
      expect(morseIndex(d, -1 / h)).toBe(negative);
      expect(negative).toBe(Math.floor(T / Math.PI));
    }
  });

  it('converges to the closed-form oscillator path at second order in the step', () => {
    const exact = closedPath('harmonic', 1, 0.5, 2)!;
    const err = (N: number) => {
      const { q, h } = stationaryPath(harmonic(1), 1, 0.5, 2, N);
      return Math.max(...Array.from(q, (v, k) => Math.abs(v - exact(k * h))));
    };
    const ratio = err(100) / err(200);
    expect(ratio).toBeGreaterThan(3.8);
    expect(ratio).toBeLessThan(4.2);
  });

  it('finds the pendulum path by Newton from the straight line, and Verlet reproduces it', () => {
    const pot = pendulum(1);
    const s = stationaryPath(pot, 2.5, -2, 4, 300);
    expect(s.converged).toBe(true);
    expect(s.residuals[s.residuals.length - 1]).toBeLessThan(1e-9);
    const shot = verletShoot(pot, s.q[0], s.q[1], s.h, 300);
    expect(Math.abs(shot[300] - -2)).toBeLessThan(1e-8);
  });
});
