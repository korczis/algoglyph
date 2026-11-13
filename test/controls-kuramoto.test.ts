// kuramoto (wave 6). Defect D4: its hand-written classical Runge–Kutta step (five arrays
// allocated per step) moves onto the one integrator library's Rk4 (src/plates/_shared/ode), the
// same arithmetic in the same order, so every run is the same bit for bit; the old step is kept
// here verbatim and run beside the library in this run (no hash recorded on one CPU). Defect D5:
// the readout "Locked to the mean frequency" counted the oscillators whose effective frequency
// is within 0.02 of the mean effective frequency, and now says so. Then the width γ of the natural
// frequencies, fixed at 0.5, becomes a control.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engines/signal/input';
import { Meter } from '../src/engines/signal/trace';
import { Rk4 } from '../src/plates/_shared/ode/ode';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import * as kuramoto from '../src/kernels/signal/kuramoto';
import { read, type Claim } from './support/claims';
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

const ID = 'kuramoto';
const probe = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
async function at(readout: string, params: Params = {}): Promise<{ value?: number; reason?: string }> {
  return read(ID, probe(readout, params));
}
const NEAR = 'Effective frequency within 0.02 of the mean (measured)';

describe('kuramoto: the count of oscillators near the mean frequency says what it counts', () => {
  it('publishes the count under its own label, and no longer as "Locked"', async () => {
    const now = await at(NEAR, { K: 4 });
    expect(now.reason).toBeUndefined();
    expect(now.value).toBeGreaterThan(0);
    expect((await at('Locked to the mean frequency (measured)')).reason).toMatch(/publishes no readout/);
  });
});

// The oracle for the Lorentzian quantiles ω_i = γ tan(π((i + ½)/N − ½)): an oscillator locks when
// |ω_i| ≤ K·r, and the locked ones give r = (1/N) Σ √(1 − (ω_i/Kr)²), the drifting ones nothing
// on average (their stationary density is symmetric under θ → π − θ about ψ). Its fixed point
// is the finite-N value of r, which for N → ∞ is √(1 − K_c/K) with K_c = 2γ.
const quantiles = (n: number, g: number) => Array.from({ length: n }, (_, i) => g * Math.tan(Math.PI * ((i + 0.5) / n - 0.5)));
function finiteN(n: number, g: number, K: number): { r: number; locked: number } {
  const w = quantiles(n, g);
  let r = Math.sqrt(1 - (2 * g) / K);
  for (let it = 0; it < 500; it++) {
    const kr = K * r;
    r = w.reduce((a, x) => a + (Math.abs(x) <= kr ? Math.sqrt(1 - (x / kr) ** 2) : 0), 0) / n;
  }
  return { r, locked: w.filter((x) => Math.abs(x) <= K * r).length };
}
const lockedByTheory = (n: number, g: number, K: number) =>
  quantiles(n, g).filter((x) => Math.abs(x) <= K * Math.sqrt(1 - (2 * g) / K)).length;

// The margin of r̄ (the second half's mean of r) against √(1 − K_c/K), derived from the
// estimator's distribution: the frequencies are the Lorentzian's quantiles, not draws, so the seed
// draws only the initial phases; over the named seed set 1 … 200, disjoint from the claims' seed
// 4242, the deviation r̄ − √(1 − K_c/K) has the bias and sd below, measured once over all 200
// seeds (too slow to repeat each run: over the 120 s limit on a hosted x86 runner), and the
// tolerance is 4 sd + |bias| rounded up at the display's third decimal, plus 0.001 for the two
// printed numbers' rounding. Each run re-measures on the first 30 of those seeds: the sd within
// 40% of the table's (an sd from 30 draws has a relative error of about 1/√58, 13%) and the bias
// within four standard errors of that subsample's mean.
const CLAIM_SEED = 4242;
const SPREAD_SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
/** γ, K, measured bias and sd of r̄ − √(1 − K_c/K) over SPREAD_SEEDS, and the tolerance. */
const SPREAD: [number, number, number, number, number][] = [
  [0.5, 2, 0.00048, 0.00064, 0.005], // 4 sd + bias = 0.0030 -> 0.004 + 0.001
  [0.5, 4, 0.00004, 0.00030, 0.003], // 0.0012 -> 0.002 + 0.001
  [2, 6, 0.00124, 0.00066, 0.005], // 0.0039 -> 0.004 + 0.001
  [1, 4, 0.00059, 0.00043, 0.004], // 0.0023 -> 0.003 + 0.001
  [0.25, 1.5, 0.00060, 0.00041, 0.004], // 0.0023 -> 0.003 + 0.001
];
const tolerance = (g: number, K: number) => SPREAD.find(([a, b]) => a === g && b === K)![4];

describe('kuramoto: the spread of r̄ against the theory, on seeds disjoint from the claims’', () => {
  it('the Lorentzian frequencies are quantiles: they draw nothing and do not depend on the seed', () => {
    const a = mulberry32(1); const b = mulberry32(1);
    const one = kuramoto.frequencies(192, 'lorentz', 0.5, a).omega;
    expect(Array.from(kuramoto.frequencies(192, 'lorentz', 0.5, mulberry32(99)).omega)).toEqual(Array.from(one));
    expect(a()).toBe(b());
  });

  it('each tolerance is the table’s 4 sd + |bias| rounded up, plus the rounding', () => {
    expect(SPREAD_SEEDS).not.toContain(CLAIM_SEED);
    for (const [g, K, bias, sd, tol] of SPREAD) {
      expect(tol, `γ ${g}, K ${K}`).toBeCloseTo(Math.ceil((4 * sd + Math.abs(bias)) * 1000) / 1000 + 0.001, 9);
    }
  });

  it('re-measures the table’s bias and sd on the first 30 spread seeds', () => {
    const seeds = SPREAD_SEEDS.slice(0, 30);
    for (const [g, K, bias, sd] of SPREAD) {
      const th = Math.sqrt(1 - (2 * g) / K);
      const d = seeds.map((s) => kuramoto.simulate(192, K, g, 2500, s).mean - th);
      const m = d.reduce((x, y) => x + y, 0) / d.length;
      const v = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / (d.length - 1));
      expect(v / sd, `γ ${g}, K ${K}: sd ${v}`).toBeGreaterThan(0.6);
      expect(v / sd, `γ ${g}, K ${K}: sd ${v}`).toBeLessThan(1.4);
      expect(Math.abs(m - bias), `γ ${g}, K ${K}: bias ${m}`).toBeLessThanOrEqual((4 * sd) / Math.sqrt(seeds.length));
    }
  });

  it('simulate() is the plate’s readout run: the same r̄ at the claims’ seed', async () => {
    for (const [g, K] of [[0.5, 2], [2, 6]]) {
      const r = (await at('r averaged over the second half so far', { gamma: g, K })).value!;
      expect(Math.abs(r - kuramoto.simulate(192, K, g, 2500, CLAIM_SEED).mean)).toBeLessThanOrEqual(0.0005);
    }
  });
});

const KEY = 'gamma';
describe('kuramoto: gamma, "Frequency width γ"', () => {
  it('is a range 0.1 … 2 by 0.05, 0.5 (the old constant) by default, and the select names it', () => {
    const d = kuramoto.kernel.params?.find((x) => x.key === KEY);
    expect(d).toMatchObject({ kind: 'range', label: 'Frequency width γ', min: 0.1, max: 2, step: 0.05, value: 0.5 });
    const dist = kuramoto.kernel.params?.find((x) => x.key === 'dist');
    expect(dist?.kind === 'select' ? dist.options.map((o) => o.label) : []).toEqual(['Lorentzian, half-width γ', 'Gaussian, σ = γ']);
    // K's range must reach above K_c = 2γ at the widest γ, or the plate cannot show locking there
    const K = kuramoto.kernel.params?.find((x) => x.key === 'K');
    expect(K?.kind === 'range' && d?.kind === 'range' && K.max > 2 * d.max).toBe(true);
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.1, 1, 2]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('the finite-N fixed point is within 2.5e-4 of √(1 − K_c/K) at the default width, 5e-4 elsewhere', () => {
    for (const [g, K] of [[0.5, 2], [0.5, 4], [1, 4], [2, 6], [0.25, 1.5]]) {
      const f = finiteN(192, g, K);
      const tol = g === 0.5 ? 2.5e-4 : 5e-4;
      expect(Math.abs(f.r - Math.sqrt(1 - (2 * g) / K)), `γ ${g}, K ${K}`).toBeLessThan(tol);
      expect(f.locked, `γ ${g}, K ${K}`).toBe(lockedByTheory(192, g, K));
    }
    expect(lockedByTheory(192, 0.5, 4)).toBe(174);
    expect(lockedByTheory(192, 1, 4)).toBe(150);
    expect(lockedByTheory(192, 2, 6)).toBe(128);
  });

  it('drives the readouts: K_c follows 2γ, and the measured r and count follow the oracle', async () => {
    for (const [g, K] of [[1, 4], [2, 6], [0.25, 1.5]]) {
      const kc = await at('Coupling K / critical K_c', { [KEY]: g, K });
      expect(kc.reason).toBeUndefined();
      const theory = (await at('Theory for N → ∞, √(1 − K_c/K)', { [KEY]: g, K })).value!;
      expect(Math.abs(theory - Math.sqrt(1 - (2 * g) / K))).toBeLessThanOrEqual(0.0005);
      const r = (await at('r averaged over the second half so far', { [KEY]: g, K })).value!;
      expect(Math.abs(r - theory), `γ ${g}, K ${K}`).toBeLessThanOrEqual(tolerance(g, K));
      expect((await at(NEAR, { [KEY]: g, K })).value, `γ ${g}, K ${K}`).toBe(lockedByTheory(192, g, K));
    }
  });
});
