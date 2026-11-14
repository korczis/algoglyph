// lorenz-attractor (wave 6). A new readout: the largest distance from any tracer to the nearer of
// the fixed points C± = (±√(β(ρ−1)), ±√(β(ρ−1)), ρ − 1). Below the Hopf value ρ_H =
// σ(σ + β + 3)/(σ − β − 1) (24.755 at σ 10, β 2.67) both are stable, and near them the flow is
// its linearisation: the distance decays as e^(μt), μ the real part of the slow complex pair of
// eigenvalues of the Jacobian at C±, the roots of λ³ + (σ + β + 1)λ² + β(σ + ρ)λ + 2σβ(ρ − 1).
// The swarm spread could not be claimed at ρ 20: which of C± each tracer ends at depends on the
// seed; the distance to the nearer one does not.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { rk4Lorenz } from '../src/plates/lorenz-attractor/plate';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'lorenz-attractor';
const NEAR = 'largest distance to the nearer of C±';
const SIGMA = 10;
const BETA = 2.67;
const DT = 0.006;

/** A claim that reads `readout` once the run has settled, judging nothing. */
const probe = (readout: string, params: Params, seed?: number): Claim => ({
  id: 'probe', statement: 'a control test reading', readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params, ...(seed ? { seed } : {}) },
});

type V3 = [number, number, number];
const fixed = (rho: number) => Math.sqrt(BETA * (rho - 1));
function near(p: V3, rho: number): number {
  const c = fixed(rho);
  return Math.min(Math.hypot(p[0] - c, p[1] - c, p[2] - rho + 1),
    Math.hypot(p[0] + c, p[1] + c, p[2] - rho + 1));
}
const shown = (d: number) => (d < 0.01 ? d.toExponential(2) : d.toFixed(2));

/** The tracers of `seed` as the plate starts them: each coordinate within ±0.5e-4 of (1, 1, 20). */
function starts(seed: number, n = 16): V3[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, (): V3 => [
    1 + (rnd() - 0.5) * 1e-4, 1 + (rnd() - 0.5) * 1e-4, 20 + (rnd() - 0.5) * 1e-4,
  ]);
}

/** μ: the real part of the complex pair at C± (the real root, found by bisection, deflated). */
function decayRate(rho: number): number {
  const a2 = SIGMA + BETA + 1;
  const a1 = BETA * (SIGMA + rho);
  const a0 = 2 * SIGMA * BETA * (rho - 1);
  const f = (x: number) => ((x + a2) * x + a1) * x + a0;
  let lo = -100;
  let hi = 0;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m;
    else lo = m;
  }
  return -(a2 + (lo + hi) / 2) / 2;
}

/** An independent classical RK4 (not the plate's library), for the envelope's amplitude. */
function step(p: V3, h: number, rho: number): V3 {
  const f = ([x, y, z]: V3): V3 => [SIGMA * (y - x), x * (rho - z) - y, x * y - BETA * z];
  const add = (a: V3, k: V3, s: number): V3 => [a[0] + s * k[0], a[1] + s * k[1], a[2] + s * k[2]];
  const k1 = f(p);
  const k2 = f(add(p, k1, h / 2));
  const k3 = f(add(p, k2, h / 2));
  const k4 = f(add(p, k3, h));
  return [0, 1, 2].map((i) => p[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as V3;
}

/**
 * The linearisation's bound A·e^(μT): A = the largest D(t)·e^(−μt) over t from 20 to T, the
 * envelope of the slow mode's amplitude, from the box's centre (1, 1, 20) at a quarter of the
 * plate's step. Below the homoclinic value (about 13.9) no orbit lingers: the start spirals
 * straight in, the same for every seed's 1e-4 box.
 */
function linearBound(rho: number, T: number): { mu: number; A: number; bound: number } {
  const mu = decayRate(rho);
  const h = DT / 4;
  let p: V3 = [1, 1, 20];
  let A = 0;
  for (let n = 1; n * h <= T + 1e-9; n++) {
    p = step(p, h, rho);
    if (n * h >= 20) A = Math.max(A, near(p, rho) / Math.exp(mu * n * h));
  }
  return { mu, A, bound: A * Math.exp(mu * T) };
}

describe('lorenz-attractor: the largest distance to the nearer fixed point C±', () => {
  it('is published, and reads the plate\'s own tracers exactly (replayed with its step)', async () => {
    for (const [rho, runs] of [[28, 1], [12, 10]] as const) {
      let heads = starts(4242);
      for (let s = 0; s < 100 * runs; s++) heads = heads.map((h) => rk4Lorenz(h, DT, SIGMA, rho, BETA));
      const r = await read(ID, probe(NEAR, { rho, runs }));
      expect(r.reason).toBeUndefined();
      expect(r.text).toBe(shown(Math.max(...heads.map((h) => near(h, rho)))));
    }
  });

  it('the oracle: μ changes sign at ρ_H = 24.755; at ρ 12 μ = −0.4905, and the bounds', () => {
    const rhoH = (SIGMA * (SIGMA + BETA + 3)) / (SIGMA - BETA - 1);
    expect(rhoH).toBeCloseTo(24.755, 3);
    expect(decayRate(rhoH - 0.01)).toBeLessThan(0);
    expect(decayRate(rhoH + 0.01)).toBeGreaterThan(0);
    expect(decayRate(12)).toBeCloseTo(-0.49050, 5);
    expect(decayRate(20)).toBeCloseTo(-0.15541, 5);
    const at54 = linearBound(12, 54);
    expect(at54.A).toBeCloseTo(15.158, 2);
    expect(at54.bound).toBeLessThan(4.8e-11);
    expect(linearBound(12, 36).bound).toBeLessThan(3.3e-7);
  });

  it('drives the readout: below the linear bound at ρ 12, at every seed of a named set', async () => {
    // the claims' seed 4242 and the seeds 1 … 4: below the homoclinic value nothing depends on
    // it; a short trail (it changes the picture, never a tracer) keeps the runs quick
    for (const [runs, T] of [[90, 54], [60, 36]] as const) {
      const { bound } = linearBound(12, T);
      for (const seed of [4242, 1, 2, 3, 4]) {
        const r = await read(ID, probe(NEAR, { rho: 12, runs, trail: 100 }, seed));
        expect(r.reason).toBeUndefined();
        expect(r.value!, `ρ 12, time ${T}, seed ${seed}`).toBeLessThan(bound);
        // and within 30 % of it: the slow mode's phase, not a slack bound, sets the reading
        expect(r.value!, `ρ 12, time ${T}, seed ${seed}`).toBeGreaterThan(0.7 * bound);
      }
    }
  });
});

describe('lorenz-attractor: at ρ 20 the tracers linger, then settle on C± to rounding', () => {
  // Between the homoclinic value and 24.06 the orbits wander chaotically before they fall in:
  // over the seeds 1 … 60 (960 tracers, disjoint from the claims' 4242) the last time a tracer
  // is farther than 2 from C± is at most EXIT (measured); 0.2 % are still out at 100, so the
  // tail falls about e-fold in 12 time units.
  const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
  const EXIT = 106;

  it('every tracer of the named seed set has left the transient by time 106', () => {
    expect(SEEDS).not.toContain(4242);
    let last = 0;
    let late = 0;
    for (const seed of SEEDS) {
      let heads = starts(seed);
      const out = new Array(16).fill(0);
      for (let n = 1; n <= 200 / DT; n++) {
        heads = heads.map((h) => rk4Lorenz(h, DT, SIGMA, 20, BETA));
        heads.forEach((h, i) => { if (near(h, 20) > 2) out[i] = n * DT; });
      }
      last = Math.max(last, ...out);
      late += out.filter((t) => t > 100).length;
    }
    expect(last).toBeLessThanOrEqual(EXIT);
    expect(late / (16 * SEEDS.length)).toBeLessThan(0.005);
  });

  it('at time 600 the distance is the rounding floor, below 1e-12', async () => {
    // from ≤ 2 at 106, e^(μ·494) = 4e-34: what is left is float64's rounding, where a step stops
    // moving a coordinate: |dt·f| < ulp(19)/2 puts the point within 3.55e-15 / (2·dt·σ_min(J))
    // = 4.4e-14 of C±, σ_min(J) = 6.67 at ρ 20; 1e-12 is over twenty times that
    expect(Math.exp(decayRate(20) * (600 - EXIT))).toBeLessThan(1e-30);
    const r = await read(ID, probe(NEAR, { rho: 20, runs: 1000, speed: 12, trail: 100 }));
    expect(r.reason).toBeUndefined();
    expect(r.value!).toBeLessThan(1e-12);
  });
});
