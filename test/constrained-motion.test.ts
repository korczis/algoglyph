// The constrained-motion solver (src/plates/_shared/particles/constraint.ts) beyond its claims
// (catalogue/entries/constrained-motion.md): the cycloid track against its own parametric form, the
// slope against a finite difference, RATTLE on a straight incline against ½at² at every step,
// second-order convergence of the pendulum's time to the bottom against the elliptic integral, the
// threshold of static friction at tan θ = μ, and the Hermite crossing on a cubic it must reproduce.
import { describe, expect, it } from 'vitest';
import { agmK } from '../src/plates/_shared/lumped/oscillator';
import {
  bead, circle, cycloid, incline, leftAt, rattle, type Track,
} from '../src/plates/_shared/particles/constraint';
import { crossing } from '../src/plates/constrained-motion/plate';

/** The first upward zero crossing of x for a bead released at height y0, with step h. */
function timeToBottom(track: Track, y0: number, h: number): number {
  const b = bead(track, leftAt(track, y0), 1);
  for (let i = 0; i < 1e6; i++) {
    const x0 = b.x;
    const v0 = b.vx;
    rattle(b, track, h, 1, 0);
    if (x0 < 0 && b.x >= 0) return crossing(i * h, x0, v0, b.x, b.vx, h);
  }
  return Number.NaN;
}

describe('constrained-motion', () => {
  it('the cycloid track passes through its parametric points, with the slope a finite difference gives', () => {
    const R = 1.3;
    const c = cycloid(R);
    for (const phi of [-2.9, -1.7, -0.4, 0, 0.25, 1.1, 2.6]) {
      const x = R * (phi + Math.sin(phi));
      expect(c.f(x)).toBeCloseTo(R * (1 - Math.cos(phi)), 12);
      const d = 1e-6;
      expect(c.df(x)).toBeCloseTo((c.f(x + d) - c.f(x - d)) / (2 * d), 6);
    }
  });

  it('slides down a frictionless incline as ½ g sin θ t², on the incline, at every step', () => {
    const theta = 0.6;
    const track = incline(theta, 50);
    const b = bead(track, 0, 1);
    const h = 0.01;
    for (let i = 1; i <= 500; i++) {
      rattle(b, track, h, 1, 0);
      const t = i * h;
      expect(Math.hypot(b.x, b.y)).toBeCloseTo(0.5 * Math.sin(theta) * t * t, 10);
      expect(Math.abs(b.y + b.x * Math.tan(theta))).toBeLessThan(1e-12);
      expect(b.normal).toBeCloseTo(Math.cos(theta), 9);
    }
  });

  it('holds a block exactly when μ ≥ tan θ and lets it slide just below', () => {
    const theta = Math.atan(0.5);
    for (const [mu, moves] of [[0.51, false], [0.49, true]] as const) {
      const track = incline(theta, 10);
      const b = bead(track, 0, 1);
      for (let i = 0; i < 1000; i++) rattle(b, track, 0.01, 1, mu);
      const s = Math.hypot(b.x, b.y);
      if (moves) expect(s).toBeCloseTo(0.5 * (Math.sin(theta) - mu * Math.cos(theta)) * 100, 6);
      else expect(s).toBeLessThan(1e-12);
    }
  });

  it('times the pendulum bowl against the elliptic integral with an error second order in the step', () => {
    const L = 4;
    const track = circle(L, Math.sqrt(12));
    const y0 = 1.8;
    const exact = Math.sqrt(L) * agmK(Math.sin(Math.acos(1 - y0 / L) / 2));
    const e1 = Math.abs(timeToBottom(track, y0, 0.004) - exact);
    const e2 = Math.abs(timeToBottom(track, y0, 0.002) - exact);
    expect(e1).toBeLessThan(1e-5);
    expect(e1 / e2).toBeGreaterThan(3.5);
    expect(e1 / e2).toBeLessThan(4.5);
  });

  it('places a crossing exactly when the motion between two steps is a cubic', () => {
    const x = (t: number) => (t - 0.37) * (1 + 0.5 * t + 0.2 * t * t);
    const v = (t: number) => 1 + 0.5 * t + 0.2 * t * t + (t - 0.37) * (0.5 + 0.4 * t);
    expect(crossing(0.3, x(0.3), v(0.3), x(0.45), v(0.45), 0.15)).toBeCloseTo(0.37, 12);
  });
});
