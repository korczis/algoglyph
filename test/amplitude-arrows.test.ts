// amplitude-arrows (catalogue/entries/amplitude-arrows.md) beyond the entry's claims: the number of
// arrows against the bound's formula, the arrows' sum against the closed geometric series written
// out, both rounding bounds at settings other than the claims', and a planted slip in the arrows
// failing every claim through the instrument.
import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  airy, faceAmplitude, probability, reflected, roundTrip, total, transmitted, type Plate,
} from '../src/plates/amplitude-arrows/arrows';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'amplitude-arrows';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const claim = (id: string) => claims.find((c) => c.id === id)!;

/** Settings drawn over the sliders' whole ranges, none of them a claim's. */
function settings(count: number): Plate[] {
  const rnd = mulberry32(31);
  return Array.from({ length: count }, () => ({
    n: 1.05 + rnd() * 1.45, d: Math.round(rnd() * 1000), lambda: 380 + Math.round(rnd() * 370),
  }));
}

describe('amplitude-arrows: the arrows', () => {
  it('number 1 + ⌈ln(1e−18/((1 − r²)r))/ln r²⌉, as the entry\'s bound says', () => {
    for (const n of [1.05, 1.33, 1.5, 2, 2.4, 2.5]) {
      const r = faceAmplitude(n);
      expect(reflected({ n, d: 100, lambda: 600 }).length, `n ${n}`).toBe(1 + Math.ceil(Math.log(1e-18 / ((1 - r * r) * r)) / Math.log(r * r)));
    }
  });

  it('sum to the closed series −r + (1 − r²)r·e^(iδ)/(1 − r²e^(iδ)), and the light through to (1 − r²)e^(iδ/2)/(1 − r²e^(iδ))', () => {
    for (const p of settings(200)) {
      const r = faceAmplitude(p.n);
      const d = roundTrip(p);
      // 1/(1 − r²e^(iδ)) = (1 − r²e^(−iδ))/|1 − r²e^(iδ)|²
      const den = (1 - r * r * Math.cos(d)) ** 2 + (r * r * Math.sin(d)) ** 2;
      const qr = (1 - r * r * Math.cos(d)) / den;
      const qi = (r * r * Math.sin(d)) / den;
      const k = (1 - r * r) * r;
      const back = total(reflected(p));
      expect(back.re).toBeCloseTo(-r + k * (Math.cos(d) * qr - Math.sin(d) * qi), 14);
      expect(back.im).toBeCloseTo(k * (Math.cos(d) * qi + Math.sin(d) * qr), 14);
      const k2 = 1 - r * r;
      const through = total(transmitted(p));
      expect(through.re).toBeCloseTo(k2 * (Math.cos(d / 2) * qr - Math.sin(d / 2) * qi), 14);
      expect(through.im).toBeCloseTo(k2 * (Math.cos(d / 2) * qi + Math.sin(d / 2) * qr), 14);
    }
  });
});

describe('amplitude-arrows: the rounding bounds at settings other than the claims\'', () => {
  it('arrows against Airy and R + T − 1 stay below the claims\' 3e−15 over 2000 settings', () => {
    let airyGap = 0;
    let energy = 0;
    for (const p of settings(2000)) {
      const R = probability(total(reflected(p)));
      airyGap = Math.max(airyGap, Math.abs(R - airy(p)));
      energy = Math.max(energy, Math.abs(R + probability(total(transmitted(p))) - 1));
    }
    expect(airyGap).toBeLessThan(claim('arrows-are-the-airy-formula').expect.below as number);
    expect(energy).toBeLessThan(claim('reflected-and-transmitted-add-to-one').expect.below as number);
  });

  it('the quarter-wave claims are 4r²/(1 + r²)² and r²(2 − r²)², the half-wave one 0', () => {
    const q = (n: number) => { const r = faceAmplitude(n); return (4 * r * r) / (1 + r * r) ** 2; };
    expect(claim('quarter-wave-reflects-most').expect.value).toBeCloseTo(q(1.5), 6);
    expect(claim('diamond-quarter-wave').expect.value).toBeCloseTo(q(2.4), 6);
    expect(claim('water-quarter-wave').expect.value).toBeCloseTo(q(1.33), 6);
    expect(claim('quarter-wave-two-arrows').expect.value).toBeCloseTo(0.2 ** 2 * (2 - 0.2 ** 2) ** 2, 6);
    expect(claim('half-wave-reflects-nothing').expect.value).toBe(0);
  });
});

describe('amplitude-arrows: a planted slip fails every claim', () => {
  it('the front face\'s arrow not turned half a turn (+r) moves every claim out of its band', async () => {
    type Arrows = typeof import('../src/plates/amplitude-arrows/arrows');
    vi.resetModules();
    vi.doMock('../src/plates/amplitude-arrows/arrows', async (orig) => {
      const m = await orig<Arrows>();
      return { ...m, reflected: (p: Plate, max?: number, tiny?: number) => {
        const a = m.reflected(p, max, tiny);
        a[0] = { re: -a[0].re, im: a[0].im };
        return a;
      } };
    });
    const planted = await import('./support/claims');
    const held: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length === 0) held.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/amplitude-arrows/arrows');
    vi.resetModules();
    expect(held, 'claims the planted slip did not fail').toEqual([]);
  });
});
