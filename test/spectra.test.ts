// spectra (catalogue/entries/spectra.md) beyond the entry's claims: the Voigt profile against
// brute-force quadrature, erfcx's two branches against each other, the recording against the
// closed-form instrument and against a periodised Lorentzian integrated by trapezoids, the claims'
// expected values against their closed forms, the fit's bound over every ratio of the widths, and
// two planted slips that between them fail every claim through the instrument.
import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  dopplerSigma, erfcx, lamp, measuredFwhm, oliveroFwhm, recorded, unbroadened, voigt, voigtPeak, type Grating, type Line,
} from '../src/plates/spectra/lines';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'spectra';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const claim = (id: string) => claims.find((c) => c.id === id)!;

/** The Gaussian's FWHM in closed form, from the constants written out again. */
const dopplerFwhm = (lambda: number, T: number, mass: number) =>
  lambda * Math.sqrt((8 * Math.log(2) * 1.380649e-23 * T) / (mass * 1.6605390666e-27 * 299792458 ** 2));

/** The instrument written out again: sin²(Nφ/2)/(N² sin²(φ/2)), φ = 2πmΔ/λ̄. */
const fejer = (delta: number, mean: number, N: number, m: number) => {
  // its period is π in h: reduce first, or sin(h) near a whole turn is only good to 1e−16 absolute
  const raw = (Math.PI * m * delta) / mean;
  const h = raw - Math.PI * Math.round(raw / Math.PI);
  return Math.abs(Math.sin(h)) < 1e-300 ? 1 : (Math.sin(N * h) / (N * Math.sin(h))) ** 2;
};

describe('spectra: the line\'s shape', () => {
  it('meets brute-force quadrature of the Gaussian against the Lorentzian within 1e−11 of its peak', () => {
    const s = 0.8;
    for (const ratio of [0.1, 0.5, 1, 3, 10]) {
      const g = ratio * s;
      const peak = voigt(0, s, g);
      for (const x of [0, 0.3, 1, 2, 3, 5, 8]) {
        // ∫ e^(−u²/2)/√2π · L(x − σu) du by trapezoids, fine against the Lorentzian's width
        const h = Math.min(0.01, ratio / 20);
        let v = 0;
        for (let u = -12; u <= 12; u += h) {
          const t = x * s - s * u;
          v += (Math.exp(-u * u / 2) / Math.sqrt(2 * Math.PI)) * (g / Math.PI) / (t * t + g * g) * h;
        }
        expect(Math.abs(voigt(x * s, s, g) - v) / peak, `γ/σ ${ratio}, x ${x}σ`).toBeLessThan(1e-11);
      }
    }
  });

  it('is the Gaussian itself with no Lorentzian, within 1e−14 of its peak', () => {
    const s = 0.8;
    for (const x of [0, 0.5, 1, 2, 4]) {
      const gauss = Math.exp(-(x * x) / 2) / (s * Math.sqrt(2 * Math.PI));
      expect(Math.abs(voigt(x * s, s, 0) - gauss) * s).toBeLessThan(1e-14);
    }
  });

  it('erfcx\'s series and continued fraction agree where both hold, within 1e−13', () => {
    // erfcx takes the continued fraction from 1 on: carry erf's series up to 1.5 and compare
    const series = (y: number) => {
      let term = y; let sum = y;
      for (let n = 1; n < 200; n++) { term *= (-y * y) / n; sum += term / (2 * n + 1); }
      return Math.exp(y * y) * (1 - (2 / Math.sqrt(Math.PI)) * sum);
    };
    for (const y of [1, 1.2, 1.5]) expect(Math.abs(erfcx(y) - series(y)) / series(y), `y ${y}`).toBeLessThan(1e-13);
    // and below 1 the continued fraction, carried 2000 deep, against the series branch
    const cf = (y: number) => { let t = y; for (let n = 2000; n >= 1; n--) t = y + n / 2 / t; return 1 / (Math.sqrt(Math.PI) * t); };
    for (const y of [0.6, 0.8, 0.99]) expect(Math.abs(erfcx(y) - cf(y)) / cf(y), `y ${y}`).toBeLessThan(1e-12);
    expect(erfcx(0)).toBe(1);
  });

  it('meets erfcx at its peak within the claims\' 1e−13 over 500 settings other than theirs', () => {
    const rnd = mulberry32(31);
    let worst = 0;
    for (let i = 0; i < 500; i++) {
      const s = 0.2 + rnd() * 5;
      const g = rnd() * 10;
      worst = Math.max(worst, Math.abs(voigt(0, s, g) - voigtPeak(s, g)) / voigtPeak(s, g));
    }
    expect(worst).toBeLessThan(claim('voigt-peak-is-erfcx').expect.below as number);
  });

  it('is within Olivero and Longbothum\'s 2.5e−4 at every ratio of the widths from 1e−3 to 1e3', () => {
    const s = 1;
    let worst = 0;
    for (let i = 0; i <= 600; i++) {
      const g = s * 10 ** (-3 + (6 * i) / 600);
      const f = measuredFwhm(s, g);
      worst = Math.max(worst, Math.abs(f - oliveroFwhm(2 * Math.sqrt(2 * Math.log(2)) * s, 2 * g)) / f);
    }
    expect(worst).toBeLessThan(claim('voigt-width-olivero').expect.below as number);
    expect(worst).toBeGreaterThan(1e-4);
  });
});

describe('spectra: the recording', () => {
  const at = (from: number, to: number, n: number) => Float64Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

  it('of lines of no width is the closed-form instrument, within N² × 5e−17', () => {
    const L = lamp('sodium');
    for (const g of [{ grooves: 100, order: 1 }, { grooves: 1000, order: 1 }, { grooves: 2999, order: 3 }] as Grating[]) {
      const x = at(587000, 591500, 301);
      const rec = recorded(x, L.lines, [0, 0], 0, g);
      const ideal = unbroadened(x, L.lines, g);
      const mean = (L.lines[0].lambda + L.lines[1].lambda) / 2;
      for (let i = 0; i < x.length; i++) {
        const want = L.lines.reduce((a, l) => a + l.weight * fejer(x[i] - l.lambda, mean, g.grooves, g.order), 0);
        // Clenshaw's recurrence over N terms loses up to N² roundings where cos θ is near 1, at a line
        expect(Math.abs(rec[i] - want), `N ${g.grooves}, ${x[i]} pm`).toBeLessThan(g.grooves ** 2 * 5e-17);
        expect(Math.abs(ideal[i] - want)).toBeLessThan(1e-14);
      }
    }
  });

  it('of a Lorentzian line is its periodised shape integrated against the instrument, within 1e−11', () => {
    // over the instrument's period P = λ̄/m the Lorentzian's copies sum to
    // sinh(2πγ/P)/(P(cosh(2πγ/P) − cos(2πt/P))): a smooth periodic integrand, which trapezoids
    // integrate to rounding
    const line: Line[] = [{ lambda: 500000, weight: 1 }];
    const g: Grating = { grooves: 50, order: 1 };
    const P = 500000;
    for (const gamma of [200, 2000, 20000]) {
      const x = at(500000 - 30000, 500000 + 30000, 13);
      const rec = recorded(x, line, [0], gamma, g);
      const a = (2 * Math.PI * gamma) / P;
      const M = 20000;
      for (let i = 0; i < x.length; i++) {
        let v = 0;
        for (let k = 0; k < M; k++) {
          const t = (P * k) / M;
          const per = Math.sinh(a) / (P * (Math.cosh(a) - Math.cos((2 * Math.PI * t) / P)));
          v += per * fejer(x[i] - line[0].lambda - t, P, g.grooves, g.order) * (P / M);
        }
        // the line's shape has area 1, so the recording is ∫ L(t)F(x − t) dt itself
        expect(Math.abs(rec[i] - v), `γ ${gamma}, ${x[i]}`).toBeLessThan(1e-11);
      }
    }
  });
});

describe('spectra: the claims\' expected values', () => {
  it('are the closed forms', () => {
    const na = lamp('sodium'); const hg = lamp('mercury');
    expect(claim('doppler-width-sodium').expect.value).toBeCloseTo(dopplerFwhm(na.lines[0].lambda, 500, na.mass), 5);
    expect(claim('doppler-width-mercury').expect.value).toBeCloseTo(dopplerFwhm(hg.lines[0].lambda, 300, hg.mass), 5);
    const dip = (id: string, N: number) => {
      const [a, b] = lamp(id).lines;
      const mean = (a.lambda + b.lambda) / 2; const d = b.lambda - a.lambda;
      return ((a.weight + b.weight) * fejer(d / 2, mean, N, 1)) / (a.weight + b.weight * fejer(d, mean, N, 1));
    };
    expect(claim('sodium-dip-at-1000').expect.value).toBeCloseTo(dip('sodium', 1000), 6);
    expect(claim('mercury-dip-at-300').expect.value).toBeCloseTo(dip('mercury', 300), 6);
    // the sigma the plate uses is the closed form's
    expect(2 * Math.sqrt(2 * Math.log(2)) * dopplerSigma(na.lines[0].lambda, 500, na.mass)).toBeCloseTo(dopplerFwhm(na.lines[0].lambda, 500, na.mass), 12);
  });
});

describe('spectra: planted slips fail every claim between them', () => {
  type Lines = typeof import('../src/plates/spectra/lines');
  const failing = async (mock: (m: Lines) => Partial<Lines>) => {
    vi.resetModules();
    vi.doMock('../src/plates/spectra/lines', async (orig) => { const m = await orig<Lines>(); return { ...m, ...mock(m) }; });
    const planted = await import('./support/claims');
    const failed: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length > 0) failed.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/spectra/lines');
    vi.resetModules();
    return failed;
  };

  it('σ√2 written σ in the profile fails the widths and the peaks; a groove lost in the recording fails the dips', async () => {
    const profileSlip = await failing((m) => ({
      voigt: (x: number, s: number, g: number) => m.voigt(x, s / Math.SQRT2, g) / Math.SQRT2,
      measuredFwhm: (s: number, g: number) => m.measuredFwhm(s / Math.SQRT2, g),
    }));
    expect(profileSlip.sort()).toEqual(['doppler-width-mercury', 'doppler-width-sodium', 'voigt-peak-is-erfcx', 'voigt-peak-wide-lorentzian', 'voigt-width-olivero']);
    const grooveSlip = await failing((m) => ({
      recorded: (at: Float64Array, lines: Line[], sigmas: number[], gamma: number, g: Grating) => m.recorded(at, lines, sigmas, gamma, { ...g, grooves: g.grooves - 1 }),
    }));
    expect(grooveSlip.sort()).toEqual(['mercury-dip-at-300', 'sodium-dip-at-1000']);
    expect(new Set([...profileSlip, ...grooveSlip]).size).toBe(claims.length);
  });
});
