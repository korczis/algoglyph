// The energy of a charged ball (src/plates/_shared/fields/self-energy.ts) against numbers it does
// not compute: 3/5, 1/2 and 5/9 of Q²/4πR worked by hand, the charge inside r of an even ball, r³,
// the sampled radii against that law by Kolmogorov–Smirnov, a table profile that is an even ball,
// the pair sum done in slices against one go, and the shell's field momentum, 4/3.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { assemblyWork, ball, enclosed, fieldEnergy, momentumOverEnergy, PairSum, sampleRadius, samplePoints } from '../src/plates/_shared/fields/self-energy';
import { selfEnergy } from '../src/plates/self-energy/plate';

const UNIT = 1 / (4 * Math.PI);

describe('self-energy', () => {
  it('an even ball holds 3/5, a shell 1/2 and ρ ∝ r² 5/9 of Q²/4πR, by field and by assembly', () => {
    const even = ball({ kind: 'power', k: 0 });
    expect(fieldEnergy(even)).toBeCloseTo(0.6 * UNIT, 10);
    expect(assemblyWork(even)).toBeCloseTo(0.6 * UNIT, 10);
    expect(fieldEnergy(ball({ kind: 'shell' }))).toBeCloseTo(0.5 * UNIT, 10);
    expect(assemblyWork(ball({ kind: 'shell' }))).toBeCloseTo(0.5 * UNIT, 10);
    expect(fieldEnergy(ball({ kind: 'power', k: 2 }))).toBeCloseTo((5 / 9) * UNIT, 10);
  });

  it('an even ball encloses r³ of its charge, and a constant table is an even ball', () => {
    const even = ball({ kind: 'power', k: 0 });
    for (const r of [0.1, 0.37, 0.8]) expect(enclosed(even, r)).toBeCloseTo(r ** 3, 12);
    const table = ball({ kind: 'table', r: [0, 0.5, 1], rho: [2, 2, 2] });
    expect(fieldEnergy(table)).toBeCloseTo(0.6 * UNIT, 10);
  });

  it('draws radii whose law is r³, by Kolmogorov–Smirnov', () => {
    const even = ball({ kind: 'power', k: 0 });
    const rnd = mulberry32(5);
    const n = 4000;
    const rs = Array.from({ length: n }, () => sampleRadius(even, rnd())).sort((a, b) => a - b);
    let d = 0;
    rs.forEach((r, i) => { d = Math.max(d, Math.abs(r ** 3 - i / n), Math.abs(r ** 3 - (i + 1) / n)); });
    // Kolmogorov's 99.9 % point, 1.95/√n
    expect(d).toBeLessThan(1.95 / Math.sqrt(n));
  });

  it('the pair sum in slices is the pair sum in one go', () => {
    const pts = samplePoints(ball({ kind: 'power', k: 1 }), 300, mulberry32(2));
    const one = new PairSum(pts);
    one.advance(Infinity);
    const sliced = new PairSum(pts);
    let frames = 0;
    while (!sliced.advance(1000)) frames++;
    expect(frames).toBeGreaterThan(10);
    expect(sliced.pairs).toBe((300 * 299) / 2);
    expect(sliced.energy).toBe(one.energy);
  });

  it('a moving shell’s field carries 4/3 of U v/c²', () => {
    expect(momentumOverEnergy(ball({ kind: 'shell' }))).toBeCloseTo(4 / 3, 10);
  });

  it('declares itself a still', () => {
    expect(selfEnergy.pace?.kind).toBe('still');
  });
});
