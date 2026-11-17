// semiconductors (catalogue/entries/semiconductors.md) beyond the entry's claims: the solver against
// the Poisson–Boltzmann equation it discretises, the junction field's order 2 under halving and
// each field claim's bound against the Richardson estimate of the error, the built-in potential's
// closed form, and a planted slip (the donor density 1 % high) failing every claim through the
// instrument.
import { describe, expect, it, vi } from 'vitest';
import { firstIntegral, intrinsic, K_EV, material, solve } from '../src/plates/semiconductors/junction';
import { junctionOf } from '../src/plates/semiconductors/plate';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'semiconductors';
const FIELD = 'solved field against the first integral, relative';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const setting = (c: Claim) => {
  const p = { material: 'si', na: 16, nd: 17, t: 300, ...(c.setup?.params ?? {}) } as Record<string, string | number>;
  return [String(p.material), Number(p.na), Number(p.nd), Number(p.t)] as const;
};
const relErr = (s: ReturnType<typeof junctionOf>) => Math.abs(s.gridField / s.exact.field - 1);

describe('semiconductors: the solver', () => {
  it('satisfies the discrete Poisson–Boltzmann equation at every node, and zero field at the ends', () => {
    const m = material('si');
    const ni = intrinsic(m, 300);
    const j = solve(1e16, 1e17, ni, m, 300, 4e-5, 2e-5, 801);
    const h = j.x[1] - j.x[0];
    let worst = 0;
    for (let i = 1; i < j.x.length - 1; i++) {
      const lhs = (j.u[i - 1] - 2 * j.u[i] + j.u[i + 1]) / (h * h);
      const rhs = (Math.exp(j.u[i]) - Math.exp(-j.u[i]) - j.c[i]) / j.li2;
      worst = Math.max(worst, Math.abs(lhs - rhs) / (Math.abs(j.c[i]) / j.li2));
    }
    expect(worst).toBeLessThan(1e-9);
    expect(j.update).toBeLessThan(1e-12);
  });

  it('has the first integral\'s junction potential continuous from both sides', () => {
    const m = material('si');
    const ni = intrinsic(m, 300);
    const { u0 } = firstIntegral(1e16, 1e17, ni, m, 300);
    const ca = 1e16 / ni; const cd = 1e17 / ni;
    const up = -Math.asinh(ca / 2); const un = Math.asinh(cd / 2);
    const fromN = 2 * Math.cosh(u0) - 2 * Math.cosh(un) - cd * (u0 - un);
    const fromP = 2 * Math.cosh(u0) - 2 * Math.cosh(up) + ca * (u0 - up);
    expect(Math.abs(fromN - fromP) / fromN).toBeLessThan(1e-12);
  });
});

describe('semiconductors: the junction field converges at order 2', () => {
  for (const c of claims.filter((x) => x.readout === FIELD)) {
    it(`${c.id}: order 2 ± 0.2, and the bound above 1.1 × the Richardson estimate of the error`, () => {
      const [mat, na, nd, t] = setting(c);
      const [e4, e8, e16] = [4, 8, 16].map((per) => relErr(junctionOf(mat, na, nd, t, per)));
      expect(Math.abs(Math.log2(e8 / e16) - 2)).toBeLessThan(0.2);
      // the error at the claim's grid estimated from the grid alone: (4/3)|E_h − E_{h/2}|/E
      const a = junctionOf(mat, na, nd, t, 4);
      const b = junctionOf(mat, na, nd, t, 8);
      const estimate = (4 / 3) * Math.abs(a.gridField - b.gridField) / Math.abs(b.gridField);
      expect(c.expect.below as number).toBeGreaterThan(1.1 * estimate);
      expect(e4).toBeLessThan(c.expect.below as number);
    });
  }
});

describe('semiconductors: the built-in potential', () => {
  it('is (kT/q)·ln(N_A N_D/n_i²) for silicon from the tabled constants, as the claim says', () => {
    const m = material('si');
    const ni = Math.sqrt(m.nc * m.nv) * Math.exp(-m.gap / (2 * K_EV * 300));
    const c = claims.find((x) => x.id === 'built-in-potential-of-silicon')!;
    expect(Math.abs((c.expect.value as number) - K_EV * 300 * Math.log((1e16 * 1e17) / (ni * ni)))).toBeLessThan(5e-7);
  });
});

describe('semiconductors: a planted slip fails every claim', () => {
  it('the donor density 1 % high in the solver moves every claim out of its band', async () => {
    type Junction = typeof import('../src/plates/semiconductors/junction');
    vi.resetModules();
    vi.doMock('../src/plates/semiconductors/junction', async (orig) => {
      const m = await orig<Junction>();
      return { ...m, solve: (na: number, nd: number, ...rest: Parameters<Junction['solve']> extends [number, number, ...infer R] ? R : never) =>
        m.solve(na, nd * 1.01, ...rest) };
    });
    const planted = await import('./support/claims');
    const held: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length === 0) held.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/semiconductors/junction');
    vi.resetModules();
    expect(held, 'claims the planted slip did not fail').toEqual([]);
  });
});
