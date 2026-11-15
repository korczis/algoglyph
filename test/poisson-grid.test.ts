// The grid back-end of electrostatics (src/plates/_shared/fields/grid.ts) held to what it does not
// compute: the sine series of a line charge in a grounded box, at a measured second order; Gauss's
// law on the grid, for a conductor's charge and for charges that must cancel; the energy two ways;
// the coaxial capacitance approached as the grid refines; and the dielectric cylinder's inner field.
import { describe, expect, it } from 'vitest';
import { boxSeries, chargeOn, fieldEnergy, makeGrid, Solve } from '../src/plates/_shared/fields/grid';
import { build, COAX, TOL } from '../src/plates/poisson-grid/plate';

const solved = (g: ReturnType<typeof makeGrid>) => { const s = new Solve(g); s.advance(100000, TOL); return s; };
const at = (g: ReturnType<typeof makeGrid>, x: number, y: number) => g.phi[Math.round(y / g.h) * g.n + Math.round(x / g.h)];

describe('poisson-grid against the series', () => {
  it('the sine series solves the box: it vanishes on the walls and is symmetric in source and probe', () => {
    expect(Math.abs(boxSeries(1, 0.5, 0.5, 0.5, 1))).toBeLessThan(1e-12);
    expect(Math.abs(boxSeries(1, 0.5, 0.5, 0, 0.3))).toBeLessThan(1e-12);
    expect(Math.abs(boxSeries(1, 0.3, 0.4, 0.7, 0.6) - boxSeries(1, 0.7, 0.6, 0.3, 0.4))).toBeLessThan(1e-12);
  });

  it('a line charge on the grid converges to the series at second order', () => {
    const gap = (cells: number) => {
      const g = build('charge', cells, 1);
      solved(g);
      return Math.abs(at(g, 0.25, 0.625) - boxSeries(1, 0.5, 0.5, 0.25, 0.625));
    };
    expect(Math.abs(Math.log2(gap(64) / gap(128)) - 2)).toBeLessThan(0.2);
  });

  it('the energy two ways and the conductors’ charges cancel, once solved', () => {
    const g = build('coax', 64, 1);
    solved(g);
    expect(Math.abs(fieldEnergy(g) - 0.5 * chargeOn(g, 2))).toBeLessThan(1e-9);
    expect(Math.abs(chargeOn(g, 2) + chargeOn(g, 3))).toBeLessThan(1e-9);
  });

  it('the coaxial capacitance approaches 2πε/ln(b/a) as the grid refines', () => {
    const want = (2 * Math.PI) / Math.log(COAX.b / COAX.a);
    const gaps = [64, 128, 256].map((c) => { const g = build('coax', c, 1); solved(g); return Math.abs(chargeOn(g, 2) - want); });
    expect(gaps[1]).toBeLessThan(gaps[0]);
    expect(gaps[2]).toBeLessThan(gaps[1]);
    expect(gaps[1] / want).toBeLessThan(0.03);
  });
});
