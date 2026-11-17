// Feynman slice 28: ripple-tank's leapfrog stencil hoisted into src/plates/_shared/wave2d/leapfrog.ts.
// The tank must step exactly as before, within one run: its advance as it was on main before the
// hoist (copied below verbatim, with the stencil inline) and the advance that calls the shared
// stencil run side by side from the same tank, and every stored float of the field, the previous
// field and the intensity is compared bit for bit after every step, for every experiment, with and
// without flushing. A planted change in the copied stencil (a Laplacian weight of 3.999 for 4)
// must fail the same comparison, so it can see a change in the stencil.
import { describe, expect, it } from 'vitest';
import { flush } from '../src/core/budget';
import { advance, drop, omega, planeDriven, tank, type Experiment, type Tank } from '../src/plates/ripple-tank/wave';
import { leapfrog1d, leapfrogGroupVelocity, leapfrogOmega, leapfrogPhaseVelocity } from '../src/plates/_shared/wave2d/leapfrog';

/** ripple-tank's advance before the hoist. */
function oldAdvance(t: Tank, lambda: number): void {
  const { w, h, c2, damp, wall, intensity } = t;
  const f = t.flush;
  const drive = Math.sin(omega(lambda, c2) * t.step);
  let u = t.u;
  if (planeDriven(t.experiment)) {
    for (let y = 1; y < h - 1; y++) u[y * w + 2] = drive;
  }
  for (const [sx, sy] of t.sources) u[sy * w + sx] = 1.4 * drive;
  const prev = t.prev;
  const nxt = t.nxt;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (wall[i]) {
        nxt[i] = 0;
        continue;
      }
      const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 4 * u[i];
      const v = (2 * u[i] - prev[i] + c2 * lap) * damp[i];
      nxt[i] = f ? flush(v) : v;
    }
  }
  t.prev = u;
  t.u = nxt;
  t.nxt = prev;
  u = t.u;
  for (let i = 0; i < u.length; i++) {
    const e = intensity[i] * 0.992 + u[i] * u[i] * 0.008;
    intensity[i] = f ? flush(e) : e;
  }
  t.step++;
}

/** The same, with a planted change in the stencil. */
function plantedAdvance(t: Tank, lambda: number): void {
  const { w, h, c2, damp, wall, intensity } = t;
  const f = t.flush;
  const drive = Math.sin(omega(lambda, c2) * t.step);
  let u = t.u;
  if (planeDriven(t.experiment)) {
    for (let y = 1; y < h - 1; y++) u[y * w + 2] = drive;
  }
  for (const [sx, sy] of t.sources) u[sy * w + sx] = 1.4 * drive;
  const prev = t.prev;
  const nxt = t.nxt;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (wall[i]) {
        nxt[i] = 0;
        continue;
      }
      const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 3.999 * u[i];
      const v = (2 * u[i] - prev[i] + c2 * lap) * damp[i];
      nxt[i] = f ? flush(v) : v;
    }
  }
  t.prev = u;
  t.u = nxt;
  t.nxt = prev;
  u = t.u;
  for (let i = 0; i < u.length; i++) {
    const e = intensity[i] * 0.992 + u[i] * u[i] * 0.008;
    intensity[i] = f ? flush(e) : e;
  }
  t.step++;
}

const bits = (a: Float32Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const copy = (t: Tank): Tank => ({ ...t, u: t.u.slice(), prev: t.prev.slice(), nxt: t.nxt.slice(), intensity: t.intensity.slice() });
const same = (a: Tank, b: Tank) => bits(a.u).equals(bits(b.u)) && bits(a.prev).equals(bits(b.prev)) && bits(a.intensity).equals(bits(b.intensity));

/** Steps both tanks in lockstep; the first step at which they differ, or -1. */
function lockstep(step: (t: Tank, lambda: number) => void, experiment: Experiment, flushed: boolean, steps: number): number {
  const a = tank(160, 96, experiment, 24, { flush: flushed });
  drop(a, 110, 40);
  const b = copy(a);
  for (let k = 0; k < steps; k++) {
    advance(a, 12);
    step(b, 12);
    if (!same(a, b)) return k;
  }
  return -1;
}

const EXPERIMENTS: Experiment[] = ['double', 'single', 'two', 'free'];

describe('the S2 stencil hoist: ripple-tank steps exactly as before', () => {
  it('every stored float equals the pre-hoist advance after every step, every experiment, flushed or not', () => {
    for (const e of EXPERIMENTS) for (const flushed of [true, false]) {
      expect(lockstep(oldAdvance, e, flushed, 400), `${e}, flush ${flushed}`).toBe(-1);
    }
  });

  it('a planted change in the stencil fails the same comparison within a few steps', () => {
    for (const e of EXPERIMENTS) {
      const at = lockstep(plantedAdvance, e, true, 400);
      expect(at, e).toBeGreaterThanOrEqual(0);
      expect(at, e).toBeLessThan(5);
    }
  });
});

describe('the S2 stencil on a line, and its dispersion relation', () => {
  it('a standing mode sin(πmx/L) of a fixed string oscillates at the scheme’s ω, 2 asin(C sin(k/2))', () => {
    const n = 201; const L = n - 1; const c2 = 0.5;
    for (const m of [1, 3, 10]) {
      const k = (Math.PI * m) / L;
      const w = leapfrogOmega(k, c2);
      // the exact discrete solution u = sin(kx) cos(ωt) started with u⁻ = sin(kx) cos(−ω)
      let u = new Float64Array(n); let prev = new Float64Array(n); let nxt = new Float64Array(n);
      for (let i = 0; i < n; i++) { u[i] = Math.sin(k * i); prev[i] = Math.sin(k * i) * Math.cos(w); }
      for (let t = 1; t <= 300; t++) {
        leapfrog1d(u, prev, nxt, n, c2);
        [prev, u, nxt] = [u, nxt, prev];
        for (const i of [17, 50, 133]) expect(Math.abs(u[i] - Math.sin(k * i) * Math.cos(w * t)), `m ${m}, t ${t}`).toBeLessThan(1e-9);
      }
    }
  });

  it('the group velocity is dω/dk, the phase velocity ω/k, and both tend to C at long wavelength', () => {
    for (const c2 of [0.25, 0.5, 1]) for (const k of [0.05, 0.4, 1.2, 2.5]) {
      const h = 1e-6;
      const numeric = (leapfrogOmega(k + h, c2) - leapfrogOmega(k - h, c2)) / (2 * h);
      expect(Math.abs(leapfrogGroupVelocity(k, c2) - numeric)).toBeLessThan(1e-7);
    }
    expect(Math.abs(leapfrogPhaseVelocity(1e-4, 0.5) - Math.sqrt(0.5))).toBeLessThan(1e-8);
    expect(Math.abs(leapfrogGroupVelocity(1e-4, 0.5) - Math.sqrt(0.5))).toBeLessThan(1e-8);
    // at C = 1 on a line the scheme is exact: ω = k for every k
    for (const k of [0.3, 1.1, 2.9]) expect(Math.abs(leapfrogOmega(k, 1) - k)).toBeLessThan(1e-12);
  });
});
