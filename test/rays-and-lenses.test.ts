// Exact meridional ray tracing (src/plates/_shared/optics/rays.ts) against what it does not compute:
// a single refracting sphere's paraxial focus n₂R/(n₂ − n₁), the thick-lens lensmaker formula, the
// slab's lateral shift in closed form, the order of spherical aberration, total internal
// reflection, and Snell's law out of Fermat's least time.
import { describe, expect, it } from 'vitest';
import { abcd, axisCrossing, fermatCrossing, lens, traceRay, type Surface } from '../src/plates/_shared/optics/rays';

describe('rays-and-lenses', () => {
  it('a single sphere focuses paraxial rays at n₂R/(n₂ − n₁) behind its vertex', () => {
    const s: Surface[] = [{ z: 0, R: 2, n: 1.5 }];
    const ray = traceRay(s, 1e-5, 0, -1)!;
    expect(axisCrossing(ray)).toBeCloseTo((1.5 * 2) / 0.5, 6);
  });

  it('a thick lens focuses where the lensmaker formula says, by the exact trace and by ABCD', () => {
    const n = 1.6; const R1 = 3; const R2 = -2; const t = 0.4;
    const s = lens(n, R1, R2, t);
    const P = (n - 1) * (1 / R1 - 1 / R2 + ((n - 1) * t) / (n * R1 * R2));
    // the back focal distance from the last vertex: f(1 − (n − 1)t/(nR1))
    const bfd = (1 / P) * (1 - ((n - 1) * t) / (n * R1));
    const ray = traceRay(s, 1e-5, 0, -1)!;
    expect(axisCrossing(ray) - t).toBeCloseTo(bfd, 6);
    const [[A], [C]] = abcd(s);
    expect(-C).toBeCloseTo(P, 12);
    expect(-A / C).toBeCloseTo(bfd, 12);
  });

  it('a slab shifts a ray sideways by t sin θ (1 − cos θ/√(n² − sin²θ)) and keeps its direction', () => {
    const t = 1; const n = 1.5; const th = 0.5;
    const s: Surface[] = [{ z: 0, R: Infinity, n }, { z: t, R: Infinity, n: 1 }];
    const ray = traceRay(s, 0, th, -1)!;
    expect(Math.atan2(ray.dy, ray.dz)).toBeCloseTo(th, 12);
    // the line it leaves on, against the line it came in on, measured across the direction
    const yIn = (z: number) => Math.tan(th) * (z + 1);
    const shift = (yIn(ray.z) - ray.y) * Math.cos(th);
    expect(shift).toBeCloseTo(t * Math.sin(th) * (1 - Math.cos(th) / Math.sqrt(n * n - Math.sin(th) ** 2)), 12);
  });

  it('spherical aberration grows as the square of the height', () => {
    const s = lens(1.5, 5, -5, 0.3);
    const z0 = axisCrossing(traceRay(s, 1e-6, 0, -1)!);
    const d = (h: number) => Math.abs(axisCrossing(traceRay(s, h, 0, -1)!) - z0);
    const order = Math.log(d(0.2) / d(0.1)) / Math.log(2);
    expect(Math.abs(order - 2)).toBeLessThan(0.02);
  });

  it('total internal reflection leaves no transmitted ray', () => {
    const s: Surface[] = [{ z: 0, R: Infinity, n: 1 }];
    expect(traceRay(s, 0, 1.0, -1, 1.5)).toBeNull();
  });

  it('the least-time crossing obeys Snell’s law', () => {
    const { x } = fermatCrossing(1, 1.33, [-1, 1.2], [2, -0.8]);
    const s1 = (x + 1) / Math.hypot(x + 1, 1.2);
    const s2 = (2 - x) / Math.hypot(2 - x, 0.8);
    // a minimum is flat to second order, so the search finds x only to about √ε of the path's scale
    expect(Math.abs(1 * s1 - 1.33 * s2)).toBeLessThan(1e-7);
  });
});
