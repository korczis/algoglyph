import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { field, PRESETS, seed, step } from '../src/plates/gray-scott/grayscott';

describe('gray-scott', () => {
  it('the trivial steady state u = 1, v = 0 stays exactly fixed', () => {
    const fl = field(24, 16);
    for (let s = 0; s < 200; s++) step(fl, 0.0545, 0.062);
    expect(fl.u.every((x) => x === 1)).toBe(true);
    expect(fl.v.every((x) => x === 0)).toBe(true);
  });

  for (const [id, { f, k }] of Object.entries(PRESETS)) {
    it(`${id}: concentrations stay within [0, 1] over 1000 seeded steps`, () => {
      const fl = field(64, 40);
      const rnd = mulberry32(5);
      for (let d = 0; d < 8; d++) seed(fl, Math.floor(rnd() * 64), Math.floor(rnd() * 40), 4);
      for (let s = 0; s < 1000; s++) step(fl, f, k);
      for (let i = 0; i < fl.u.length; i++) {
        expect(fl.u[i]).toBeGreaterThanOrEqual(0);
        expect(fl.u[i]).toBeLessThanOrEqual(1);
        expect(fl.v[i]).toBeGreaterThanOrEqual(0);
        expect(fl.v[i]).toBeLessThanOrEqual(1);
      }
    });
  }

  it('the stencil is translation invariant on the torus', () => {
    const a = field(20, 20);
    const b = field(20, 20);
    seed(a, 5, 5, 3);
    seed(b, 15, 12, 3);
    for (let s = 0; s < 100; s++) {
      step(a, 0.0367, 0.0649);
      step(b, 0.0367, 0.0649);
    }
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const j = ((y + 7) % 20) * 20 + ((x + 10) % 20);
        expect(b.v[j]).toBeCloseTo(a.v[y * 20 + x], 6);
      }
    }
  });

  it('a dying pattern decays to exact zeros, never into subnormal floats (slow on x86)', () => {
    // feed and kill past the coral regime: the pattern dies and V decays towards zero; without
    // the flush every V cell sat subnormal from step 800 on (Pages run 43120590754)
    const fl = field(195, 122);
    for (let d = 0; d < 10; d++) seed(fl, 20 + d * 15, 30 + (d % 3) * 30, 4);
    const p = PRESETS.coral;
    for (let s = 0; s < 1200; s++) step(fl, p.f + 0.01, p.k + 0.005);
    const subnormal = (x: number) => x !== 0 && Math.abs(x) < 1.1754944e-38;
    expect([...fl.u, ...fl.v].filter(subnormal).length).toBe(0);
    expect(fl.v.every((x) => x === 0)).toBe(true);
  });
});
