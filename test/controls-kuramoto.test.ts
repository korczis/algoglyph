// kuramoto (wave 6). Defect D4: its hand-written classical Runge–Kutta step (five arrays
// allocated per step) moves onto the one integrator library's Rk4 (src/plates/_shared/ode), the
// same arithmetic in the same order, so every run is the same bit for bit; the old step is kept
// here verbatim and run beside the library in this run (no hash recorded on one CPU).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engines/signal/input';
import { Meter } from '../src/engines/signal/trace';
import { Rk4 } from '../src/plates/_shared/ode/ode';
import * as kuramoto from '../src/kernels/signal/kuramoto';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

// ---- the step as it was before the move, verbatim (src/kernels/signal/kuramoto.ts) ----
function oldDeriv(theta: Float64Array, omega: Float64Array, K: number, out: Float64Array, meter?: Meter): void {
  const { r, psi } = kuramoto.order(theta);
  for (let i = 0; i < theta.length; i++) out[i] = omega[i] + K * r * Math.sin(psi - theta[i]);
  meter?.add(kuramoto.EVAL, theta.length);
}

function oldRk4(theta: Float64Array, omega: Float64Array, K: number, dt = 0.02, meter?: Meter): void {
  const n = theta.length;
  const k1 = new Float64Array(n); const k2 = new Float64Array(n); const k3 = new Float64Array(n); const k4 = new Float64Array(n);
  const tmp = new Float64Array(n);
  oldDeriv(theta, omega, K, k1, meter);
  for (let i = 0; i < n; i++) tmp[i] = theta[i] + 0.5 * dt * k1[i];
  oldDeriv(tmp, omega, K, k2, meter);
  for (let i = 0; i < n; i++) tmp[i] = theta[i] + 0.5 * dt * k2[i];
  oldDeriv(tmp, omega, K, k3, meter);
  for (let i = 0; i < n; i++) tmp[i] = theta[i] + dt * k3[i];
  oldDeriv(tmp, omega, K, k4, meter);
  for (let i = 0; i < n; i++) theta[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

function oldSimulate(n: number, K: number, width: number, steps: number, seed: number, dist = 'lorentz', meter?: Meter): { r: number[]; mean: number } {
  const rnd = mulberry32(seed);
  const { omega } = kuramoto.frequencies(n, dist, width, rnd);
  const theta = Float64Array.from({ length: n }, () => 2 * Math.PI * rnd());
  const r: number[] = [];
  for (let s = 0; s < steps; s++) { oldRk4(theta, omega, K, 0.02, meter); r.push(kuramoto.order(theta).r); }
  const tail = r.slice(steps >> 1);
  return { r, mean: tail.reduce((a, b) => a + b, 0) / tail.length };
}

describe('kuramoto: the Runge–Kutta step comes from src/plates/_shared/ode', () => {
  it('one library step is the old inline step, bit for bit, with the same evaluations counted', () => {
    for (const [n, K, dist, seed] of [[192, 2, 'lorentz', 4242], [64, 4, 'gauss', 7], [512, 0.5, 'lorentz', 1]] as const) {
      const rnd = mulberry32(seed);
      const { omega } = kuramoto.frequencies(n, dist, 0.5, rnd);
      const a = Float64Array.from({ length: n }, () => 2 * Math.PI * rnd());
      const b = Float64Array.from(a);
      const ma = new Meter(); const mb = new Meter();
      const rk = new Rk4(n);
      const f = kuramoto.derivOf(omega, K, ma);
      for (let s = 0; s < 500; s++) {
        rk.step(f, 0, a, 0.02);
        oldRk4(b, omega, K, 0.02, mb);
      }
      expect(Array.from(a)).toEqual(Array.from(b));
      expect(ma.snapshot()).toEqual(mb.snapshot());
    }
  });

  it('simulate() gives the old series, bit for bit', () => {
    for (const [n, K, dist, seed] of [[256, 4, 'lorentz', 7], [128, 1.5, 'gauss', 3]] as const) {
      expect(kuramoto.simulate(n, K, 0.5, 600, seed, dist)).toEqual(oldSimulate(n, K, 0.5, 600, seed, dist));
    }
  });

  it('the kernel carries no Runge–Kutta step of its own', () => {
    const src = readFileSync('src/kernels/signal/kuramoto.ts', 'utf8');
    expect(src).toMatch(/import \{ Rk4[^}]*\} from '\.\.\/\.\.\/plates\/_shared\/ode\/ode'/);
    expect(src).not.toMatch(/k1\[i\] \+ 2 \* k2\[i\]/);
  });
});
