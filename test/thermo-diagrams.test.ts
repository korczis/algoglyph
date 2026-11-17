// thermo-diagrams (catalogue/entries/thermo-diagrams.md) beyond the entry's claims: every cycle
// closes, the legs' heats and works against their closed forms, Simpson's order 4 measured on the
// isobar, the efficiencies against the closed forms over settings other than the claims', and a
// planted slip failing every claim through the instrument.
import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  closedEfficiency, integrate, legs, R, run, type CycleId, type CycleSpec, type Leg,
} from '../src/plates/thermo-diagrams/cycle';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'thermo-diagrams';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const claim = (id: string) => claims.find((c) => c.id === id)!;
const CYCLES: CycleId[] = ['carnot', 'otto', 'diesel', 'stirling'];

function settings(count: number): CycleSpec[] {
  const rnd = mulberry32(44);
  return Array.from({ length: count }, (_, i) => ({
    cycle: CYCLES[i % 4], gamma: rnd() < 0.5 ? 1.4 : 5 / 3,
    Th: 400 + rnd() * 2100, Tc: 200 + rnd() * 190, ratio: 1.5 + rnd() * 23.5, cutoff: 1.1 + rnd() * 2.9,
  })).map((c) => ({ ...c, cutoff: Math.min(c.cutoff, 0.9 * c.ratio) }));
}

describe('thermo-diagrams: the legs', () => {
  it('close: every leg starts where the last ended, and the path of each ends at its end state', () => {
    for (const c of settings(80)) {
      const ls = legs(c);
      for (let i = 0; i < ls.length; i++) {
        const next = ls[(i + 1) % ls.length];
        expect(next.Va / ls[i].Vb).toBeCloseTo(1, 12);
        expect(next.Ta / ls[i].Tb).toBeCloseTo(1, 12);
      }
    }
  });

  it('give each leg\'s heat and work as in closed form', () => {
    const cv = (g: number) => R / (g - 1);
    const leg = (kind: Leg['kind'], Va: number, Ta: number, Vb: number, Tb: number): Leg => ({ kind, Va, Ta, Vb, Tb });
    const g = 1.4;
    // an isotherm: Q = W = RT ln(Vb/Va)
    const iso = integrate(leg('isotherm', 1, 500, 3, 500), g);
    expect(iso.work).toBeCloseTo(R * 500 * Math.log(3), 9);
    expect(iso.heat).toBeCloseTo(R * 500 * Math.log(3), 9);
    // an adiabat: Q = 0, W = Cv(Ta − Tb)
    const Tb = 500 * 3 ** (1 - g);
    const ad = integrate(leg('adiabat', 1, 500, 3, Tb), g);
    expect(Math.abs(ad.heat)).toBeLessThan(1e-9);
    expect(ad.work).toBeCloseTo(cv(g) * (500 - Tb), 8);
    // an isochore: W = 0, Q = Cv ΔT, ∫dQ/T = Cv ln(Tb/Ta)
    const ch = integrate(leg('isochore', 2, 300, 2, 900), g);
    expect(ch.work).toBe(0);
    expect(ch.heat).toBeCloseTo(cv(g) * 600, 9);
    expect(ch.entropy).toBeCloseTo(cv(g) * Math.log(3), 11);
    // an isobar: W = pΔV = RΔT, Q = Cp ΔT, ∫dQ/T = Cp ln(Vb/Va)
    const bar = integrate(leg('isobar', 1, 400, 2.5, 1000), g);
    expect(bar.work).toBeCloseTo(R * 600, 9);
    expect(bar.heat).toBeCloseTo((cv(g) + R) * 600, 9);
    expect(bar.entropy).toBeCloseTo((cv(g) + R) * Math.log(2.5), 11);
  });

  it('converge at Simpson\'s order 4 on the isobar\'s entropy', () => {
    const l: Leg = { kind: 'isobar', Va: 1, Ta: 300, Vb: 4, Tb: 1200 };
    const exact = (R / 0.4 + R) * Math.log(4);
    const e = [20, 40, 80].map((n) => Math.abs(integrate(l, 1.4, n).entropy - exact));
    for (let i = 1; i < e.length; i++) expect(Math.abs(Math.log2(e[i - 1] / e[i]) - 4)).toBeLessThan(0.2);
  });
});

describe('thermo-diagrams: the cycles', () => {
  it('meet their closed-form efficiencies within 1e−8, ∮dQ/T within 1e−9 and the first law within 1e−6 J, over 400 settings', () => {
    let eta = 0; let claus = 0; let first = 0;
    for (const c of settings(400)) {
      const s = run(c);
      eta = Math.max(eta, Math.abs(s.work / s.heatIn - closedEfficiency(c)));
      claus = Math.max(claus, Math.abs(s.clausius));
      first = Math.max(first, Math.abs(s.work - (s.heatIn - s.heatOut)));
    }
    expect(eta).toBeLessThan(1e-8);
    // Simpson's error on ∫dT/T grows as (Tb/Ta)⁵: the widest isochores, 2500 K over 200 K, reach 2e−10
    expect(claus).toBeLessThan(1e-9);
    expect(Math.abs(run({ cycle: 'diesel', gamma: 1.4, Th: 600, Tc: 300, ratio: 18, cutoff: 2 }).clausius)).toBeLessThan(claim('diesel-clausius').expect.below as number);
    expect(first).toBeLessThan(1e-6);
  });

  it('never beat Carnot between their own extreme temperatures', () => {
    for (const c of settings(400)) {
      const s = run(c);
      const hot = Math.max(...legs(c).map((l) => Math.max(l.Ta, l.Tb)));
      const cold = Math.min(...legs(c).map((l) => Math.min(l.Ta, l.Tb)));
      expect(s.work / s.heatIn).toBeLessThanOrEqual(1 - cold / hot + 1e-12);
    }
  });

  it('the claims\' expected values are the closed forms', () => {
    const base = { gamma: 1.4, Th: 600, Tc: 300, ratio: 2, cutoff: 2 };
    expect(claim('carnot-work').expect.value).toBeCloseTo(R * 300 * Math.log(2), 6);
    expect(claim('otto-efficiency').expect.value).toBeCloseTo(1 - 8 ** -0.4, 9);
    expect(claim('diesel-efficiency').expect.value).toBeCloseTo(1 - (2 ** 1.4 - 1) / (1.4 * 18 ** 0.4 * (2 - 1)), 9);
    expect(claim('stirling-efficiency').expect.value).toBeCloseTo((300 * Math.log(2)) / (600 * Math.log(2) + 1.5 * 300), 9);
    expect(closedEfficiency({ ...base, cycle: 'carnot' })).toBe(claim('carnot-efficiency').expect.value);
  });
});

describe('thermo-diagrams: a planted slip fails every claim', () => {
  it('the legs integrated with γ one hundredth too large moves every claim out of its band', async () => {
    type Cycle = typeof import('../src/plates/thermo-diagrams/cycle');
    vi.resetModules();
    vi.doMock('../src/plates/thermo-diagrams/cycle', async (orig) => {
      const m = await orig<Cycle>();
      return { ...m, integrate: (l: Leg, g: number, n?: number) => m.integrate(l, g + 0.01, n) };
    });
    const planted = await import('./support/claims');
    const held: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length === 0) held.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/thermo-diagrams/cycle');
    vi.resetModules();
    expect(held, 'claims the planted slip did not fail').toEqual([]);
  });
});
