// The Fraunhofer far field (src/plates/_shared/optics/fraunhofer.ts) beyond the entry's claims: the
// two-dimensional FFT against a direct double sum, the Dirichlet kernel's zeros at exactly mG/n,
// the Airy constant against the published first zero of J₁, the band of the pixel disc's ring
// over holes other than the claim's, and a reader's profile run by the plate.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { optionValue, parseData } from '../src/core/data';
import { GROUNDS, palette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import {
  amplitude, blank, disc, farField, firstZero, projection, slits,
} from '../src/plates/_shared/optics/fraunhofer';
import { airyConstant, farFieldDiffraction as plate } from '../src/plates/far-field-diffraction/plate';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

describe('far-field-diffraction: the transform', () => {
  it('is the direct double sum |Σ t e^(−2πi(kx + ly)/G)|², shifted to the centre', () => {
    const G = 16;
    const ap = blank(G);
    const rnd = mulberry32(3);
    for (let i = 0; i < G * G; i++) ap.t[i] = rnd() < 0.3 ? rnd() : 0;
    const I = farField(ap);
    for (let l = 0; l < G; l++) for (let k = 0; k < G; k++) {
      let re = 0;
      let im = 0;
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const ph = (-2 * Math.PI * (k * x + l * y)) / G;
        re += ap.t[y * G + x] * Math.cos(ph);
        im += ap.t[y * G + x] * Math.sin(ph);
      }
      const at = ((l + G / 2) % G) * G + ((k + G / 2) % G);
      expect(I[at]).toBeCloseTo(re * re + im * im, 9);
    }
  });

  it('puts a slit of n cells\' zeros at exactly k = mG/n, as the continuous slit\'s', () => {
    const G = 256;
    for (const n of [3, 8, 13, 40]) {
      const pr = projection(slits(G, 1, n, 0, 10), 'x');
      for (const m of [1, 2]) {
        const k = firstZero((q) => amplitude(G, pr, q), ((m - 0.5) * G) / n, 0.05, G / 2);
        if ((m * G) / n < G / 2) expect(k).toBeCloseTo((m * G) / n, 9);
      }
    }
  });
});

describe('far-field-diffraction: the Airy ring', () => {
  it('has the constant j₁,₁/π from J₁\'s series, against the published j₁,₁ = 3.8317059702075123', () => {
    expect(airyConstant()).toBeCloseTo(3.8317059702075123 / Math.PI, 14);
  });

  it('finds the pixel disc\'s ring at 1.21967λ/D for its area\'s diameter within 2.4e−4, at holes other than the claim\'s', () => {
    const G = 256;
    const A = airyConstant();
    let worstArea = 0;
    let worstDrawn = 0;
    for (const D of [8, 12, 16, 20, 24, 32, 40, 56, 64, 80, 96, 128, 160]) {
      const ap = disc(G, D);
      const n = ap.t.reduce((s, v) => s + v, 0);
      const ring = (along: 'x' | 'diagonal') => firstZero((q) => amplitude(G, projection(ap, along), q), 0, 0.25, G / 2)!;
      const mean = (ring('x') + ring('diagonal')) / 2;
      worstArea = Math.max(worstArea, Math.abs(mean / ((A * G) / (2 * Math.sqrt(n / Math.PI))) - 1));
      if (D >= 32) worstDrawn = Math.max(worstDrawn, Math.abs(mean / ((A * G) / D) - 1));
    }
    expect(worstArea).toBeLessThan(2.4e-4);
    expect(worstDrawn).toBeLessThan(5e-3);
  });
});

describe('far-field-diffraction: a reader\'s profile', () => {
  const decl = ENTRIES.find((e) => e.id === 'far-field-diffraction')!.data[0];
  function drive(over: Params, csv: string): Stat[] {
    const r = parseData(decl, csv);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const params: Params = { ...defaults(plate as never), pace: 4096, aperture: optionValue('profile'), ...over };
    let rows: Stat[] = [];
    const ctx: PlateContext = {
      width: 800, height: 450, params, seed: 1, rnd: mulberry32(1), theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg,
      thumbnail: false, palette: () => palette('spectral'), stats(s) { rows = s; }, chart() {}, data: () => r.table,
    };
    const sim = plate.create(p5Stub(), ctx);
    sim.setup();
    for (let i = 0; i < 2000 && !sim.pace!().done; i++) sim.draw();
    sim.draw();
    return rows;
  }

  it('transforms the profile: a 16 µm open run has its first minimum at the FFT bin nearest λ/a', () => {
    const rows = drive({}, `t\n${Array.from({ length: 16 }, () => 1).join('\n')}`);
    expect(rows.find((s) => s.label === 'Input')?.value).toBe('your data, a profile of 16 µm');
    // a 16-cell slit has its zero at bin 256/16 = 16 exactly: sin θ = 16 · 0.5/256
    expect(rows.find((s) => s.label === 'first minimum of the x cut, sin θ, at the FFT’s bins')?.value).toBe((16 * 0.5 / 256).toFixed(9));
  });
});
