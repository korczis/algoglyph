// poincare-section (wave 6): its hand-written kick-drift-kick step moves onto the one integrator
// library (src/plates/_shared/ode), the same arithmetic in the same order, so every orbit is the
// same bit for bit; the old step is kept here verbatim and run beside the library in this run (no
// hash recorded on one CPU).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { leapfrog } from '../src/plates/_shared/ode/ode';
import * as poincare from '../src/kernels/numeric/poincare-section';
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
      expect(now.drift).toBe(was.drift);
    }
  });

  it('the kernel carries no copy of the step of its own', () => {
    const src = readFileSync('src/kernels/numeric/poincare-section.ts', 'utf8');
    expect(src).toMatch(/from '\.\.\/\.\.\/plates\/_shared\/ode\/ode'/);
    expect(src).not.toMatch(/0\.5 \* h \* f[xy]/);
  });
});
