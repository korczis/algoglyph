// poincare-section (wave 6). Defect D3: its hand-written kick-drift-kick step moves onto the one integrator
// library (src/plates/_shared/ode), the same arithmetic in the same order, so every orbit is the
// same bit for bit; the old step is kept here verbatim and run beside the library in this run (no
// hash recorded on one CPU). Then the coupling λ, fixed at 1, becomes a control.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { leapfrog } from '../src/plates/_shared/ode/ode';
import * as poincare from '../src/kernels/numeric/poincare-section';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

type S = [number, number, number, number];
type XY = [number, number];

// ---- the orbit as it was before the move, verbatim (src/kernels/numeric/poincare-section.ts) ----
const oldForce = (x: number, y: number, lam: number): [number, number] => [-x - 2 * lam * x * y, -y - lam * (x * x - y * y)];

function oldOrbit(s0: S, lam: number, crossings: number, h = 0.01, pathSteps = 3000): { section: XY[]; path: XY[]; drift: number } {
  let s = s0.slice() as S;
  const E0 = poincare.energy(s, lam);
  const section: XY[] = []; const path: XY[] = [];
  let [fx, fy] = oldForce(s[0], s[1], lam);
  let drift = 0;
  for (let i = 0; section.length < crossings && i < 4_000_000; i++) {
    const prev = s.slice() as S;
    const px = s[2] + 0.5 * h * fx; const py = s[3] + 0.5 * h * fy;
    const x = s[0] + h * px; const y = s[1] + h * py;
    [fx, fy] = oldForce(x, y, lam);
    s = [x, y, px + 0.5 * h * fx, py + 0.5 * h * fy];
    if (i < pathSteps) path.push([x, y]);
    if (prev[0] < 0 && s[0] >= 0 && s[2] > 0) {
      const t = -prev[0] / (s[0] - prev[0]);
      section.push([prev[1] + t * (s[1] - prev[1]), prev[3] + t * (s[3] - prev[3])]);
    }
    if (i % 64 === 0) drift = Math.max(drift, Math.abs(poincare.energy(s, lam) - E0) / Math.abs(E0));
  }
  return { section, path, drift };
}

/** Starts on the section at the plate's energies and couplings, inside the energy surface. */
const STARTS: [number, number, number, number][] = [
  // y, py, E, λ
  [0.1, 0.1, 0.125, 1], [-0.3, 0.2, 0.165, 1], [0.25, -0.3, 0.125, 1], [0.05, 0.4, 0.165, 0.5],
  [0.2, 0.1, 0.1, 0], [-0.1, -0.15, 0.04, 1],
];

describe('poincare-section: the leapfrog comes from src/plates/_shared/ode', () => {
  it('one library step is the old inline step, bit for bit', () => {
    for (const [y0, py0, E, lam] of STARTS) {
      const s = poincare.start(y0, py0, E, lam)!;
      // the old step, on a tuple
      let t = s.slice() as S;
      let [fx, fy] = oldForce(t[0], t[1], lam);
      // the library step, on arrays
      const q = Float64Array.of(s[0], s[1]); const p = Float64Array.of(s[2], s[3]);
      const accel = poincare.accelOf(lam);
      const a = new Float64Array(2);
      accel(q, a);
      for (let i = 0; i < 20_000; i++) {
        const px = t[2] + 0.5 * 0.01 * fx; const py = t[3] + 0.5 * 0.01 * fy;
        const x = t[0] + 0.01 * px; const y = t[1] + 0.01 * py;
        [fx, fy] = oldForce(x, y, lam);
        t = [x, y, px + 0.5 * 0.01 * fx, py + 0.5 * 0.01 * fy];
        leapfrog(q, p, a, 0.01, accel);
      }
      expect([...q, ...p]).toEqual(t);
      expect([...a]).toEqual([fx, fy]);
    }
  });

  it('every orbit (section and path) is the old one, bit for bit', () => {
    for (const [y0, py0, E, lam] of STARTS) {
      const s = poincare.start(y0, py0, E, lam)!;
      const now = poincare.orbit(s, lam, 60);
      const was = oldOrbit(s, lam, 60);
      expect(now.section).toEqual(was.section);
      expect(now.path).toEqual(was.path);
      // the drift is now taken at every step, the old one at every 64th (below): never smaller
      expect(now.drift).toBeGreaterThanOrEqual(was.drift);
    }
  });

  it('the kernel carries no copy of the step of its own', () => {
    const src = readFileSync('src/kernels/numeric/poincare-section.ts', 'utf8');
    expect(src).toMatch(/from '\.\.\/\.\.\/plates\/_shared\/ode\/ode'/);
    expect(src).not.toMatch(/0\.5 \* h \* f[xy]/);
  });
});

// The readout says "Largest relative energy drift", but the orbit sampled the energy every 64th
// step: it now takes every step, so the largest it reports is the largest there was.
describe('poincare-section: the largest drift is taken over every step', () => {
  it('equals the maximum of |E − E0|/|E0| over every step of the orbit, counted here', () => {
    for (const [y0, py0, E, lam] of STARTS) {
      const s = poincare.start(y0, py0, E, lam)!;
      const o = poincare.orbit(s, lam, 40);
      const E0 = poincare.energy(s, lam);
      const q = Float64Array.of(s[0], s[1]); const p = Float64Array.of(s[2], s[3]);
      const accel = poincare.accelOf(lam);
      const a = new Float64Array(2);
      accel(q, a);
      let crossings = 0; let worst = 0; let sampled = 0;
      for (let i = 0; crossings < 40; i++) {
        const x0 = q[0];
        leapfrog(q, p, a, 0.01, accel);
        if (x0 < 0 && q[0] >= 0 && p[0] > 0) crossings++;
        const d = Math.abs(poincare.energy([q[0], q[1], p[0], p[1]], lam) - E0) / Math.abs(E0);
        worst = Math.max(worst, d);
        if (i % 64 === 0) sampled = Math.max(sampled, d);
      }
      expect(worst).toBeGreaterThan(sampled); // the sampling missed the peak on every start here
      expect(o.drift).toBe(worst);
    }
  });
});

// The coupling λ of x²y − y³/3, fixed at 1, becomes the control `lambda`. Scaling x = X/λ turns
// H(λ) into H(1)/λ², so the escape energy is 1/(6λ²), and λ ≤ 1 keeps it above the energy
// control's top, 0.165: every orbit stays bound. At λ = 0 the system is two uncoupled unit
// oscillators, which the leapfrog integrates with a conserved modified energy
// H̃ = H − (h²/8)(x² + y²), so the relative energy error stays within (h²/4)/(1 − h²/4).
const ID = 'poincare-section';
const KEY = 'lambda';
const probe = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
async function at(readout: string, params: Params): Promise<number> {
  const r = await read(ID, probe(readout, params));
  expect(r.reason).toBeUndefined();
  return r.value as number;
}

describe('poincare-section: lambda, "Coupling λ"', () => {
  it('is a range 0 … 1 by 0.05, 1 (the old constant) by default, and rebuilds', () => {
    expect(poincare.kernel.params?.find((d) => d.key === KEY)).toMatchObject({
      kind: 'range', label: 'Coupling λ', min: 0, max: 1, step: 0.05, value: 1, rebuild: true,
    });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 0.35, 0.8]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('at 0 the orbits are uncoupled oscillators: every one crosses 160 times, the drift within h²/4', async () => {
    const h = 0.01;
    const bound = (h * h) / 4 / (1 - (h * h) / 4); // 2.50006e-5
    expect(await at('Section points', { [KEY]: 0, energy: 0.165 })).toBe(16 * 160);
    expect(await at('Largest relative energy drift', { [KEY]: 0, energy: 0.165 })).toBeLessThanOrEqual(2.5e-5);
    // the readout prints three digits; the orbit itself is within the bound
    const s = poincare.start(0.2, 0.1, 0.165, 0)!;
    expect(poincare.orbit(s, 0, 160).drift).toBeLessThanOrEqual(bound);
    expect(await at('Escape energy 1/(6λ²)', { [KEY]: 0.5 })).toBeCloseTo(2 / 3, 4);
  });

  it('at 0.5 the energy 0.165 is a quarter of the way to escape in the scaled system: every orbit crosses 160 times', async () => {
    expect(await at('Section points', { [KEY]: 0.5, energy: 0.165 })).toBe(16 * 160);
  });
});
