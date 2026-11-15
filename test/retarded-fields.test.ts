// The Liénard–Wiechert solver (src/plates/_shared/em/lienard-wiechert.ts) against what it does not
// compute: the retarded time of a charge at rest (the light time, exactly), of uniform motion by the
// closed root of the quadratic, Coulomb's field, Gauss's law for the moving charge's field over a
// sphere, and the radiation kink's place between two light fronts.
import { describe, expect, it } from 'vitest';
import { circular, fields, kick, retardedTime, sphereFlux, uniform, type V3 } from '../src/plates/_shared/em/lienard-wiechert';
import { retardedFields } from '../src/plates/retarded-fields/plate';

describe('retarded-fields', () => {
  it('a charge at rest: the retarded time is the light time, and E is Coulomb’s', () => {
    const w = uniform(0);
    const x: V3 = [1.5, -2, 0.5];
    const r = Math.hypot(...x);
    expect(retardedTime(w, x, 3)).toBeCloseTo(3 - r, 12);
    const E = fields(w, x, 3).E;
    for (let k = 0; k < 3; k++) expect(E[k]).toBeCloseTo(x[k] / r ** 3, 12);
  });

  it('uniform motion: the retarded time is the root of (t − t_r)² = |x − βt_r|²', () => {
    const b = 0.7;
    const x: V3 = [2, 1, -0.5];
    const t = 1.3;
    // (1 − b²) s² − 2(t − b x₀) s ... solved for t_r directly: (t − t_r)² = (x₀ − b t_r)² + y² + z²
    const A = 1 - b * b;
    const B = -2 * t + 2 * b * x[0];
    const C = t * t - x[0] * x[0] - x[1] * x[1] - x[2] * x[2];
    const tr = (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A);
    expect(retardedTime(uniform(b), x, t)).toBeCloseTo(tr, 12);
  });

  it('Gauss’s law holds for the field of a moving charge: the flux through a sphere is 4π', () => {
    const w = uniform(0.8);
    // Gauss–Legendre in cos θ by the midpoint stand-in: a fine midpoint rule is enough at 1e-4
    const n = 120;
    let flux = 0;
    for (let i = 0; i < n; i++) {
      const mu = -1 + (2 * (i + 0.5)) / n;
      const st = Math.sqrt(1 - mu * mu);
      for (let j = 0; j < n; j++) {
        const ph = (2 * Math.PI * (j + 0.5)) / n;
        const nv: V3 = [mu, st * Math.cos(ph), st * Math.sin(ph)];
        const E = fields(w, [2 * nv[0], 2 * nv[1], 2 * nv[2]], 0).E;
        flux += (E[0] * nv[0] + E[1] * nv[1] + E[2] * nv[2]) * 4 * (2 / n) * ((2 * Math.PI) / n);
      }
    }
    expect(flux / (4 * Math.PI)).toBeCloseTo(1, 3);
  });

  it('a kicked charge radiates only between the light fronts of the kick’s start and end', () => {
    const w = kick(0.6, 0.5);
    // at t = 3, the shell 2.5 < r < 3 has seen the acceleration; outside it the field is radial
    // from where the charge was, inside from where it would be coasting
    const far = fields(w, [0, 3.5, 0], 3).E;
    expect(Math.abs(far[0] / far[1])).toBeLessThan(1e-12);
    const shell = fields(w, [0, 2.8, 0], 3).E;
    expect(Math.abs(shell[0])).toBeGreaterThan(0.1 * Math.abs(shell[1]));
  });

  it('a charge on a circle at 0.6 c radiates (2/3)γ⁴a² through a far sphere, averaged over a turn', () => {
    const b = 0.6;
    const w = circular(1, b);
    const T = (2 * Math.PI) / b;
    let p = 0;
    for (let k = 0; k < 16; k++) p += sphereFlux(w, 12, 12 + (T * k) / 16, 48, 48).power / 16;
    const g2 = 1 / (1 - b * b);
    expect(p).toBeCloseTo((2 / 3) * g2 * g2 * b ** 4, 8);
  });

  it('declares its pace', () => {
    expect(retardedFields.pace?.kind).toBe('replay');
  });
});
