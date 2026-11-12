// Static fields by superposition (src/plates/_shared/fields/), each against something computed
// another way: Gauss–Legendre nodes against published values, Gauss's law as a numerical surface
// integral against the summed enclosed charge, the plane and sphere images against the grounded
// conductor they stand for, the dipole's far field against r⁻³, field lines against the field.
import { describe, expect, it } from 'vitest';
import {
  dipoleAxisSlope, field, fieldLine, gaussFlux, gaussLegendre, planeInducedCharge, potential,
  sphereImage, type Charge,
} from '../src/plates/_shared/fields/superposition';

describe('fields: quadrature', () => {
  it('Gauss–Legendre nodes and weights match the published five-point rule', () => {
    const { x, w } = gaussLegendre(5);
    // Abramowitz and Stegun, table 25.4
    expect(x[4]).toBeCloseTo(0.906179845938664, 14);
    expect(x[3]).toBeCloseTo(0.538469310105683, 14);
    expect(x[2]).toBeCloseTo(0, 14);
    expect(w[4]).toBeCloseTo(0.236926885056189, 14);
    expect(w[2]).toBeCloseTo(0.568888888888889, 14);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 14);
  });
});

describe('fields: superposition', () => {
  it('is Coulomb’s law with ε₀ = 1: E = q r̂ / 4πr², V = q / 4πr', () => {
    const c: Charge[] = [{ x: 0, y: 0, z: 0, q: 2 }];
    const [ex, ey, ez] = field(c, 3, 4, 0);
    expect(Math.hypot(ex, ey, ez)).toBeCloseTo(2 / (4 * Math.PI * 25), 15);
    expect(ex / ey).toBeCloseTo(3 / 4, 15);
    expect(potential(c, 3, 4, 0)).toBeCloseTo(2 / (4 * Math.PI * 5), 15);
  });

  it('Gauss: the flux through a sphere is the charge inside it, whatever lies outside', () => {
    const c: Charge[] = [{ x: 0.3, y: 0.1, z: 0, q: 1 }, { x: -0.4, y: 0.2, z: 0, q: -0.5 }, { x: 2.5, y: 0, z: 0, q: 3 }];
    expect(Math.abs(gaussFlux(c, [0, 0, 0], 1) - 0.5)).toBeLessThan(1e-9);
    expect(Math.abs(gaussFlux(c, [0, 0, 0], 3) - 3.5)).toBeLessThan(1e-9);
    expect(Math.abs(gaussFlux(c, [5, 5, 0], 1))).toBeLessThan(1e-9);
  });

  it('the plane image induces −q on the grounded plane, by a numerical integral of σ = −E_n', () => {
    for (const a of [0.5, 1, 2]) expect(Math.abs(planeInducedCharge(1.5, a) + 1.5)).toBeLessThan(1e-9);
  });

  it('the sphere image q′ = −qR/a at R²/a grounds the sphere, and holds the flux of the sphere', () => {
    const q = 2;
    const R = 1;
    const a = 2.5;
    const img = sphereImage(q, a, R);
    expect(img.q).toBeCloseTo(-q * R / a, 15);
    expect(img.at).toBeCloseTo(R * R / a, 15);
    const c: Charge[] = [{ x: a, y: 0, z: 0, q }, { x: img.at, y: 0, z: 0, q: img.q }];
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const th = (Math.PI * (i + 0.5)) / 200;
      worst = Math.max(worst, Math.abs(potential(c, R * Math.cos(th), R * Math.sin(th), 0)));
    }
    expect(worst / (q / (4 * Math.PI * (a - R)))).toBeLessThan(1e-14);
    expect(Math.abs(gaussFlux(c, [0, 0, 0], 1.3) - img.q)).toBeLessThan(1e-9);
  });

  it('a dipole’s far field falls as r⁻³ on its axis; a single charge as r⁻²', () => {
    expect(Math.abs(dipoleAxisSlope([{ x: -0.05, y: 0, z: 0, q: -1 }, { x: 0.05, y: 0, z: 0, q: 1 }], 2, 20) + 3)).toBeLessThan(0.01);
    expect(Math.abs(dipoleAxisSlope([{ x: 0, y: 0, z: 0, q: 1 }], 2, 20) + 2)).toBeLessThan(1e-9);
  });

  it('a field line runs along E from a positive charge into a negative one', () => {
    const c: Charge[] = [{ x: -1, y: 0, z: 0, q: 1 }, { x: 1, y: 0, z: 0, q: -1 }];
    const line = fieldLine(c, -1 + 0.05 * Math.cos(0.6), 0.05 * Math.sin(0.6), { step: 0.01, maxSteps: 4000, bounds: 5 });
    const end = line[line.length - 1];
    expect(Math.hypot(end[0] - 1, end[1])).toBeLessThan(0.06);
    // every step of the line points along the field there
    for (let i = 10; i < line.length - 10; i += 25) {
      const [ex, ey] = field(c, line[i][0], line[i][1], 0);
      const dx = line[i + 1][0] - line[i][0];
      const dy = line[i + 1][1] - line[i][1];
      const cos = (ex * dx + ey * dy) / (Math.hypot(ex, ey) * Math.hypot(dx, dy));
      expect(cos).toBeGreaterThan(0.999);
    }
  });
});
