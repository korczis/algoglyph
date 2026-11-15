// Charged particles in prescribed fields (src/plates/_shared/particles/charged.ts) against what the
// pusher does not compute: the gyroradius mv/qB and period 2πm/qB, the E×B drift E/B, a mirror
// field's divergence-free radial part, and the adiabatic invariant μ = mv⊥²/2B along a bounce.
import { describe, expect, it } from 'vitest';
import { gyrate, mirrorField, push, uniformField } from '../src/plates/_shared/particles/charged';

describe('charged-particles', () => {
  it('gyrates with radius v/(q/m)B and period 2π/((q/m)B)', () => {
    const r = gyrate({ qm: 2, B: 1.5, v: 0.9, h: 1e-3, turns: 3 });
    expect(Math.abs(r.radius - 0.9 / 3) / 0.3).toBeLessThan(1e-5);
    expect(Math.abs(r.period - (2 * Math.PI) / 3) / ((2 * Math.PI) / 3)).toBeLessThan(1e-5);
  });

  it('drifts across crossed fields at E/B whatever its charge', () => {
    for (const qm of [1, -3]) {
      const s = { x: new Float64Array(3), v: new Float64Array([0, 0.2, 0]) };
      const f = uniformField([0, 0.5, 0], [0, 0, 2]);
      const T = (2 * Math.PI) / (Math.abs(qm) * 2);
      const n = 2000;
      for (let k = 0; k < 10 * n; k++) push(s, T / n, qm, f);
      // after whole gyrations the guiding centre has moved E×B/B² t = (E/B) x̂ · 10T
      expect(s.x[0] / (10 * T)).toBeCloseTo(0.25, 6);
    }
  });

  it('a mirror field has no divergence', () => {
    const f = mirrorField(1, 2);
    const h = 1e-5;
    for (const [x, y, z] of [[0.1, 0.05, 0.3], [-0.2, 0.1, -0.7]]) {
      const d = (i: number) => {
        const p = [x, y, z]; const m = [x, y, z];
        p[i] += h; m[i] -= h;
        return (f(p[0], p[1], p[2]).B[i] - f(m[0], m[1], m[2]).B[i]) / (2 * h);
      };
      expect(Math.abs(d(0) + d(1) + d(2))).toBeLessThan(1e-8);
    }
  });

  it('keeps μ = v⊥²/2B nearly constant along a bounce in a slowly varying mirror', () => {
    const f = mirrorField(1, 4);
    const s = { x: new Float64Array([0.02, 0, 0]), v: new Float64Array([0.3, 0, 0.3]) };
    const mu = () => {
      const { B } = f(s.x[0], s.x[1], s.x[2]);
      const b = Math.hypot(B[0], B[1], B[2]);
      const vpar = (s.v[0] * B[0] + s.v[1] * B[1] + s.v[2] * B[2]) / b;
      return (s.v[0] ** 2 + s.v[1] ** 2 + s.v[2] ** 2 - vpar * vpar) / (2 * b);
    };
    const mu0 = mu();
    let worst = 0;
    for (let k = 0; k < 40000; k++) { push(s, 2e-3, 1, f); worst = Math.max(worst, Math.abs(mu() / mu0 - 1)); }
    expect(worst).toBeLessThan(0.05);
  });
});
