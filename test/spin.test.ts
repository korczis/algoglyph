// Finite quantum systems (src/plates/_shared/quantum/), against what angular momentum must obey
// and the closed forms of magnetic resonance: the commutators and J² of the spin-j matrices, the
// Larmor frequency, Rabi's formula against a lab-frame Crank–Nicolson integration of a rotating
// field, the sign a 2π rotation gives a half-integer spin and not an integer one, unitarity.
import { describe, expect, it } from 'vitest';
import {
  expectation, evolve, overlap, spinMatrices, spinUp, type Field,
} from '../src/plates/_shared/quantum/spin';

type C = { re: number[][]; im: number[][] };

const mul = (a: C, b: C): C => {
  const n = a.re.length;
  const re = Array.from({ length: n }, () => new Array(n).fill(0));
  const im = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    re[i][j] += a.re[i][k] * b.re[k][j] - a.im[i][k] * b.im[k][j];
    im[i][j] += a.re[i][k] * b.im[k][j] + a.im[i][k] * b.re[k][j];
  }
  return { re, im };
};

describe('spin-j matrices', () => {
  for (const j of [0.5, 1, 1.5, 2]) {
    it(`j = ${j}: [Jx, Jy] = i Jz and J² = j(j + 1)`, () => {
      const { x, y, z } = spinMatrices(j);
      const xy = mul(x, y);
      const yx = mul(y, x);
      const n = x.re.length;
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          // [Jx, Jy] = i Jz: real part 0, imaginary part Jz
          expect(xy.re[a][b] - yx.re[a][b]).toBeCloseTo(-z.im[a][b], 12);
          expect(xy.im[a][b] - yx.im[a][b]).toBeCloseTo(z.re[a][b], 12);
        }
      }
      const j2 = [x, y, z].map((m) => mul(m, m)).reduce((s, m) => ({
        re: s.re.map((r, a) => r.map((v, b) => v + m.re[a][b])),
        im: s.im.map((r, a) => r.map((v, b) => v + m.im[a][b])),
      }));
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          expect(j2.re[a][b]).toBeCloseTo(a === b ? j * (j + 1) : 0, 12);
          expect(j2.im[a][b]).toBeCloseTo(0, 12);
        }
      }
    });
  }
});

describe('spin dynamics', () => {
  const steps = 4000;

  it('precesses about a static field at the Larmor frequency γB, keeping its norm', () => {
    const gamma = 1;
    const B0 = 2;
    const field: Field = () => [0, 0, B0];
    // start along +x: ⟨Jx⟩ = j cos(γB t) for a spin ½ tilted into the plane
    const s = spinUp(0.5);
    const tilt = spinMatrices(0.5);
    const psi = evolve(s, tilt, () => [0, 1, 0], Math.PI / 2, 400, 1); // rotate |↑⟩ to +x about y
    const T = (2 * Math.PI) / (gamma * B0);
    const out = evolve(psi, tilt, field, T / 4, steps, gamma);
    // a quarter period turns +x into ±y; the sign is the sense of precession
    const [jx, jy] = [expectation(out, tilt.x), expectation(out, tilt.y)];
    expect(Math.abs(jx)).toBeLessThan(1e-6);
    expect(Math.abs(Math.abs(jy) - 0.5)).toBeLessThan(1e-6);
    const norm = out.re.reduce((t, v, i) => t + v * v + out.im[i] ** 2, 0);
    expect(Math.abs(norm - 1)).toBeLessThan(1e-12);
  });

  it('flips with Rabi’s probability (Ω₁²/Ω²) sin²(Ωt/2) in a rotating field, integrated in the lab', () => {
    const gamma = 1;
    const B0 = 10;
    const w0 = gamma * B0;
    const B1 = 0.5;
    const w1 = gamma * B1;
    for (const detune of [0, w1, 2 * w1]) {
      const w = w0 + detune;
      // H = −γB·J precesses a spin clockwise about +z, so the drive rotates the same way
      const field: Field = (t) => [B1 * Math.cos(w * t), -B1 * Math.sin(w * t), B0];
      const sp = spinMatrices(0.5);
      const Omega = Math.hypot(w1, detune);
      const T = Math.PI / Omega; // the first maximum
      const out = evolve(spinUp(0.5), sp, field, T, 20_000, gamma);
      const pDown = out.re[1] ** 2 + out.im[1] ** 2;
      expect(Math.abs(pDown - (w1 * w1) / (Omega * Omega)), `Δ = ${detune}`).toBeLessThan(1e-4);
    }
  });

  it('a 2π rotation turns a spin ½ into minus itself, a spin 1 into itself; 4π restores both', () => {
    for (const [j, turns, sign] of [[0.5, 1, -1], [0.5, 2, 1], [1, 1, 1]] as const) {
      const sp = spinMatrices(j);
      const start = spinUp(j);
      const out = evolve(start, sp, () => [1, 0, 0], 2 * Math.PI * turns, 4000, 1);
      const o = overlap(start, out);
      expect(o.re, `j ${j}, ${turns} turns`).toBeCloseTo(sign, 6);
      expect(o.im).toBeCloseTo(0, 6);
    }
  });
});
