import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  deltaE, energy, energyHundredths, lattice, magnetisation, spinSum, spontaneousMagnetisation, sweep, T_CRITICAL,
  type Lattice,
} from '../src/plates/ising-model/ising';
import { FieldSweep } from '../src/plates/ising-model/field-sweep';

// Independent brute force: sum over every site's right and lower bond, written from scratch.
function bruteEnergy(s: ArrayLike<number>, w: number, h: number, field: number): number {
  let e = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = s[y * w + x];
      e -= v * s[y * w + ((x + 1) % w)];
      e -= v * s[((y + 1) % h) * w + x];
      e -= field * v;
    }
  }
  return e;
}

function agm(a: number, b: number): number {
  while (Math.abs(a - b) > 1e-15 * a) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

// Onsager's internal energy per spin of the infinite lattice (h = 0), with K from the AGM.
function onsagerEnergy(t: number): number {
  const b2 = 2 / t;
  const k = 2 * Math.sinh(b2) / Math.cosh(b2) ** 2;
  const bigK = Math.PI / (2 * agm(1, Math.sqrt(1 - k * k)));
  const th = Math.tanh(b2);
  return -(1 / th) * (1 + (2 / Math.PI) * (2 * th * th - 1) * bigK);
}

function run(l: Lattice, t: number, field: number, sweeps: number, rnd: () => number) {
  for (let k = 0; k < sweeps; k++) sweep(l, t, field, rnd);
}

describe('ising model', () => {
  it('Tc is Onsager\'s 2 / ln(1 + √2) ≈ 2.269', () => {
    expect(T_CRITICAL).toBeCloseTo(2.269185, 5);
  });

  it('the all-up state has energy −2 per spin and m = 1 at h = 0, −2 − h with a field', () => {
    const l = lattice(17, 11, 'ordered', mulberry32(1));
    expect(energy(l, 0) / l.s.length).toBe(-2);
    expect(magnetisation(l)).toBe(1);
    expect(energy(l, 0.4) / l.s.length).toBeCloseTo(-2.4, 12);
  });

  it('energy() agrees with the brute-force sum on random lattices, odd sizes included', () => {
    const rnd = mulberry32(3);
    for (const [w, h] of [[8, 8], [9, 5], [3, 7]]) {
      const l = lattice(w, h, 'random', rnd);
      expect(energy(l, 0.3)).toBeCloseTo(bruteEnergy(l.s, w, h, 0.3), 10);
    }
  });

  it('ΔE of a flip equals the brute-force energy difference of the whole lattice', () => {
    const rnd = mulberry32(11);
    for (const [w, h] of [[16, 16], [7, 5], [3, 3]]) {
      const l = lattice(w, h, 'random', rnd);
      for (let trial = 0; trial < 200; trial++) {
        const field = rnd() * 2 - 1;
        const i = Math.floor(rnd() * l.s.length);
        const before = bruteEnergy(l.s, w, h, field);
        const predicted = deltaE(l, i, field);
        l.s[i] = -l.s[i];
        expect(predicted).toBeCloseTo(bruteEnergy(l.s, w, h, field) - before, 10);
      }
    }
  });

  it('at T = 1 an ordered 32×32 lattice keeps |m| above 0.9 over 500 sweeps', () => {
    const rnd = mulberry32(7);
    const l = lattice(32, 32, 'ordered', rnd);
    for (let k = 0; k < 500; k++) {
      sweep(l, 1, 0, rnd);
      expect(Math.abs(magnetisation(l))).toBeGreaterThan(0.9);
    }
  });

  it('at T = 5 a random 32×32 lattice has |m| below 0.2 after 300 sweeps', () => {
    const rnd = mulberry32(8);
    const l = lattice(32, 32, 'random', rnd);
    run(l, 5, 0, 300, rnd);
    expect(Math.abs(magnetisation(l))).toBeLessThan(0.2);
  });

  it('below Tc, mean |m| matches Yang\'s exact spontaneous magnetisation at T = 1.8', () => {
    const t = 1.8;
    const yang = (1 - Math.sinh(2 / t) ** -4) ** (1 / 8);
    const rnd = mulberry32(21);
    const l = lattice(32, 32, 'ordered', rnd);
    run(l, t, 0, 300, rnd);
    let sum = 0;
    const samples = 2000;
    for (let k = 0; k < samples; k++) {
      sweep(l, t, 0, rnd);
      sum += Math.abs(magnetisation(l));
    }
    expect(Math.abs(sum / samples - yang)).toBeLessThan(0.015);
  });

  it('above Tc, mean energy per spin matches Onsager\'s exact energy at T = 3', () => {
    const t = 3;
    const rnd = mulberry32(22);
    const l = lattice(32, 32, 'random', rnd);
    run(l, t, 0, 300, rnd);
    let sum = 0;
    const samples = 2000;
    for (let k = 0; k < samples; k++) {
      sweep(l, t, 0, rnd);
      sum += energy(l, 0) / l.s.length;
    }
    expect(Math.abs(sum / samples - onsagerEnergy(t))).toBeLessThan(0.015);
  });

  it('samples the Boltzmann distribution: a 4×4 torus matches exact enumeration', () => {
    const [w, h, t, field] = [4, 4, 2.5, 0.3];
    const n = w * h;
    let z = 0;
    let eSum = 0;
    let mSum = 0;
    const s = new Int8Array(n);
    for (let state = 0; state < 1 << n; state++) {
      let m = 0;
      for (let i = 0; i < n; i++) {
        s[i] = (state >> i) & 1 ? 1 : -1;
        m += s[i];
      }
      const e = bruteEnergy(s, w, h, field);
      const weight = Math.exp(-e / t);
      z += weight;
      eSum += weight * e;
      mSum += weight * m;
    }
    const exactE = eSum / z / n;
    const exactM = mSum / z / n;

    const rnd = mulberry32(33);
    const l = lattice(w, h, 'random', rnd);
    run(l, t, field, 1000, rnd);
    let e = 0;
    let m = 0;
    const samples = 100000;
    for (let k = 0; k < samples; k++) {
      sweep(l, t, field, rnd);
      e += energy(l, field) / n;
      m += magnetisation(l);
    }
    expect(Math.abs(e / samples - exactE)).toBeLessThan(0.015);
    expect(Math.abs(m / samples - exactM)).toBeLessThan(0.015);
  });

  it('the acceptance count matches the spins that actually changed', () => {
    const rnd = mulberry32(4);
    const l = lattice(20, 12, 'random', rnd);
    const before = Int8Array.from(l.s);
    const flipped = new Uint8Array(l.s.length);
    const accepted = sweep(l, 2.27, 0.1, rnd, flipped);
    let changed = 0;
    for (let i = 0; i < l.s.length; i++) {
      if (l.s[i] !== before[i]) changed++;
      expect(flipped[i]).toBe(l.s[i] !== before[i] ? 1 : 0);
    }
    expect(accepted).toBe(changed);
  });

  it('is reproducible for a fixed seed', () => {
    const go = (seed: number) => {
      const rnd = mulberry32(seed);
      const l = lattice(24, 16, 'random', rnd);
      run(l, 2.27, 0.05, 50, rnd);
      return Array.from(l.s);
    };
    expect(go(99)).toEqual(go(99));
    expect(go(99)).not.toEqual(go(100));
  });

  it('the heat books of a sweep are the energy change recomputed from scratch, in hundredths', () => {
    const rnd = mulberry32(12);
    const l = lattice(18, 14, 'random', rnd);
    for (const k of [0, 37, -100, 150]) {
      for (const t of [1.2, 2.27, 4]) {
        const before = energyHundredths(l, k);
        const heat = { e100: 0 };
        for (let i = 0; i < 5; i++) sweep(l, t, k / 100, rnd, undefined, heat);
        const after = energyHundredths(l, k);
        expect(heat.e100).toBe(after - before);
        // and the hundredths are the energy itself: the brute force here, at field k / 100
        expect(after / 100).toBeCloseTo(bruteEnergy(l.s, l.w, l.h, k / 100), 9);
      }
    }
    expect(spinSum(l)).toBe(Math.round(magnetisation(l) * l.s.length));
  });

  it('refuses to keep heat books off the 0.01 grid of the field', () => {
    const rnd = mulberry32(3);
    const l = lattice(8, 8, 'random', rnd);
    expect(() => sweep(l, 2, 0.123, rnd, undefined, { e100: 0 })).toThrow(/0.01 grid/);
    expect(() => sweep(l, 2, 0.123, rnd)).not.toThrow();
  });

  it('a swept field balances its books exactly on every cycle, at every temperature', () => {
    for (const t of [1.2, 2.27, 4]) {
      const rnd = mulberry32(8);
      const l = lattice(24, 20, 'ordered', rnd);
      const f = new FieldSweep(l, 60, 2);
      let sweeps = 0;
      while (f.cycles < 3) { f.step(t, rnd); sweeps++; }
      expect(sweeps).toBe(3 * f.period);
      expect(f.last!.residual).toBe(0);
      expect(f.last!.loop.length).toBe(4 * 60);
      // loop area and heat differ by exactly the cycle's change of energy
      expect(f.last!.area - f.last!.dissipated - f.last!.change).toBeCloseTo(0, 12);
    }
  });

  it('below Tc the loop is open and dissipates; above Tc it nearly closes', () => {
    const area = (t: number) => {
      const rnd = mulberry32(21);
      const l = lattice(40, 40, 'ordered', rnd);
      const f = new FieldSweep(l, 100, 2);
      while (f.cycles < 2) f.step(t, rnd);
      return f.last!;
    };
    const cold = area(1.5);
    const hot = area(4);
    expect(cold.area).toBeGreaterThan(1);
    expect(cold.dissipated).toBeGreaterThan(1);
    expect(hot.area).toBeLessThan(0.05);
    // a ferromagnet below Tc keeps its sign past h = 0 on the way down
    expect(cold.coercive).toBeLessThan(0);
  });

  it('Yang\'s spontaneous magnetisation: published values, 0 at and above Tc, 1 as T → 0', () => {
    // m₀(T = 2) = 0.911319 (to six places, from (1 − sinh⁻⁴ 1)^(1/8))
    const sinh1 = (Math.E - 1 / Math.E) / 2;
    expect(spontaneousMagnetisation(2)).toBeCloseTo((1 - sinh1 ** -4) ** (1 / 8), 12);
    expect(spontaneousMagnetisation(2)).toBeCloseTo(0.911319, 5);
    expect(spontaneousMagnetisation(T_CRITICAL)).toBe(0);
    expect(spontaneousMagnetisation(3)).toBe(0);
    expect(spontaneousMagnetisation(0.3)).toBeCloseTo(1, 9);
    expect(spontaneousMagnetisation(T_CRITICAL - 1e-6)).toBeLessThan(0.2);
  });
});
