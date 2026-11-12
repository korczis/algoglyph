// Direct-summation softened gravity with a kick-drift-kick leapfrog (symplectic, second order).
// Positions, velocities and accelerations are packed xyz arrays; m holds the masses.
import { leapfrog as odeLeapfrog } from '../_shared/ode/ode';

export interface Bodies {
  n: number;
  x: Float64Array;
  v: Float64Array;
  a: Float64Array;
  m: Float64Array;
}

export function bodies(n: number): Bodies {
  return {
    n,
    x: new Float64Array(n * 3),
    v: new Float64Array(n * 3),
    a: new Float64Array(n * 3),
    m: new Float64Array(n),
  };
}

export function accelerate(b: Bodies, G: number, eps: number): void {
  const { n, x, a, m } = b;
  a.fill(0);
  const e2 = eps * eps;
  for (let i = 0; i < n; i++) {
    const xi = x[i * 3];
    const yi = x[i * 3 + 1];
    const zi = x[i * 3 + 2];
    for (let j = i + 1; j < n; j++) {
      const dx = x[j * 3] - xi;
      const dy = x[j * 3 + 1] - yi;
      const dz = x[j * 3 + 2] - zi;
      const r2 = dx * dx + dy * dy + dz * dz + e2;
      const inv = G / (r2 * Math.sqrt(r2));
      const fi = inv * m[j];
      const fj = inv * m[i];
      a[i * 3] += dx * fi;
      a[i * 3 + 1] += dy * fi;
      a[i * 3 + 2] += dz * fi;
      a[j * 3] -= dx * fj;
      a[j * 3 + 1] -= dy * fj;
      a[j * 3 + 2] -= dz * fj;
    }
  }
}

/** One leapfrog step (src/plates/_shared/ode); `a` must hold the accelerations of the current positions. */
export function leapfrog(b: Bodies, dt: number, G: number, eps: number): void {
  odeLeapfrog(b.x, b.v, b.a, dt, () => accelerate(b, G, eps));
}

export function energy(b: Bodies, G: number, eps: number): number {
  const { n, x, v, m } = b;
  let kinetic = 0;
  let potential = 0;
  const e2 = eps * eps;
  for (let i = 0; i < n; i++) {
    kinetic += 0.5 * m[i] * (v[i * 3] ** 2 + v[i * 3 + 1] ** 2 + v[i * 3 + 2] ** 2);
    for (let j = i + 1; j < n; j++) {
      const dx = x[j * 3] - x[i * 3];
      const dy = x[j * 3 + 1] - x[i * 3 + 1];
      const dz = x[j * 3 + 2] - x[i * 3 + 2];
      potential -= (G * m[i] * m[j]) / Math.sqrt(dx * dx + dy * dy + dz * dz + e2);
    }
  }
  return kinetic + potential;
}

export function momentum(b: Bodies): number {
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < b.n; i++) {
    px += b.m[i] * b.v[i * 3];
    py += b.m[i] * b.v[i * 3 + 1];
    pz += b.m[i] * b.v[i * 3 + 2];
  }
  return Math.hypot(px, py, pz);
}
