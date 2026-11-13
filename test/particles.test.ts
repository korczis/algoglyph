// Point particles under a central force (src/plates/_shared/particles/central.ts), held to what
// they do not compute: the circular orbit's exact position for each integrator's measured order;
// the conic of the launch (vis-viva) for the apsides found; Kepler's third law; the conservation
// of angular momentum; Bertrand's two closed cases and the near-circular apsidal angle, whose gap
// is measured to be second order; the weak-field advance, whose gap is measured to be first order
// in the field; the Rutherford hyperbola; and the χ² quantiles against published tables. The
// statistical check runs on a named seed set disjoint from the plate's claim seed (4242).
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  chiSquareQuantile, deflection, gammaP, logGamma, measureOrbit, runOrbit, type CentralForce, type Integrator,
} from '../src/plates/_shared/particles/central';

const gravity: CentralForce = { k: 1, n: -2, g: 0 };

/** An orbit of semimajor axis a and eccentricity e launched at perihelion, by vis-viva. */
function ellipse(a: number, e: number, steps: number, integrator: Integrator, f: CentralForce = gravity, perihelia = 10) {
  const rp = a * (1 - e);
  const vp = Math.sqrt((1 + e) / rp);
  return runOrbit(f, rp, 0, 0, vp, { h: (2 * Math.PI) / steps, integrator, perihelia, maxSteps: 1e7, escapeR: 1e3 });
}

/**
 * The state error at t = 2 on the unit circle, against (cos t, sin t) moving at (−sin t, cos t). Not
 * at a whole period: there symplectic Euler's first-order error returns to zero and it looks second order.
 */
function circleError(integrator: Integrator, steps: number): number {
  const T = 2;
  let s = [0, 0, 0, 0];
  runOrbit(gravity, 1, 0, 0, 1, {
    h: T / steps, integrator, perihelia: Infinity, maxSteps: steps, escapeR: 1e3,
    record: (_t, x, y, vx, vy) => { s = [x, y, vx, vy]; },
  });
  return Math.hypot(s[0] - Math.cos(T), s[1] - Math.sin(T), s[2] + Math.sin(T), s[3] - Math.cos(T));
}

describe('particles: integrators on the Kepler problem', () => {
  it('each integrator converges at its order on the circular orbit: halving h divides the error by 2^p', () => {
    const order: [Integrator, number][] = [['euler', 1], ['symplectic-euler', 1], ['leapfrog', 2], ['rk4', 4]];
    for (const [method, p] of order) {
      const e1 = circleError(method, 800);
      const e2 = circleError(method, 1600);
      expect(Math.abs(Math.log2(e1 / e2) - p), `${method}: ${e1} then ${e2}`).toBeLessThan(0.2);
    }
  });

  it('leapfrog and symplectic Euler keep the angular momentum to round-off; RK4 and Euler do not', () => {
    expect(ellipse(1, 0.5, 2000, 'leapfrog').hDrift).toBeLessThan(1e-12);
    expect(ellipse(1, 0.5, 2000, 'symplectic-euler').hDrift).toBeLessThan(1e-12);
    expect(ellipse(1, 0.5, 500, 'rk4').hDrift).toBeGreaterThan(1e-10);
    expect(ellipse(1, 0.5, 2000, 'euler').hDrift).toBeGreaterThan(1e-2);
  });

  it('leapfrog’s energy error is bounded; explicit Euler’s grows from the first half to the second', () => {
    const lf = ellipse(1, 0.5, 2000, 'leapfrog');
    expect(lf.energyDriftSecondHalf).toBeLessThan(1.2 * lf.energyDriftFirstHalf);
    const eu = ellipse(1, 0.5, 2000, 'euler');
    expect(eu.energyDriftSecondHalf).toBeGreaterThan(1.2 * eu.energyDriftFirstHalf);
  });
});

describe('particles: the apsides against the conic of the launch', () => {
  it('finds the perihelion, the aphelion and the period of the ellipse vis-viva launched', () => {
    // the steps resolve each perihelion passage: e = 0.9 passes within 0.07 of the centre
    for (const [a, e, steps] of [[1, 0.5, 4000], [2.5, 0.3, 4000], [0.7, 0.9, 40000]]) {
      const m = measureOrbit(ellipse(a, e, steps, 'rk4'))!;
      expect(Math.abs(m.rPeri - a * (1 - e)), `a ${a} e ${e}`).toBeLessThan(1e-8);
      expect(Math.abs(m.rApo - a * (1 + e)), `a ${a} e ${e}`).toBeLessThan(1e-8);
      expect(Math.abs(m.period / (2 * Math.PI * a ** 1.5) - 1), `a ${a} e ${e}`).toBeLessThan(1e-8);
    }
  });

  it('a circle has no apsides to find; its period comes from whole turns of the angle', () => {
    const run = runOrbit(gravity, 1, 0, 0, 1, { h: (2 * Math.PI) / 2000, integrator: 'rk4', perihelia: 4, maxSteps: 1e6, escapeR: 1e3 });
    expect(run.apsides.length).toBe(0);
    const m = measureOrbit(run)!;
    expect(m.perihelia).toBe(0);
    expect(Math.abs(m.period - 2 * Math.PI)).toBeLessThan(1e-9);
    expect(m.e).toBeLessThan(1e-9);
  });

  it('the leapfrog period’s departure from Kepler III is second order in the step', () => {
    const gap = (steps: number) => {
      const m = measureOrbit(ellipse(2.5, 0.3, steps, 'leapfrog'))!;
      return Math.abs(m.period - 2 * Math.PI * Math.sqrt(m.a ** 3));
    };
    const g1 = gap(1000);
    const g2 = gap(2000);
    expect(Math.abs(Math.log2(g1 / g2) - 2)).toBeLessThan(0.2);
    // at the plate's default step the gap is a fifth of the claim's tolerance (1e-4)
    expect(g2).toBeLessThan(0.3e-4);
  });
});

describe('particles: which orbits close', () => {
  const apsidal = (n: number, s: number, integrator: Integrator = 'rk4') =>
    measureOrbit(runOrbit({ k: 1, n, g: 0 }, 1, 0, 0, s, { h: (2 * Math.PI) / 4000, integrator, perihelia: 6, maxSteps: 1e7, escapeR: 1e3 }))!.apsidal;

  it('n = 1 and n = −2 close at large amplitude, with apsidal angles π/2 and π (Bertrand)', () => {
    expect(Math.abs(apsidal(1, 1.3) - Math.PI / 2)).toBeLessThan(1e-9);
    expect(Math.abs(apsidal(-2, 1.3) - Math.PI)).toBeLessThan(1e-9);
  });

  it('away from them the apsidal angle tends to π/√(n + 3) with a gap second order in the departure', () => {
    for (const n of [-1, -1.5, 0]) {
      const target = Math.PI / Math.sqrt(n + 3);
      const g1 = Math.abs(apsidal(n, 1.02) - target);
      const g2 = Math.abs(apsidal(n, 1.01) - target);
      expect(Math.abs(Math.log2(g1 / g2) - 2), `n ${n}`).toBeLessThan(0.2);
    }
    // the claim's case, n = −1 at 1 % above circular, under leapfrog at the default step
    expect(Math.abs(((apsidal(-1, 1.01, 'leapfrog') - Math.PI / Math.SQRT2) * 180) / Math.PI)).toBeLessThan(0.0015);
  });
});

describe('particles: the weak-field advance', () => {
  /** The advance with the correction, less the integrator's own on the same launch. */
  function advance(delta: number): { measured: number; first: number } {
    const e = 0.5;
    const rp = 1 - e;
    const vp = Math.sqrt((1 + e) / rp);
    const g = 3 * (rp * vp) ** 2 * delta;
    const opts = { h: (2 * Math.PI) / 2000, integrator: 'leapfrog' as const, perihelia: 10, maxSteps: 1e7, escapeR: 1e3 };
    const m = measureOrbit(runOrbit({ k: 1, n: -2, g }, rp, 0, 0, vp, opts))!;
    const own = measureOrbit(runOrbit(gravity, rp, 0, 0, vp, opts))!.precession;
    return { measured: m.precession - own, first: (6 * Math.PI * delta) / (m.a * (1 - m.e ** 2)) };
  }

  it('matches 6πGM/(c²a(1 − e²)) with a relative gap first order in GM/(c²a)', () => {
    const a = advance(0.002);
    const b = advance(0.001);
    const ra = Math.abs(a.measured / a.first - 1);
    const rb = Math.abs(b.measured / b.first - 1);
    expect(Math.abs(Math.log2(ra / rb) - 1)).toBeLessThan(0.2);
    // the claim's case: the gap is under two thirds of its tolerance of 3e-4 rad
    expect(Math.abs(b.measured - b.first)).toBeLessThan(2e-4);
  });
});

describe('particles: Rutherford scattering', () => {
  it('every impact parameter leaves on the hyperbola, θ = 2 atan(κ/(v₀²b))', () => {
    for (const b of [0.01, 0.3, 1, 3, 10, 30]) {
      expect(Math.abs(deflection(1, 1, b, 1e4, 0.02).angle - 2 * Math.atan(1 / b)), `b ${b}`).toBeLessThan(1e-6);
    }
    // a different strength and speed: only κ/v₀² matters
    expect(Math.abs(deflection(4, 2, 1, 1e4, 0.02).angle - 2 * Math.atan(1))).toBeLessThan(1e-6);
  });

  it('the special functions match published values', () => {
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(gammaP(1, 2)).toBeCloseTo(1 - Math.exp(-2), 13);
    // χ² percentage points (Abramowitz and Stegun, table 26.8)
    expect(chiSquareQuantile(0.95, 1)).toBeCloseTo(3.841, 3);
    expect(chiSquareQuantile(0.95, 9)).toBeCloseTo(16.919, 3);
    expect(chiSquareQuantile(0.999, 9)).toBeCloseTo(27.877, 3);
  });

  it('on a named seed set the χ² of the counts exceeds its 95 % point about as often as it should', () => {
    // twenty seeds, disjoint from the claim's 4242: under the law each exceeds with probability 5 %,
    // so more than four of twenty would happen by chance with probability 1.6 %
    const seeds = Array.from({ length: 20 }, (_, i) => 7001 + i);
    const bins = 10;
    const bmax = 10;
    const edges = Array.from({ length: bins + 1 }, (_, j) => (j === 0 ? Math.PI : 2 * Math.atan(1 / (bmax * Math.sqrt(j / bins)))));
    const q95 = chiSquareQuantile(0.95, bins - 1);
    let over = 0;
    for (const seed of seeds) {
      const rnd = mulberry32(seed);
      const counts = new Array<number>(bins).fill(0);
      const N = 400;
      for (let i = 0; i < N; i++) {
        const th = deflection(1, 1, bmax * Math.sqrt(rnd()), 1e4, 0.05).angle;
        for (let j = 0; j < bins; j++) if (th <= edges[j] && th > edges[j + 1]) { counts[j]++; break; }
      }
      const chi2 = counts.reduce((s, c) => s + ((c - N / bins) ** 2) / (N / bins), 0);
      if (chi2 > q95) over++;
    }
    expect(over).toBeLessThanOrEqual(4);
  });

  it('a wrong force law fails the same test: 1/r³ counted in Rutherford’s bins', () => {
    // the falsifier: the inverse-cube deflection, integrated the same way, gives a χ² far above the 99.9 % point
    const bins = 10;
    const bmax = 10;
    const edges = Array.from({ length: bins + 1 }, (_, j) => (j === 0 ? Math.PI : 2 * Math.atan(1 / (bmax * Math.sqrt(j / bins)))));
    const rnd = mulberry32(7101);
    const counts = new Array<number>(bins).fill(0);
    const N = 100;
    // the inverse cube's tail beyond r falls as r⁻³, so a start at 100 loses nothing measurable
    const start = 100;
    const vs = Math.sqrt(1 - 1 / (start * start));
    for (let i = 0; i < N; i++) {
      const b = bmax * Math.sqrt(rnd());
      let vx = vs;
      let vy = 0;
      runOrbit({ k: -1, n: -3, g: 0 }, -Math.sqrt(start * start - b * b), b, vs, 0,
        { h: 0.01, integrator: 'rk4', perihelia: Infinity, maxSteps: 40000, escapeR: start + 1,
          record: (_t, _x, _y, a, c) => { vx = a; vy = c; } });
      const th = Math.atan2(vy, vx);
      for (let j = 0; j < bins; j++) if (th <= edges[j] && th > edges[j + 1]) { counts[j]++; break; }
    }
    const chi2 = counts.reduce((s, c) => s + ((c - N / bins) ** 2) / (N / bins), 0);
    expect(chi2).toBeGreaterThan(chiSquareQuantile(0.999, bins - 1));
  });
});
