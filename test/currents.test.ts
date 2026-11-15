// The Biot–Savart module (src/plates/_shared/fields/biot-savart.ts) against what it does not use:
// published K and E, the loop's axis at the polygon's second order, the infinite wire's μ₀I/2πr,
// Ampère's circulation, the symmetry of Neumann's integral, and the motional EMF.
import { describe, expect, it } from 'vitest';
import {
  circulation, ellipticKE, field, fluxThroughDisc, legendre01, loop, motionalEmf, neumann,
} from '../src/plates/_shared/fields/biot-savart';
import { R, R2 } from '../src/plates/currents-and-magnetic-fields/plate';

describe('currents-and-magnetic-fields', () => {
  it('K and E by the AGM match Abramowitz and Stegun, table 17.1, and Gauss–Legendre integrates x⁷ exactly', () => {
    const { K, E } = ellipticKE(Math.sin(Math.PI / 6));
    expect(K).toBeCloseTo(1.685750354812596, 13);
    expect(E).toBeCloseTo(1.467462209339427, 13);
    const g = legendre01(4);
    expect(g.x.reduce((s, x, i) => s + g.w[i] * x ** 7, 0)).toBeCloseTo(1 / 8, 14);
  });

  it('the loop’s axis field converges to μ₀IR²/2(R² + z²)^(3/2) at second order in the side', () => {
    const want = 1 / (2 * 1.25 ** 1.5);
    const gap = (n: number) => Math.abs(field([loop(1, 0, n, 1)], [0, 0, 0.5])[2] - want);
    expect(Math.abs(Math.log2(gap(64) / gap(128)) - 2)).toBeLessThan(0.2);
  });

  it('a long wire gives μ₀I/2πr, and Ampère’s circulation counts only the current enclosed', () => {
    const wire = [{ points: [[0, 0, -1e4], [0, 0, 1e4]] as [number, number, number][], current: 1 }];
    expect(Math.abs(Math.hypot(...field(wire, [0.5, 0, 0])) - 1 / Math.PI)).toBeLessThan(1e-8);
    expect(Math.abs(circulation(wire, [0.2, 0.3, 0], 0.9, 128) - 1)).toBeLessThan(1e-6);
    expect(Math.abs(circulation(wire, [2, 0, 0], 0.9, 128))).toBeLessThan(1e-6);
  });

  it('Neumann’s integral is symmetric, and equals the flux through either loop', () => {
    const a = loop(R, 0, 256, 1);
    const b = loop(R2, 0.4, 256, 1);
    expect(Math.abs(neumann(a, b) - neumann(b, a))).toBeLessThan(1e-12);
    // the flux of the small loop's field through the large one, against the reverse
    expect(Math.abs(fluxThroughDisc([b], R, 0, 48, 96) - fluxThroughDisc([a], R2, 0.4, 48, 96))).toBeLessThan(2e-4);
  });

  it('a loop moving in no field has no EMF; in a uniform field a translated loop has none either', () => {
    const moving = loop(0.5, 0.3, 64, 0);
    expect(motionalEmf([], moving, [0, 0, 1])).toBe(0);
    // a uniform field along z from a very large loop: translation along x changes no flux
    const big = [loop(100, 0, 512, 1)];
    expect(Math.abs(motionalEmf(big, moving, [1, 0, 0]))).toBeLessThan(1e-9);
  });
});
