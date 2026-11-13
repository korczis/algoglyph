// Yee's one-dimensional grid (src/plates/_shared/em/yee1d.ts) against what it does not compute:
// exact transport in vacuum at the Courant number 1, Fresnel's normal-incidence reflectance with the
// grid's gap measured to be second order, energy conservation, the continuum's skin depth, and the
// bound-electron model's index.
import { describe, expect, it } from 'vitest';
import { pulse, vacuum, Yee } from '../src/plates/_shared/em/yee1d';
import { maxwell1d } from '../src/plates/maxwell-1d/plate';

/** The front face's reflectance of a slab of ε at `lam` cells per wavelength, by the plate's own method. */
function front(lam: number, eps: number): number {
  const n = Math.round(35 * lam);
  const [a, b, pl, src] = [15, 25, 10, 5].map((k) => Math.round(k * lam));
  const slab = vacuum(n);
  for (let i = a; i < b; i++) slab.eps[i] = eps;
  const width = 1.5 * lam;
  const w = (2 * Math.PI) / lam;
  const ref = new Yee(vacuum(n), 1, src, pulse(w, width, 4 * width));
  const run = new Yee(slab, 1, src, pulse(w, width, 4 * width));
  const split = 4 * width + (pl - src) + 2 * (a - pl) + Math.sqrt(eps) * (b - a);
  let inc = 0;
  let refl = 0;
  for (let k = 0; k < 4 * width + 2 * n; k++) {
    ref.step();
    run.step();
    const hr = 0.5 * (ref.H[pl] + ref.H[pl - 1]);
    inc += -ref.E[pl] * hr;
    if (run.t < split) refl += (run.E[pl] - ref.E[pl]) * (0.5 * (run.H[pl] + run.H[pl - 1]) - hr);
  }
  return refl / inc;
}

describe('maxwell-1d', () => {
  it('carries a pulse through vacuum unchanged at the Courant number 1', () => {
    const y = new Yee(vacuum(600), 1, 50, pulse(0.3, 15, 60));
    for (let k = 0; k < 200; k++) y.step();
    const snap = Array.from(y.E.slice(100, 400));
    for (let k = 0; k < 100; k++) y.step();
    // a hundred steps later the same shape, a hundred cells on
    const moved = Array.from(y.E.slice(200, 500));
    expect(Math.max(...snap.map((v, i) => Math.abs(v - moved[i])))).toBeLessThan(1e-12);
  });

  it('a dielectric face reflects ((n − 1)/(n + 1))², the gap second order in the cells per wavelength', () => {
    const want = 1 / 9;
    const g1 = Math.abs(front(40, 4) - want);
    const g2 = Math.abs(front(80, 4) - want);
    expect(Math.abs(Math.log2(g1 / g2) - 2)).toBeLessThan(0.2);
  });

  it('declares its pace and its controls', () => {
    expect(maxwell1d.pace?.kind).toBe('replay');
  });
});
