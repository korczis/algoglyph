// Overdamped Langevin walkers (src/plates/_shared/ensemble/langevin.ts), against statistical
// mechanics computed apart from the walk: Einstein's MSD = 2dDt with D = kT/γ, the Boltzmann
// distribution of a harmonic well (with the Euler–Maruyama scheme's own small variance bias in
// closed form), the barometric scale height kT/mg, the drift F/γ in a tilt, and no drift in an
// asymmetric ratchet at one temperature.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { Walkers, potentialOf, ratchetDrift } from '../src/plates/_shared/ensemble/langevin';
import { erf, ksBound, ksDistance } from '../src/plates/_shared/two-slit/math';

describe('langevin walkers', () => {
  it('spread with MSD = 4Dt in two dimensions, D = kT/γ (Einstein)', () => {
    const w = new Walkers({ n: 4000, dims: 2, kT: 1.5, gamma: 2, dt: 0.01, potential: potentialOf('flat', 0) }, mulberry32(1));
    for (let i = 0; i < 500; i++) w.step();
    const D = 1.5 / 2;
    const t = 500 * 0.01;
    const ratio = w.msd() / (4 * D * t);
    expect(Math.abs(ratio - 1)).toBeLessThan(4 / Math.sqrt(4000));
  });

  it('settle into a harmonic well as Boltzmann says, up to the scheme’s own O(dt) variance bias', () => {
    const k = 2;
    const kT = 1;
    const gamma = 1;
    const dt = 0.01;
    const w = new Walkers({ n: 4000, dims: 1, kT, gamma, dt, potential: potentialOf('harmonic', k) }, mulberry32(2));
    for (let i = 0; i < 1500; i++) w.step();
    // Euler–Maruyama's stationary variance for this OU process is (kT/k)/(1 − k dt/2γ)
    const variance = (kT / k) / (1 - (k * dt) / (2 * gamma));
    const s = Math.sqrt(variance);
    const xs = w.positions();
    expect(ksDistance(xs, (x) => 0.5 * (1 + erf(x / (s * Math.SQRT2))))).toBeLessThan(ksBound(4000));
  });

  it('stand above a floor with the barometric mean height kT/mg', () => {
    const w = new Walkers({ n: 4000, dims: 1, kT: 1, gamma: 1, dt: 0.005, potential: potentialOf('gravity', 2) }, mulberry32(3));
    for (let i = 0; i < 3000; i++) w.step();
    const mean = w.positions().reduce((a, b) => a + b, 0) / w.n;
    // exponential heights: mean = sd = kT/mg = 0.5
    expect(Math.abs(mean - 0.5)).toBeLessThan(4 * 0.5 / Math.sqrt(4000) + 0.01);
    expect(Math.min(...w.x)).toBeGreaterThanOrEqual(0);
  });

  it('drift at F/γ down a tilt', () => {
    const F = 0.8;
    const w = new Walkers({ n: 4000, dims: 1, kT: 1, gamma: 2, dt: 0.01, potential: potentialOf('tilt', F) }, mulberry32(4));
    for (let i = 0; i < 1000; i++) w.step();
    const v = w.drift();
    expect(Math.abs(v.mean - F / 2)).toBeLessThan(4 * v.se);
  });

  it('do not drift in an asymmetric ratchet at one temperature (detailed balance)', () => {
    const r = ratchetDrift(3000, 2000, mulberry32(5));
    expect(Math.abs(r.mean / r.se)).toBeLessThan(3);
  });
});
