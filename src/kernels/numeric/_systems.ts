// Dynamical systems shared by the time-series kernels: the Lorenz flow (RK4), the logistic and
// Hénon maps, and seeded noise. Each returns plain arrays; nothing here draws.
import { Rk4 } from '../../plates/_shared/ode/ode';
import { drain } from '../../engines/numeric/trace';
import { gaussian, mulberry32 } from '../../core/random';

export type V3 = [number, number, number];

export const LORENZ = { sigma: 10, rho: 28, beta: 8 / 3 };

export function lorenz([x, y, z]: V3): V3 {
  return [LORENZ.sigma * (y - x), x * (LORENZ.rho - z) - y, x * y - LORENZ.beta * z];
}

const stepper = new Rk4(3);
const state = new Float64Array(3);

/** One classical Runge–Kutta step of dv/dt = f(v): the shared library's (src/plates/_shared/ode). */
export function rk4(f: (v: V3) => V3, v: V3, h: number): V3 {
  state[0] = v[0];
  state[1] = v[1];
  state[2] = v[2];
  stepper.step((_t, y, out) => {
    const d = f([y[0], y[1], y[2]]);
    out[0] = d[0];
    out[1] = d[1];
    out[2] = d[2];
  }, 0, state, h);
  return [state[0], state[1], state[2]];
}

/** n samples of the Lorenz flow every `every` RK4 steps of h, after a transient. */
export function lorenzOrbit(seed: number, n: number, h = 0.01, every = 2, transient = 2000): V3[] {
  return drain(lorenzOrbitSteps(seed, n, h, every, transient));
}

/** lorenzOrbit(), resumable: it yields every 1000 integration steps. */
export function* lorenzOrbitSteps(seed: number, n: number, h = 0.01, every = 2, transient = 2000): Generator<void, V3[], void> {
  const rnd = mulberry32(seed);
  let v: V3 = [1 + rnd(), 1 + rnd(), 20 + rnd()];
  for (let i = 0; i < transient; i++) { v = rk4(lorenz, v, h); if (i % 1000 === 999) yield; }
  const out: V3[] = [];
  for (let i = 0; i < n * every; i++) {
    v = rk4(lorenz, v, h);
    if (i % every === every - 1) out.push(v);
    if (i % 1000 === 999) yield;
  }
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
