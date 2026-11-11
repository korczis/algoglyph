// Dynamical systems shared by the time-series kernels: the Lorenz flow (RK4), the logistic and
// Hénon maps, and seeded noise. Each returns plain arrays; nothing here draws.
import { gaussian, mulberry32 } from '../../core/random';

export type V3 = [number, number, number];

export const LORENZ = { sigma: 10, rho: 28, beta: 8 / 3 };

export function lorenz([x, y, z]: V3): V3 {
  return [LORENZ.sigma * (y - x), x * (LORENZ.rho - z) - y, x * y - LORENZ.beta * z];
}

/** One classical Runge–Kutta step of dv/dt = f(v). */
export function rk4(f: (v: V3) => V3, v: V3, h: number): V3 {
  const add = (a: V3, b: V3, k: number): V3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
  const k1 = f(v); const k2 = f(add(v, k1, h / 2)); const k3 = f(add(v, k2, h / 2)); const k4 = f(add(v, k3, h));
  return [0, 1, 2].map((i) => v[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as V3;
}

/** n samples of the Lorenz flow every `every` RK4 steps of h, after a transient. */
export function lorenzOrbit(seed: number, n: number, h = 0.01, every = 2, transient = 2000): V3[] {
  const rnd = mulberry32(seed);
  let v: V3 = [1 + rnd(), 1 + rnd(), 20 + rnd()];
  for (let i = 0; i < transient; i++) v = rk4(lorenz, v, h);
  const out: V3[] = [];
  for (let i = 0; i < n * every; i++) { v = rk4(lorenz, v, h); if (i % every === every - 1) out.push(v); }
  return out;
}

export const logistic = (r: number, x: number) => r * x * (1 - x);

export function logisticSeries(r: number, n: number, seed: number, transient = 500): number[] {
  let x = 0.1 + 0.8 * mulberry32(seed)();
  for (let i = 0; i < transient; i++) x = logistic(r, x);
  const out: number[] = [];
  for (let i = 0; i < n; i++) { x = logistic(r, x); out.push(x); }
  return out;
}

export const HENON = { a: 1.4, b: 0.3 };
export const henon = ([x, y]: [number, number]): [number, number] => [1 - HENON.a * x * x + y, HENON.b * x];

export function noise(n: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => gaussian(rnd));
}
