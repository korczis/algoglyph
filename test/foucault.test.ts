import { describe, expect, it } from 'vitest';
import { EARTH_OMEGA, invariants, PrecessionMeter, rk4, type State } from '../src/plates/foucault-pendulum/foucault';

const W0 = (2 * Math.PI) / 2.4;
const DT = 1 / 240;

function measure(latDeg: number, boost: number, seconds: number, amp = 0.1): number {
  const wz = EARTH_OMEGA * boost * Math.sin((latDeg * Math.PI) / 180);
  let s: State = [amp, 0, 0, 0];
  const meter = new PrecessionMeter();
  for (let t = DT; t <= seconds; t += DT) {
    s = rk4(s, DT, W0, wz);
    meter.sample(t, s[0], s[1]);
  }
  return meter.rate();
}

describe('foucault pendulum', () => {
  for (const lat of [30, 48.85, 90, -45]) {
    it(`precesses at −Ω·sin(latitude) within 2 % at ${lat}°`, () => {
      const theory = -EARTH_OMEGA * 3000 * Math.sin((lat * Math.PI) / 180);
      const rate = measure(lat, 3000, 60);
      expect(Math.abs((rate - theory) / theory)).toBeLessThan(0.02);
    });
  }

  it('does not precess on the equator', () => {
    expect(Math.abs(measure(0, 3000, 60))).toBeLessThan(1e-6);
  });

  it('the northern hemisphere turns clockwise from above (negative rate)', () => {
    expect(measure(48.85, 3000, 30)).toBeLessThan(0);
    expect(measure(-48.85, 3000, 30)).toBeGreaterThan(0);
  });

  it('a full turn in Paris takes about 31.8 hours on the real Earth', () => {
    const hours = (2 * Math.PI) / (EARTH_OMEGA * Math.sin((48.85 * Math.PI) / 180)) / 3600;
    expect(hours).toBeCloseTo(31.8, 1);
  });

  it('keeps the energy and J, whose rates along the flow vanish: RK4 changes them only at fifth order', () => {
    const wz = 0.3;
    const s: State = [0.1, -0.05, 0.2, 0.15];
    const a = invariants(s, W0, wz);
    const e = (h: number) => {
      const b = invariants(rk4(s, h, W0, wz), W0, wz);
      return Math.abs(b.E - a.E) + Math.abs(b.J - a.J);
    };
    // a quantity that changed at first order would change 2× when the step doubles; these change 2⁵×
    expect(Math.log2(e(0.02) / e(0.01))).toBeGreaterThan(4.5);
  });

  it('times the turning points of the exact rosette at π/√(ω₀² + Ωz²)', () => {
    // released at rest at (a, 0): x + iy = a(c₁e^{iλ₁t} + c₂e^{iλ₂t}), λ = −Ωz ± √(ω₀² + Ωz²)
    const wz = 0.4;
    const w = Math.sqrt(W0 * W0 + wz * wz);
    const l1 = -wz + w;
    const l2 = -wz - w;
    const c1 = -l2 / (l1 - l2);
    const c2 = l1 / (l1 - l2);
    const meter = new PrecessionMeter();
    for (let t = 0; t <= 60; t += DT) {
      const x = 0.1 * (c1 * Math.cos(l1 * t) + c2 * Math.cos(l2 * t));
      const y = 0.1 * (c1 * Math.sin(l1 * t) + c2 * Math.sin(l2 * t));
      meter.sample(t, x, y, DT);
    }
    expect(meter.halfSwing()).toBeCloseTo(Math.PI / w, 8);
    expect(meter.rate()).toBeCloseTo(-wz, 3);
  });
});
