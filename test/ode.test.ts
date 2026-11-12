// The one integrator library (src/plates/_shared/ode/): each method's measured global order on the
// harmonic oscillator, the symplectic methods' bounded energy against explicit Euler's growth,
// Boris keeping |v| in a pure magnetic field, Crank–Nicolson keeping the norm of a unitary flow,
// and the pins: the three integrators it replaced, kept here verbatim as they were, give the
// same trajectories bit for bit through the library.
import { describe, expect, it } from 'vitest';
import {
  boris, crankNicolson, euler, leapfrog, Rk4, rk4Step, symplecticEuler, type Deriv,
} from '../src/plates/_shared/ode/ode';
import { lorenz as kernelLorenz, rk4 as kernelRk4, type V3 } from '../src/kernels/numeric/_systems';
import { lorenz as plateLorenz, rk4Lorenz } from '../src/plates/lorenz-attractor/plate';
import { derivative, rk4 as pendulumRk4, type Pendulum, type State } from '../src/plates/double-pendulum/dynamics';
import { accelerate, bodies, leapfrog as nbodyLeapfrog } from '../src/plates/n-body/gravity';

/** y'' = −y from (1, 0): the exact solution is (cos t, −sin t). */
const oscillator: Deriv = (_t, y, out) => {
  out[0] = y[1];
  out[1] = -y[0];
};
const accel = (q: Float64Array, a: Float64Array) => { a[0] = -q[0]; };

function globalError(method: 'euler' | 'symplectic' | 'leapfrog' | 'rk4', h: number, T = 2): number {
  const steps = Math.round(T / h);
  if (method === 'euler' || method === 'rk4') {
    const y = Float64Array.from([1, 0]);
    const rk = new Rk4(2);
    const scratch = new Float64Array(2);
    for (let i = 0; i < steps; i++) {
      if (method === 'euler') euler(oscillator, i * h, y, h, scratch);
      else rk.step(oscillator, i * h, y, h);
    }
    return Math.hypot(y[0] - Math.cos(T), y[1] + Math.sin(T));
  }
  const q = Float64Array.from([1]);
  const p = Float64Array.from([0]);
  const a = new Float64Array(1);
  accel(q, a);
  for (let i = 0; i < steps; i++) {
    if (method === 'symplectic') symplecticEuler(q, p, h, accel, a);
    else leapfrog(q, p, a, h, accel);
  }
  return Math.hypot(q[0] - Math.cos(T), p[0] + Math.sin(T));
}

describe('ode: order of accuracy', () => {
  for (const [method, p] of [['euler', 1], ['symplectic', 1], ['leapfrog', 2], ['rk4', 4]] as const) {
    it(`${method} converges at order ${p}: halving h divides the error by 2^p, within ±0.2 in p`, () => {
      const h = method === 'rk4' ? 0.05 : 0.01;
      const measured = Math.log2(globalError(method, h) / globalError(method, h / 2));
      expect(Math.abs(measured - p)).toBeLessThan(0.2);
    });
  }
});

describe('ode: energy over long runs', () => {
  const energyOf = (q: number, p: number) => 0.5 * (q * q + p * p);

  it('symplectic Euler and leapfrog keep the energy bounded over 10⁵ steps; explicit Euler grows', () => {
    const h = 0.05;
    const n = 100_000;
    for (const method of ['symplectic', 'leapfrog'] as const) {
      const q = Float64Array.from([1]);
      const p = Float64Array.from([0]);
      const a = new Float64Array(1);
      accel(q, a);
      let worst = 0;
      for (let i = 0; i < n; i++) {
        if (method === 'symplectic') symplecticEuler(q, p, h, accel, a);
        else leapfrog(q, p, a, h, accel);
        worst = Math.max(worst, Math.abs(energyOf(q[0], p[0]) - 0.5));
      }
      // a bounded oscillation of order h (symplectic Euler) or h² (leapfrog), no secular drift
      expect(worst, method).toBeLessThan(method === 'symplectic' ? 0.05 : 0.001);
    }
    const y = Float64Array.from([1, 0]);
    const scratch = new Float64Array(2);
    for (let i = 0; i < 10_000; i++) euler(oscillator, i * h, y, h, scratch);
    // explicit Euler multiplies the energy by (1 + h²) every step
    expect(energyOf(y[0], y[1]) / 0.5).toBeGreaterThan(Math.pow(1 + h * h, 10_000) * 0.999);
  });

  it('Boris keeps |v| exactly in a pure magnetic field and circles at the cyclotron frequency', () => {
    const x = Float64Array.from([0, 0, 0]);
    const v = Float64Array.from([1, 0, 0.3]);
    const E = Float64Array.from([0, 0, 0]);
    const B = Float64Array.from([0, 0, 2]);
    const h = 0.01;
    const speed = Math.hypot(1, 0.3);
    let worst = 0;
    for (let i = 0; i < 10_000; i++) {
      boris(x, v, h, 1, E, B);
      worst = Math.max(worst, Math.abs(Math.hypot(v[0], v[1], v[2]) / speed - 1));
    }
    expect(worst).toBeLessThan(1e-12);
    // the gyration keeps v_z and the perpendicular speed
    expect(v[2]).toBeCloseTo(0.3, 12);
  });

  it('Crank–Nicolson keeps the norm of a unitary flow and is second order', () => {
    // dψ/dt = −iHψ for the two-level H = [[0, 1], [1, 0]]: ψ(t) = (cos t, −i sin t) from (1, 0)
    const H = [[0, 1], [1, 0]];
    const run = (h: number, T = 2) => {
      const re = Float64Array.from([1, 0]);
      const im = Float64Array.from([0, 0]);
      for (let i = 0; i < Math.round(T / h); i++) crankNicolson(H, re, im, h);
      return { re, im, T };
    };
    const r = run(0.01);
    expect(Math.abs(r.re[0] ** 2 + r.im[0] ** 2 + r.re[1] ** 2 + r.im[1] ** 2 - 1)).toBeLessThan(1e-13);
    const err = (h: number) => {
      const s = run(h);
      return Math.hypot(s.re[0] - Math.cos(2), s.im[0], s.re[1], s.im[1] + Math.sin(2));
    };
    expect(Math.abs(Math.log2(err(0.02) / err(0.01)) - 2)).toBeLessThan(0.2);
  });
});

// ---- pins: the integrators the library replaced, as they were, against the library's results ----

function oldKernelRk4(f: (v: V3) => V3, v: V3, h: number): V3 {
  const add = (a: V3, b: V3, k: number): V3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
  const k1 = f(v); const k2 = f(add(v, k1, h / 2)); const k3 = f(add(v, k2, h / 2)); const k4 = f(add(v, k3, h));
  return [0, 1, 2].map((i) => v[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as V3;
}

function oldRk4Lorenz(s: V3, dt: number, sigma: number, rho: number, beta: number): V3 {
  const f = (v: V3) => plateLorenz(v, sigma, rho, beta);
  const add = (a: V3, b: V3, h: number): V3 => [a[0] + b[0] * h, a[1] + b[1] * h, a[2] + b[2] * h];
  const k1 = f(s);
  const k2 = f(add(s, k1, dt / 2));
  const k3 = f(add(s, k2, dt / 2));
  const k4 = f(add(s, k3, dt));
  return [0, 1, 2].map((i) => s[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as V3;
}

function oldPendulumRk4(s: State, k: Pendulum, dt: number): State {
  const add = (a: State, b: State, h: number): State =>
    [a[0] + b[0] * h, a[1] + b[1] * h, a[2] + b[2] * h, a[3] + b[3] * h];
  const k1 = derivative(s, k);
  const k2 = derivative(add(s, k1, dt / 2), k);
  const k3 = derivative(add(s, k2, dt / 2), k);
  const k4 = derivative(add(s, k3, dt), k);
  return [
    s[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    s[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    s[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    s[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

describe('ode: the replaced integrators give the same trajectories, bit for bit', () => {
  it('the Lorenz kernels (numeric engine) and the Lorenz plate', () => {
    let a: V3 = [1, 1, 1];
    let b: V3 = [1, 1, 1];
    let c: V3 = [1, 2, 3];
    let d: V3 = [1, 2, 3];
    for (let i = 0; i < 5000; i++) {
      a = kernelRk4(kernelLorenz, a, 0.01);
      b = oldKernelRk4(kernelLorenz, b, 0.01);
      c = rk4Lorenz(c, 0.006, 10, 28, 8 / 3);
      d = oldRk4Lorenz(d, 0.006, 10, 28, 8 / 3);
    }
    expect(a).toEqual(b);
    expect(c).toEqual(d);
  });

  it('the double pendulum', () => {
    const k: Pendulum = { m1: 1, m2: 1.3, l1: 1, l2: 0.8, g: 9.81 };
    let a: State = [2, 2.5, 0, 0];
    let b: State = [2, 2.5, 0, 0];
    for (let i = 0; i < 20_000; i++) {
      a = pendulumRk4(a, k, 0.002);
      b = oldPendulumRk4(b, k, 0.002);
    }
    expect(a).toEqual(b);
  });

  it('the n-body leapfrog', () => {
    const one = bodies(12);
    const two = bodies(12);
    for (const b of [one, two]) {
      for (let i = 0; i < b.x.length; i++) {
        b.x[i] = Math.sin(i * 1.7) * 3;
        b.v[i] = Math.cos(i * 0.9) * 0.2;
      }
      for (let i = 0; i < b.n; i++) b.m[i] = 1 + (i % 3);
      accelerate(b, 1, 0.05);
    }
    for (let s = 0; s < 2000; s++) {
      nbodyLeapfrog(one, 0.01, 1, 0.05);
      // the leapfrog as it was: kick, drift, recompute, kick
      for (let k = 0; k < two.x.length; k++) two.v[k] += 0.5 * 0.01 * two.a[k];
      for (let k = 0; k < two.x.length; k++) two.x[k] += 0.01 * two.v[k];
      accelerate(two, 1, 0.05);
      for (let k = 0; k < two.x.length; k++) two.v[k] += 0.5 * 0.01 * two.a[k];
    }
    expect(Array.from(one.x)).toEqual(Array.from(two.x));
    expect(Array.from(one.v)).toEqual(Array.from(two.v));
  });

  it('rk4Step on plain arrays is the same arithmetic as Rk4', () => {
    const f: Deriv = (_t, y, out) => { out[0] = y[1]; out[1] = -Math.sin(y[0]); };
    const y = Float64Array.from([1, 0]);
    const z = [1, 0];
    const rk = new Rk4(2);
    for (let i = 0; i < 1000; i++) {
      rk.step(f, 0, y, 0.01);
      const n = rk4Step(f, 0, Float64Array.from(z), 0.01);
      z[0] = n[0];
      z[1] = n[1];
    }
    expect(Array.from(y)).toEqual(z);
  });
});
