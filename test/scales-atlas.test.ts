// scales-atlas (catalogue/entries/scales-atlas.md) beyond the entry's claims: the atomic rungs stand
// one factor of α apart, the Bohr orbit and the Planck pair keep their closed relations, and three
// planted slips fail every claim between them through the instrument.
import { describe, expect, it, vi } from 'vitest';
import { CODATA, hbar, rungs, TABLED, type Constants, type Rung } from '../src/plates/scales-atlas/scales';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'scales-atlas';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const value = (id: string, k: Constants = CODATA) => rungs(k).find((r) => r.id === id)!.value;

describe('scales-atlas: the rungs', () => {
  it('stand one α apart: r_e/λ̄_C = λ̄_C/a₀ = α', () => {
    expect(value('electron-radius') / value('compton')).toBeCloseTo(CODATA.alpha, 15);
    expect(value('compton') / value('bohr')).toBeCloseTo(CODATA.alpha, 15);
  });

  it('keep their closed relations: the orbit is 2π/α light crossings, the Planck time the Planck length over c', () => {
    expect(value('bohr-orbit') / value('light-across-bohr') / ((2 * Math.PI) / CODATA.alpha)).toBeCloseTo(1, 14);
    expect(value('planck-length') / CODATA.c / value('planck-time')).toBeCloseTo(1, 14);
    expect(value('atomic-time') * CODATA.alpha * CODATA.alpha * CODATA.me * CODATA.c ** 2 / hbar(CODATA)).toBeCloseTo(1, 14);
  });

  it('every tabled rung is a rung, and every claim reads one of them', () => {
    const ids = new Set(rungs(CODATA).map((r) => r.id));
    for (const id of Object.keys(TABLED)) expect(ids.has(id), id).toBe(true);
    expect(claims.length).toBe(Object.keys(TABLED).length);
  });

  it('the light-year is an integer that double precision holds exactly', () => {
    const ly = value('light-year');
    expect(Number.isInteger(ly)).toBe(true);
    expect(ly).toBe(299792458 * 31557600);
    expect(BigInt(ly)).toBe(299792458n * 31557600n);
  });
});

describe('scales-atlas: planted slips fail every claim between them', () => {
  type Scales = typeof import('../src/plates/scales-atlas/scales');
  const failing = async (mock: (m: Scales) => Partial<Scales>) => {
    vi.resetModules();
    vi.doMock('../src/plates/scales-atlas/scales', async (orig) => { const m = await orig<Scales>(); return { ...m, ...mock(m) }; });
    const planted = await import('./support/claims');
    const failed: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length > 0) failed.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/scales-atlas/scales');
    vi.resetModules();
    return failed;
  };

  it('ħ taken as h, α rounded to 1/137 and a tropical year each fail their claims, and all of them together every one', async () => {
    const hbarSlip = await failing((m) => ({ rungs: (k: Constants) => m.rungs({ ...k, h: k.h * 2 * Math.PI }) }));
    const alphaSlip = await failing((m) => ({ rungs: (k: Constants) => m.rungs({ ...k, alpha: 1 / 137 }) }));
    const yearSlip = await failing((m) => ({
      rungs: (k: Constants) => m.rungs(k).map((r: Rung) => (r.id === 'light-year' ? { ...r, value: k.c * 365.2422 * 86400 } : r)),
    }));
    expect(hbarSlip.sort()).toEqual(claims.map((c) => c.id).filter((id) => id !== 'light-year').sort());
    expect(alphaSlip.sort()).toEqual(['atomic-time', 'bohr-radius', 'classical-electron-radius', 'lyman-alpha']);
    expect(yearSlip).toEqual(['light-year']);
    expect(new Set([...hbarSlip, ...alphaSlip, ...yearSlip]).size).toBe(claims.length);
  });
});
