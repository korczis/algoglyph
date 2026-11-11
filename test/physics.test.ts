import { describe, expect, it } from 'vitest';
import { rk4Lorenz, lorenz } from '../src/plates/lorenz-attractor/plate';
import { accelerate, bodies, energy as nEnergy, leapfrog, momentum } from '../src/plates/n-body/gravity';
import { energy, rk4, type Pendulum, type State } from '../src/plates/double-pendulum/dynamics';

describe('double pendulum', () => {
  const k: Pendulum = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 };

  it('RK4 at the default step keeps energy within 1e-6 relative over 10 s', () => {
    let s: State = [2.1, 2.6, 0, 0];
    const e0 = energy(s, k);
    for (let i = 0; i < 5000; i++) s = rk4(s, k, 0.002);
    expect(Math.abs((energy(s, k) - e0) / e0)).toBeLessThan(1e-6);
  });

  it('a pendulum at rest hanging down stays there', () => {
    let s: State = [0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) s = rk4(s, k, 0.002);
    expect(s.every((v) => Math.abs(v) < 1e-12)).toBe(true);
  });

  it('is chaotic: 1e-6 rad apart, the lower arms disagree by over 0.1 rad within 20 s', () => {
    let a: State = [2, 2.4, 0, 0];
    let b: State = [2, 2.4 + 1e-6, 0, 0];
    let apart = 0;
    for (let i = 0; i < 10000 && apart < 0.1; i++) {
      a = rk4(a, k, 0.002);
      b = rk4(b, k, 0.002);
      apart = Math.abs(Math.atan2(Math.sin(a[1] - b[1]), Math.cos(a[1] - b[1])));
    }
    expect(apart).toBeGreaterThan(0.1);
  });
});

describe('lorenz', () => {
  it('the wing centres are fixed points', () => {
    const [sigma, rho, beta] = [10, 28, 8 / 3];
    const c = Math.sqrt(beta * (rho - 1));
    const d = lorenz([c, c, rho - 1], sigma, rho, beta);
    expect(Math.hypot(...d)).toBeLessThan(1e-12);
    const s = rk4Lorenz([c, c, rho - 1], 0.006, sigma, rho, beta);
    expect(Math.hypot(s[0] - c, s[1] - c, s[2] - (rho - 1))).toBeLessThan(1e-12);
  });

  it('orbits stay on the bounded attractor', () => {
    let s: [number, number, number] = [1, 1, 20];
    for (let i = 0; i < 20000; i++) {
      s = rk4Lorenz(s, 0.006, 10, 28, 8 / 3);
      expect(Math.abs(s[0])).toBeLessThan(30);
      expect(s[2]).toBeLessThan(60);
    }
  });
});

describe('n-body leapfrog', () => {
  const G = 1;
  const eps = 0;

  it('a circular two-body orbit conserves energy and momentum', () => {
    const b = bodies(2);
    b.m.set([1, 1]);
    // separation 1, each body on a circle of radius 0.5 about the centre of mass
    b.x.set([-0.5, 0, 0, 0.5, 0, 0]);
    const v = Math.sqrt(G * 1 / (4 * 0.5));
    b.v.set([0, -v, 0, 0, v, 0]);
    accelerate(b, G, eps);
    const e0 = nEnergy(b, G, eps);
    for (let i = 0; i < 20000; i++) leapfrog(b, 0.001, G, eps);
    expect(Math.abs((nEnergy(b, G, eps) - e0) / e0)).toBeLessThan(1e-6);
    expect(momentum(b)).toBeLessThan(1e-12);
    const r = Math.hypot(b.x[3] - b.x[0], b.x[4] - b.x[1], b.x[5] - b.x[2]);
    expect(r).toBeCloseTo(1, 5);
  });
});
