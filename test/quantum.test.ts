import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  Fft, packetTransmission, potential, transmission, Wave, type Potential,
} from '../src/plates/quantum-tunnelling/schrodinger';

/**
 * Textbook single rectangular barrier of height v0 and width a (Griffiths, Introduction to
 * Quantum Mechanics, 2nd ed., problem 2.33).
 */
function barrierT(e: number, v0: number, a: number): number {
  if (e < v0) {
    const s = Math.sinh(Math.sqrt(2 * (v0 - e)) * a);
    return 1 / (1 + (v0 * v0 * s * s) / (4 * e * (v0 - e)));
  }
  const s = Math.sin(Math.sqrt(2 * (e - v0)) * a);
  return 1 / (1 + (v0 * v0 * s * s) / (4 * e * (e - v0)));
}

/** Run until the barrier region (±margin) is empty; transmitted and reflected probability. */
function scatter(w: Wave, pot: Potential, margin = 30): { t: number; r: number } {
  const lo = pot.edges[0];
  const hi = pot.edges[pot.edges.length - 1];
  for (let i = 0; i < 4000 && w.probability(lo - margin, hi + margin) > 1e-7; i++) w.step(10);
  return {
    t: w.probability(hi) + w.absorbedRight,
    r: w.probability(-Infinity, lo) + w.absorbedLeft,
  };
}

describe('radix-2 FFT', () => {
  it('matches a naive O(n²) DFT on random input within 1e-9 and round-trips', () => {
    const rnd = mulberry32(42);
    for (const n of [2, 8, 64, 512]) {
      const re = Float64Array.from({ length: n }, () => rnd() * 2 - 1);
      const im = Float64Array.from({ length: n }, () => rnd() * 2 - 1);
      const r0 = re.slice();
      const i0 = im.slice();
      new Fft(n).transform(re, im);
      for (let k = 0; k < n; k++) {
        let sr = 0;
        let si = 0;
        for (let j = 0; j < n; j++) {
          const a = (-2 * Math.PI * j * k) / n;
          sr += r0[j] * Math.cos(a) - i0[j] * Math.sin(a);
          si += r0[j] * Math.sin(a) + i0[j] * Math.cos(a);
        }
        expect(Math.abs(re[k] - sr)).toBeLessThan(1e-9);
        expect(Math.abs(im[k] - si)).toBeLessThan(1e-9);
      }
      new Fft(n).transform(re, im, true);
      for (let j = 0; j < n; j++) {
        expect(Math.abs(re[j] - r0[j])).toBeLessThan(1e-12);
        expect(Math.abs(im[j] - i0[j])).toBeLessThan(1e-12);
      }
    }
  });

  it('refuses a length that is not a power of two', () => {
    expect(() => new Fft(48)).toThrow();
  });
});

describe('plane-wave transmission (transfer matrix)', () => {
  it('equals the closed-form rectangular-barrier T below and above the barrier', () => {
    for (const [e, v0, a] of [[0.4, 1, 1], [1.13, 1.2, 2], [0.9, 3, 0.5], [2, 0.5, 3],
      [5, 1, 7.3]]) {
      const pot: Potential = { edges: [-a / 2, a / 2], values: [0, v0, 0] };
      expect(Math.abs(transmission(e, pot) - barrierT(e, v0, a))).toBeLessThan(1e-12);
    }
  });

  it('equals 4k₁k₂/(k₁ + k₂)² for a potential step, and 0 below it', () => {
    const pot: Potential = { edges: [0], values: [0, 0.8] };
    const k1 = Math.sqrt(2 * 1.5);
    const k2 = Math.sqrt(2 * (1.5 - 0.8));
    expect(Math.abs(transmission(1.5, pot) - (4 * k1 * k2) / (k1 + k2) ** 2)).toBeLessThan(1e-12);
    expect(transmission(0.5, pot)).toBe(0);
  });

  it('falls off as (16E(V0 − E)/V0²)·e^{−2κa} through a thick barrier', () => {
    const [e, v0] = [0.8, 1.6];
    const kappa = Math.sqrt(2 * (v0 - e));
    for (const a of [6, 9, 12]) {
      const pot: Potential = { edges: [0, a], values: [0, v0, 0] };
      const wkb = ((16 * e * (v0 - e)) / (v0 * v0)) * Math.exp(-2 * kappa * a);
      expect(Math.abs(transmission(e, pot) / wkb - 1)).toBeLessThan(1e-6);
    }
  });

  it('makes a symmetric double barrier fully transparent at a resonance', () => {
    const pot = potential('double', 2, 1.5, 0.1);
    let best = 0;
    let at = 0;
    for (let e = 0.05; e < 1; e += 1e-5) {
      const t = transmission(e, pot);
      if (t > best) [best, at] = [t, e];
    }
    expect(best).toBeGreaterThan(0.999);
    // one of its two barriers alone lets through only T₁ there; incoherent sequential passage
    // would give at most T₁ again, so the near-unit peak is interference in the well
    const t1 = barrierT(at, 2, 1.5);
    expect(t1).toBeLessThan(0.1);
  });
});

describe('split-step Schrödinger integrator', () => {
  it('conserves the norm to 1e-9 over 1000 steps across a barrier (periodic grid)', () => {
    const pot = potential('single', 1.2, 2, 0.1);
    const w = new Wave({ n: 2048, dx: 0.1, dt: 0.05, absorb: 0 }, pot);
    w.gaussian(-20, 1.5, 5);
    w.step(1000);
    expect(Math.abs(w.norm() - 1)).toBeLessThan(1e-9);
  });

  it('keeps grid + absorbed probability at 1 to 1e-9 with absorbing edges', () => {
    const pot = potential('single', 1.2, 2, 0.1);
    const w = new Wave({ n: 2048, dx: 0.1, dt: 0.05, absorb: 160 }, pot);
    w.gaussian(-21, 1.5, 5);
    w.step(3000);
    expect(w.absorbedLeft + w.absorbedRight).toBeGreaterThan(0.5);
    expect(Math.abs(w.norm() + w.absorbedLeft + w.absorbedRight - 1)).toBeLessThan(1e-9);
  });

  it('spreads a free packet as σ√(1 + (t/2σ²)²) within 1 %, keeping ⟨k⟩ = k0', () => {
    const sigma = 2;
    const w = new Wave({ n: 4096, dx: 0.1, dt: 0.05, absorb: 0 },
      { edges: [], values: [0] });
    w.gaussian(-60, 1.2, sigma);
    expect(Math.abs(w.measure().momentum - 1.2)).toBeLessThan(1e-9);
    for (let s = 1; s <= 8; s++) {
      w.step(50);
      const want = sigma * Math.sqrt(1 + (w.t / (2 * sigma * sigma)) ** 2);
      expect(Math.abs(w.spread().width / want - 1)).toBeLessThan(0.01);
      expect(Math.abs(w.measure().momentum - 1.2)).toBeLessThan(1e-9);
    }
    // ⟨x⟩ moves at the group velocity k0
    expect(Math.abs(w.spread().mean - (-60 + 1.2 * w.t))).toBeLessThan(1e-6);
  });

  it('measures ⟨H⟩ of a Gaussian as k0²/2 + 1/(8σ²)', () => {
    const w = new Wave({ n: 2048, dx: 0.1, dt: 0.05, absorb: 0 },
      { edges: [], values: [0] });
    w.gaussian(0, 1.5, 5);
    expect(Math.abs(w.measure().energy - (1.5 ** 2 / 2 + 1 / (8 * 25)))).toBeLessThan(1e-9);
  });

  it('tends to the plane-wave T for a wide packet on a low barrier (E = 4 V0)', () => {
    // E = 2, V0 = 0.5, a = 3, σ = 20 so σ_k = 0.025. Averaging T over the packet's momenta
    // shifts it by ½T″σ_k² (first order cancels), which the closed form puts at ~4e-5; the
    // split-step and grid error measured on the default scene is ~1e-4. 5e-4 bounds both and
    // is still 1/30 of the reflection 1 − T = 0.016, so a solver that ignored the barrier fails.
    const pot = potential('single', 0.5, 3, 0.1);
    const w = new Wave({ n: 4096, dx: 0.1, dt: 0.05, absorb: 200 }, pot);
    w.gaussian(pot.edges[0] - 80, 2, 20);
    const { t, r } = scatter(w, pot);
    const tpw = barrierT(2, 0.5, pot.edges[1] - pot.edges[0]);
    expect(1 - tpw).toBeGreaterThan(0.015);
    expect(Math.abs(t - tpw)).toBeLessThan(5e-4);
    expect(Math.abs(t + r - 1)).toBeLessThan(1e-6);
  });

  it('tunnels as T averaged over the packet\'s momentum spread (E < V0)', () => {
    // A narrow packet (σ = 5) far from the plane-wave limit: the measured transmitted share
    // matches the momentum average of the transfer-matrix T, not T(⟨E⟩).
    const pot = potential('single', 1.2, 2, 0.1);
    const w = new Wave({ n: 4096, dx: 0.1, dt: 0.05, absorb: 200 }, pot);
    w.gaussian(pot.edges[0] - 20, 1.5, 5);
    const e0 = w.measure().energy;
    const { t } = scatter(w, pot);
    expect(Math.abs(t - packetTransmission(1.5, 5, pot))).toBeLessThan(1e-3);
    expect(Math.abs(t - transmission(e0, pot))).toBeGreaterThan(5e-3);
  });

  it('is deterministic: the same set-up gives bit-identical states', () => {
    const run = () => {
      const pot = potential('double', 1.2, 1, 0.1);
      const w = new Wave({ n: 2048, dx: 0.1, dt: 0.05, absorb: 160 }, pot);
      w.gaussian(-30, 1.5, 6);
      w.step(500);
      return [Array.from(w.re), Array.from(w.im), w.absorbedLeft, w.absorbedRight];
    };
    expect(run()).toEqual(run());
  });
});
