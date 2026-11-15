// A medium of bound electrons (src/plates/_shared/lumped/medium.ts) held to what it does not compute:
// the lock-in's measured response against the Lorentz sum written out, the Kramers–Kronig transform
// against the closed form's own real part with its error measured to fall as the band widens and the
// grid refines, the f-sum, the Clausius–Mossotti shift of the absorption peak by an independent
// golden-section search, the Drude plasma edge, and Rayleigh's ω⁴.
import { describe, expect, it } from 'vitest';
import {
  fSum, index, kramersKronig, localField, LockIn, logSlope, lorentz, measuredChi, measuredResponse, type Medium,
} from '../src/plates/_shared/lumped/medium';
import { lockIn } from '../src/plates/_shared/lumped/oscillator';
import { mediumOf } from '../src/plates/bound-electron-medium/plate';

const one: Medium = { wp2: 0.5, resonances: [{ w0: 1, f: 1, gamma: 0.1 }], dense: false };

describe('bound-electron-medium: the measured response', () => {
  it('the resumable lock-in is the driven oscillator’s lock-in, step for step, however it is cut', () => {
    for (const [w0, gamma, w] of [[1, 0.1, 0.8], [2, 0.05, 3], [0, 0.1, 0.5]]) {
      const l = new LockIn({ w0, f: 1, gamma }, w);
      while (!l.advance(997));
      const ref = lockIn({ m: 1, omega0: w0, gamma, F0: 1, pendulum: false }, w);
      // the same steps and sums; only the polar-to-Cartesian round trip differs, in the last place
      expect(Math.abs(Math.hypot(l.result!.re, l.result!.im) / ref.amplitude - 1)).toBeLessThan(1e-14);
      expect(Math.atan2(l.result!.im, l.result!.re)).toBeCloseTo(ref.phase, 14);
    }
  });

  it('the lock-in of each electron gives the Lorentz sum, real and imaginary parts', () => {
    for (const w of [0.3, 0.9, 1, 1.2, 2.5]) {
      const m = measuredChi(one, w);
      // the sum written out here: f ω_p² / (ω₀² − ω² − iγω)
      const a = 1 - w * w;
      const b = 0.1 * w;
      const d = a * a + b * b;
      expect(Math.abs(m.re - (0.5 * a) / d), `ω ${w}`).toBeLessThan(2e-6 * Math.max(1, Math.abs((0.5 * a) / d)));
      expect(Math.abs(m.im - (0.5 * b) / d), `ω ${w}`).toBeLessThan(2e-6 * Math.max(1, (0.5 * b) / d));
    }
  });

  it('the index is the root of 1 + χ that decays: n² − κ² = 1 + Re χ, 2nκ = Im χ, κ ≥ 0', () => {
    for (const c of [{ re: 0.5, im: 0.1 }, { re: -3, im: 0.01 }, { re: -0.5, im: 2 }]) {
      const n = index(c);
      expect(n.im).toBeGreaterThanOrEqual(0);
      expect(Math.abs(n.re * n.re - n.im * n.im - 1 - c.re)).toBeLessThan(1e-12);
      expect(Math.abs(2 * n.re * n.im - c.im)).toBeLessThan(1e-12);
    }
  });
});

describe('bound-electron-medium: causality', () => {
  /** The worst gap of the Kramers–Kronig Re χ from the closed form below 3 ω₀, on K points up to W. */
  function kkGap(K: number, W: number): number {
    const d = W / K;
    const im = new Float64Array(K);
    for (let k = 0; k < K; k++) im[k] = lorentz(one, k * d).im;
    const kk = kramersKronig(im);
    let worst = 0;
    for (let k = 1; k * d < 3; k++) worst = Math.max(worst, Math.abs(kk[k] - lorentz(one, k * d).re));
    return worst;
  }

  it('recovers Re χ from Im χ, the error falling as the band widens and the grid refines', () => {
    const coarse = kkGap(512, 8);
    const fine = kkGap(2048, 16);
    expect(coarse).toBeLessThan(0.01);
    expect(fine).toBeLessThan(coarse / 3);
  });

  it('the f-sum counts the electrons: ∫ω Im χ dω = (π/2)ω_p² Σf, however they are shared', () => {
    for (const m of [one, mediumOf('glass', 0.1, 0.8, false)]) {
      const ws = Array.from({ length: 4096 }, (_, k) => (k * 16) / 4096);
      const im = ws.map((w) => lorentz(m, w).im);
      const want = (Math.PI / 2) * m.wp2 * m.resonances.reduce((s, r) => s + r.f, 0);
      expect(Math.abs(fSum(ws, im) / want - 1)).toBeLessThan(2e-4);
    }
  });
});

describe('bound-electron-medium: dense matter, metals and the sky', () => {
  it('the local field moves the absorption peak to √(ω₀² − fω_p²/3), found by golden-section search', () => {
    // a narrow line, so the Lorentzian's own offset of its peak is negligible
    const m: Medium = { wp2: 1.5, resonances: [{ w0: 1, f: 1, gamma: 0.01 }], dense: true };
    let a = 0.5;
    let b = 1;
    const g = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 200; i++) {
      const c = b - g * (b - a);
      const d = a + g * (b - a);
      if (lorentz(m, c).im > lorentz(m, d).im) b = d; else a = c;
    }
    expect(Math.abs((a + b) / 2 - Math.sqrt(1 - 1.5 / 3))).toBeLessThan(1e-4);
    // and the local-field formula is Clausius–Mossotti: (ε − 1)/(ε + 2) = χₗ/3
    const chiL = lorentz({ ...m, dense: false }, 0.6);
    const chi = localField(chiL);
    const er = 1 + chi.re;
    const ei = chi.im;
    // (ε − 1)/(ε + 2) as a complex quotient
    const den = (er + 2) ** 2 + ei ** 2;
    expect(Math.abs(((er - 1) * (er + 2) + ei * ei) / den - chiL.re / 3)).toBeLessThan(1e-12);
    expect(Math.abs((ei * (er + 2) - (er - 1) * ei) / den - chiL.im / 3)).toBeLessThan(1e-12);
  });

  it('free electrons: Re ε = 1 − ω_p²/(ω² + γ²), zero at √(ω_p² − γ²), measured by the lock-in', () => {
    const m = mediumOf('plasma', 0.1, 2, false);
    const edge = Math.sqrt(2 - 0.01);
    expect(Math.abs(1 + measuredChi(m, edge).re)).toBeLessThan(1e-5);
    expect(1 + measuredChi(m, 0.7 * edge).re).toBeLessThan(-0.5);
  });

  it('Rayleigh: the radiated power ω⁴|x|² rises with slope 4 far below the resonance, closer as ω falls', () => {
    const r = one.resonances[0];
    const slope = (xs: number[]) => logSlope(xs, xs.map((w) => { const x = measuredResponse(r, w); return w ** 4 * (x.re ** 2 + x.im ** 2); }));
    const high = slope([0.1, 0.12, 0.14, 0.16, 0.2]);
    const low = slope([0.05, 0.06, 0.07, 0.08, 0.1]);
    expect(Math.abs(low - 4)).toBeLessThan(Math.abs(high - 4) / 3);
    expect(low).toBeGreaterThan(3.99);
    expect(low).toBeLessThan(4.05);
  });
});
