// Lumped oscillators (src/plates/_shared/lumped/oscillator.ts), integrated by the shared RK4 and
// held to closed forms they do not use: the steady amplitude and phase of a driven damped
// oscillator, the absorbed power's full width at half maximum equal to γ (so Q two ways), the
// ring-down rate γ/2, no overshoot at critical damping, the pendulum's period 4K(sin θ₀/2)/ω₀ with K
// from the arithmetic-geometric mean, and the beat period of two coupled oscillators.
import { describe, expect, it } from 'vitest';
import {
  agmK, beatPeriod, criticalMinimum, lockIn, pendulumPeriod, ringDownRate, steadyClosedForm, powerWidth,
  type Oscillator,
} from '../src/plates/_shared/lumped/oscillator';

const osc: Oscillator = { m: 1, omega0: 2, gamma: 0.2, F0: 1, pendulum: false };

describe('lumped: closed forms', () => {
  it('K(k) by the arithmetic-geometric mean matches published values', () => {
    // Abramowitz and Stegun, table 17.1 (modulus k = sin α): K(sin 30°) and K(sin 60°)
    expect(agmK(0.5)).toBeCloseTo(1.685750354812596, 13);
    expect(agmK(Math.sin(Math.PI / 3))).toBeCloseTo(2.156515647499643, 13);
    expect(agmK(0)).toBeCloseTo(Math.PI / 2, 15);
  });
});

describe('lumped: integrated against closed forms', () => {
  it('a driven damped oscillator settles to the closed-form amplitude and phase', () => {
    for (const w of [1, 1.9, 2, 2.6]) {
      const m = lockIn(osc, w);
      const c = steadyClosedForm(osc, w);
      expect(Math.abs(m.amplitude / c.amplitude - 1), `ω ${w}`).toBeLessThan(1e-4);
      expect(Math.abs(m.phase - c.phase), `ω ${w}`).toBeLessThan(1e-4);
    }
  });

  it('the absorbed power is a resonance of full width γ at half maximum, so Q = ω₀/γ two ways', () => {
    const width = powerWidth(osc, 61);
    expect(Math.abs(width / osc.gamma - 1)).toBeLessThan(0.01);
    const rate = ringDownRate(osc);
    expect(Math.abs(rate / (osc.gamma / 2) - 1)).toBeLessThan(0.01);
  });

  it('released from rest at critical damping it never overshoots; underdamped it does', () => {
    expect(criticalMinimum({ ...osc, gamma: 2 * osc.omega0 })).toBeGreaterThanOrEqual(-1e-12);
    expect(criticalMinimum({ ...osc, gamma: 0.5 * osc.omega0 })).toBeLessThan(-0.01);
  });

  it('a pendulum’s period at large amplitude is 4K(sin θ₀/2)/ω₀', () => {
    for (const deg of [10, 90, 150]) {
      const th = (deg * Math.PI) / 180;
      const T = pendulumPeriod({ ...osc, gamma: 0, pendulum: true }, th);
      expect(Math.abs(T / ((4 * agmK(Math.sin(th / 2))) / osc.omega0) - 1), `${deg}°`).toBeLessThan(1e-5);
    }
  });

  it('two coupled oscillators trade their energy with the beat period 2π/(ω₂ − ω₁)', () => {
    const kappa = 0.4;
    const w1 = osc.omega0;
    const w2 = Math.sqrt(osc.omega0 ** 2 + 2 * kappa);
    expect(Math.abs(beatPeriod(osc.omega0, kappa) / ((2 * Math.PI) / (w2 - w1)) - 1)).toBeLessThan(0.01);
  });
});
