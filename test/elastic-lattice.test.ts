// The triangular spring lattice (src/plates/_shared/elastic) beyond the entry's claims: its bonds
// counted, the relaxed strip against the affine field it must reach, the bond-sum moduli against
// the energy of a strained periodic sheet, the dispersion against the Rayleigh quotient of a plane
// wave under the stiffness itself, and velocity Verlet's measured order under step halving.
import { describe, expect, it } from 'vitest';
import { Dynamics, lattice, Relaxation, ROW, site, stiffness, strainEnergy } from '../src/plates/_shared/elastic/lattice';
import { dispersion, moduli, poisson, speeds, young } from '../src/plates/_shared/elastic/oracles';
import { periodicRows } from '../src/plates/elastic-lattice/plate';

describe('elastic-lattice: the sheet', () => {
  it('gives every site of a periodic sheet six bonds, and an open sheet its interior six', () => {
    const P = lattice(12, 8, 1, true);
    const deg = new Int32Array(P.x.length);
    for (let b = 0; b < P.bp.length; b++) { deg[P.bp[b]]++; deg[P.bq[b]]++; }
    expect([...deg].every((d) => d === 6)).toBe(true);
    const O = lattice(12, 8, 1, false);
    const od = new Int32Array(O.x.length);
    for (let b = 0; b < O.bp.length; b++) { od[O.bp[b]]++; od[O.bq[b]]++; }
    for (let j = 1; j < 7; j++) for (let i = 1; i < 11; i++) expect(od[site(12, i, j)]).toBe(6);
    // each bond joins sites one spacing apart, along its stored direction
    for (let b = 0; b < O.bp.length; b++) {
      const dx = O.x[O.bq[b]] - O.x[O.bp[b]];
      const dy = O.y[O.bq[b]] - O.y[O.bp[b]];
      expect(Math.abs(dx - O.ex[b]) + Math.abs(dy - O.ey[b])).toBeLessThan(1e-12);
    }
  });

  it('relaxes a strip on sliding grips to the affine field u = (εx, −ε(y − y₀)/3)', () => {
    const nx = 30;
    const ny = 9;
    const eps = 0.02;
    const L = lattice(nx, ny, 1.5, false);
    const n = nx * ny;
    const ux = new Float64Array(n);
    const uy = new Float64Array(n);
    const held = new Uint8Array(2 * n);
    for (let j = 0; j < ny; j++) {
      for (const i of [0, nx - 1]) { const s = site(nx, i, j); held[2 * s] = 1; ux[s] = eps * L.x[s]; }
    }
    const pin = site(nx, 0, 4);
    held[2 * pin + 1] = 1;
    const r = new Relaxation(L, ux, uy, held);
    while (r.residual() > 1e-13 && r.iterations < 4 * n) r.iterate();
    expect(r.iterations).toBeLessThan(2 * n);
    let gap = 0;
    for (let s = 0; s < n; s++) {
      gap = Math.max(gap, Math.abs(ux[s] - eps * L.x[s]), Math.abs(uy[s] + (eps * (L.y[s] - L.y[pin])) / 3));
    }
    expect(gap).toBeLessThan(1e-10);
  });

  it('has the bond sum’s moduli: a strained periodic sheet holds ½C₁₁ε² and ½C₁₂₁₂γ² an area', () => {
    const k = 2;
    const L = lattice(10, 8, k, true);
    const area = 10 * 8 * ROW;
    const n = L.x.length;
    // a uniform strain on a periodic sheet: the displacement of each bond is ε·b, set per bond
    const energyOf = (exx: number, gxy: number) => {
      let e = 0;
      for (let b = 0; b < L.bp.length; b++) {
        const s = L.ex[b] * (exx * L.ex[b] + gxy * L.ey[b]);
        e += s * s;
      }
      return (0.5 * k * e) / area;
    };
    const m = moduli(k);
    expect(energyOf(1e-3, 0) / (0.5 * m.c11 * 1e-6)).toBeCloseTo(1, 12);
    // a simple shear u_x = γy stretches a bond by n_x n_y γ: energy ½C₁₂₁₂γ²
    expect(energyOf(0, 1e-3) / (0.5 * m.c66 * 1e-6)).toBeCloseTo(1, 12);
    expect(poisson(k)).toBeCloseTo(1 / 3, 14);
    expect(young(k)).toBeCloseTo((2 * k) / Math.sqrt(3), 13);
    expect(speeds(k).cL / speeds(k).cT).toBeCloseTo(Math.sqrt(3), 14);
    expect(n).toBe(80);
  });

  it('has the dispersion of the Rayleigh quotient of a plane wave under its own stiffness', () => {
    const nx = 24;
    const L = lattice(nx, periodicRows(nx), 1.25, true);
    const n = L.x.length;
    for (const m of [1, 3, 7]) {
      const q = (2 * Math.PI * m) / nx;
      const d = dispersion(1.25, q);
      expect(Math.abs(d.off)).toBeLessThan(1e-14);
      for (const [pol, w] of [[0, d.wL], [1, d.wT]] as const) {
        const ux = new Float64Array(n);
        const uy = new Float64Array(n);
        for (let s = 0; s < n; s++) (pol === 0 ? ux : uy)[s] = Math.cos(q * L.x[s]);
        const fx = new Float64Array(n);
        const fy = new Float64Array(n);
        stiffness(L, ux, uy, fx, fy);
        // an exact mode: K·u = ω²u site by site, not only on average
        let gap = 0;
        for (let s = 0; s < n; s++) gap = Math.max(gap, Math.abs((pol === 0 ? fx : fy)[s] - w * w * (pol === 0 ? ux : uy)[s]));
        expect(gap).toBeLessThan(1e-12);
        let uu = 0;
        for (let s = 0; s < n; s++) uu += ux[s] ** 2 + uy[s] ** 2;
        expect((2 * strainEnergy(L, ux, uy)) / uu).toBeCloseTo(w * w, 12);
      }
    }
  });

  it('steps by velocity Verlet at order 2, measured by halving', () => {
    const nx = 16;
    const L = lattice(nx, periodicRows(nx), 1, true);
    const n = L.x.length;
    const run = (h: number, T: number) => {
      const ux = new Float64Array(n);
      const uy = new Float64Array(n);
      for (let s = 0; s < n; s++) {
        ux[s] = Math.cos((2 * Math.PI * L.x[s]) / nx);
        uy[s] = 0.5 * Math.sin((4 * Math.PI * L.x[s]) / nx + L.y[s]);
      }
      const d = new Dynamics(L, ux, uy, new Float64Array(n), new Float64Array(n));
      for (let i = 0; i < Math.round(T / h); i++) d.step(h);
      return d;
    };
    const T = 8;
    const ref = run(0.2 / 64, T);
    const err = (h: number) => {
      const d = run(h, T);
      let e = 0;
      for (let s = 0; s < n; s++) e = Math.max(e, Math.abs(d.ux[s] - ref.ux[s]), Math.abs(d.uy[s] - ref.uy[s]));
      return e;
    };
    const p = Math.log2(err(0.2) / err(0.1));
    expect(Math.abs(p - 2)).toBeLessThan(0.2);
  });
});
