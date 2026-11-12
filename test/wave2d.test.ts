// The damped 2-D wave solver (src/plates/_shared/wave2d/), against what the scheme itself
// promises: it refuses a Courant number above the 2-D limit, its discrete energy is conserved
// without damping and only falls with it, it is linear (two sources make the sum of their fields),
// and a plane wave on the grid travels with the wavenumber its own dispersion relation gives.
import { describe, expect, it } from 'vitest';
import {
  CourantError, energy, MAX_COURANT, numericalWavenumber, stepField, waveField, type Source,
} from '../src/plates/_shared/wave2d/wave';

describe('wave2d: stability', () => {
  it('refuses a Courant number above 1/√2, and a non-positive or non-finite one', () => {
    expect(MAX_COURANT).toBeCloseTo(Math.SQRT1_2, 15);
    for (const c of [0.71, 0.75, 1, Number.NaN, 0, -0.2]) {
      expect(() => waveField({ w: 20, h: 20, courant: c }), String(c)).toThrow(CourantError);
    }
    expect(() => waveField({ w: 20, h: 20, courant: 0.7 })).not.toThrow();
  });
});

describe('wave2d: energy', () => {
  const pulse = (damping: number) => {
    const f = waveField({ w: 64, h: 48, courant: 0.5, damping, sponge: 0 });
    for (let y = 1; y < f.h - 1; y++) {
      for (let x = 1; x < f.w - 1; x++) {
        const v = Math.exp(-((x - 20) ** 2 + (y - 24) ** 2) / 8);
        f.u[y * f.w + x] = v;
        f.prev[y * f.w + x] = v;
      }
    }
    return f;
  };

  it('is conserved to rounding with no damping in a closed box', () => {
    const f = pulse(0);
    stepField(f);
    const e0 = energy(f);
    for (let i = 0; i < 2000; i++) stepField(f);
    expect(Math.abs(energy(f) / e0 - 1)).toBeLessThan(1e-11);
  });

  it('never rises with damping, and falls about as e^(−γt)', () => {
    const gamma = 0.002;
    const f = pulse(gamma);
    stepField(f);
    const e0 = energy(f);
    let last = e0;
    for (let i = 0; i < 1000; i++) {
      stepField(f);
      const e = energy(f);
      expect(e).toBeLessThanOrEqual(last * (1 + 1e-12));
      last = e;
    }
    const rate = -Math.log(last / e0) / 1000;
    expect(Math.abs(rate / gamma - 1)).toBeLessThan(0.1);
  });
});

describe('wave2d: linearity and dispersion', () => {
  it('two soft sources make exactly the sum of each one’s field', () => {
    const omega = (2 * Math.PI * 0.5) / 12;
    const a: Source = { index: 20 * 60 + 15, amplitude: 1, phase: 0 };
    const b: Source = { index: 40 * 60 + 15, amplitude: 0.6, phase: 1.1 };
    const make = () => waveField({ w: 60, h: 60, courant: 0.5, damping: 0.001, sponge: 10 });
    const both = make();
    const one = make();
    const two = make();
    for (let t = 0; t < 300; t++) {
      stepField(both, [a, b], omega);
      stepField(one, [a], omega);
      stepField(two, [b], omega);
    }
    let worst = 0;
    for (let i = 0; i < both.u.length; i++) worst = Math.max(worst, Math.abs(both.u[i] - one.u[i] - two.u[i]));
    expect(worst).toBeLessThan(1e-12);
  });

  it('the numerical wavenumber solves the scheme’s dispersion relation, and shrinks to ω/c on fine grids', () => {
    const c = 0.5;
    for (const lambda of [8, 12, 20, 40]) {
      const omega = (2 * Math.PI * c) / lambda;
      for (const theta of [0, Math.PI / 8, Math.PI / 4]) {
        const k = numericalWavenumber(omega, c, theta);
        const lhs = Math.sin(omega / 2) ** 2;
        const rhs = c * c * (Math.sin((k * Math.cos(theta)) / 2) ** 2 + Math.sin((k * Math.sin(theta)) / 2) ** 2);
        expect(Math.abs(lhs - rhs)).toBeLessThan(1e-14);
      }
      // the grid's error falls like (k Δx)², here against the continuum ω/c
      const rel = numericalWavenumber(omega, c, 0) / (omega / c) - 1;
      expect(rel).toBeGreaterThan(0);
      expect(rel).toBeLessThan(((2 * Math.PI) / lambda) ** 2 / 24 * (1 - c * c) * 1.2);
    }
  });

  it('a plane wave driven on a line travels with the scheme’s wavenumber', () => {
    const c = 0.5;
    const lambda = 12;
    const omega = (2 * Math.PI * c) / lambda;
    const w = 400;
    const h = 3;
    const f = waveField({ w, h, courant: c, damping: 0, sponge: 60, periodicY: true });
    const line: Source[] = [0, 1, 2].map((y) => ({ index: y * w + 70, amplitude: 1, phase: 0 }));
    // lock-in along the line once steady
    const re = new Float64Array(w);
    const im = new Float64Array(w);
    for (let t = 0; t < 4000; t++) {
      stepField(f, line, omega);
      if (t >= 2000) {
        for (let x = 0; x < w; x++) {
          re[x] += f.u[w + x] * Math.cos(omega * f.step);
          im[x] += f.u[w + x] * Math.sin(omega * f.step);
        }
      }
    }
    let sum = 0;
    let n = 0;
    let prev = Math.atan2(im[100], re[100]);
    let unwrapped = prev;
    const xs: number[] = [];
    const ph: number[] = [];
    for (let x = 100; x < 300; x++) {
      const p = Math.atan2(im[x], re[x]);
      let d = p - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      unwrapped += d;
      prev = p;
      xs.push(x);
      ph.push(unwrapped);
      sum += x;
      n++;
    }
    const mx = sum / n;
    const my = ph.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ph[i] - my);
      sxx += (xs[i] - mx) ** 2;
    }
    const kMeasured = Math.abs(sxy / sxx);
    expect(Math.abs(kMeasured / numericalWavenumber(omega, c, 0) - 1)).toBeLessThan(2e-3);
  });
});

describe('wave2d: fringe geometry', () => {
  it('finds extrema with parabolic sub-cell positions', async () => {
    const { extrema } = await import('../src/plates/_shared/wave2d/fringes');
    const I = Float64Array.from({ length: 200 }, (_, i) => 1 + Math.cos((2 * Math.PI * (i - 100.3)) / 37));
    const { maxima, minima } = extrema(I, 5, 195);
    const near = maxima.map((m) => m.at).find((x) => Math.abs(x - 100.3) < 5)!;
    expect(Math.abs(near - 100.3)).toBeLessThan(0.05);
    expect(minima.length).toBeGreaterThan(3);
  });

  it('predicts the maxima of two in-phase sources at the far-field spacing when the grid is fine', async () => {
    const { predictedMaxima } = await import('../src/plates/_shared/wave2d/fringes');
    const { fringePeriod } = await import('../src/plates/_shared/two-slit/screen');
    // a long throw and a long wavelength: exact paths and the continuum agree with λL/d
    const c = 0.5;
    const lambda = 400;
    const omega = (2 * Math.PI * c) / lambda;
    const L = 1e6;
    const d = 50_000;
    const ms = predictedMaxima({ sources: [{ x: 0, y: -d / 2, phase: 0 }, { x: 0, y: d / 2, phase: 0 }],
      detectorX: L, from: -2e4, to: 2e4, omega, courant: c, continuum: true });
    const spacing = (ms[ms.length - 1] - ms[0]) / (ms.length - 1);
    expect(Math.abs(spacing / fringePeriod({ lambda, d, a: 0, L }) - 1)).toBeLessThan(1e-3);
    // the central maximum is on the axis, and a phase shifts it by phase/2π of a fringe
    expect(Math.min(...ms.map(Math.abs))).toBeLessThan(1);
    const shifted = predictedMaxima({ sources: [{ x: 0, y: -d / 2, phase: 0 }, { x: 0, y: d / 2, phase: Math.PI / 2 }],
      detectorX: L, from: -2e4, to: 2e4, omega, courant: c, continuum: true });
    const centre = shifted.reduce((b, x) => (Math.abs(x) < Math.abs(b) ? x : b), Infinity);
    expect(Math.abs(Math.abs(centre) - fringePeriod({ lambda, d, a: 0, L }) / 4) / (fringePeriod({ lambda, d, a: 0, L }) / 4)).toBeLessThan(1e-2);
  });
});
