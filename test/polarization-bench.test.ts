// Jones calculus and Fresnel's amplitudes (src/plates/_shared/optics/jones.ts) against results they
// do not compute: a half-wave plate mirrors linear light about its axis, a quarter-wave plate at 45°
// makes linear light circular, three polarisers pass a quarter by counted photons, Fresnel's R + T
// is 1, the normal-incidence reflectance, Brewster's angle and total internal reflection.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  apply, cx, fresnel, intensity, photon, polariser, stokes, unitarityDefect, wavePlate, type Element, type Jones,
} from '../src/plates/_shared/optics/jones';

const linear = (a: number): Jones => [cx(Math.cos(a)), cx(Math.sin(a))];
const deg = Math.PI / 180;

describe('polarization-bench', () => {
  it('a half-wave plate at θ turns linear light at α to 2θ − α', () => {
    const out = apply(wavePlate(30 * deg, Math.PI), linear(10 * deg));
    const [, s1, s2] = stokes(out);
    expect(Math.atan2(s2, s1) / 2 / deg).toBeCloseTo(50, 9);
    expect(intensity(out)).toBeCloseTo(1, 12);
  });

  it('a quarter-wave plate at 45° makes horizontal light circular', () => {
    const [s0, s1, s2, s3] = stokes(apply(wavePlate(45 * deg, Math.PI / 2), linear(0)));
    expect(Math.abs(s3)).toBeCloseTo(s0, 12);
    expect(Math.abs(s1) + Math.abs(s2)).toBeLessThan(1e-12);
  });

  it('wave plates are unitary and a polariser is not', () => {
    for (const t of [0.1, 0.7, 2.3]) expect(unitarityDefect(wavePlate(t, 1.1))).toBeLessThan(1e-14);
    expect(unitarityDefect(polariser(0.3))).toBeGreaterThan(0.5);
  });

  it('three polarisers at 0°, 45° and 90° pass a quarter of horizontal photons', () => {
    const bench: Element[] = [0, 45, 90].map((d) => ({ kind: 'polariser', theta: d * deg }));
    const rnd = mulberry32(3);
    const n = 20000;
    let through = 0;
    for (let k = 0; k < n; k++) if (photon(linear(0), bench, rnd) === -1) through++;
    // four binomial standard errors
    expect(Math.abs(through / n - 0.25)).toBeLessThan(4 * Math.sqrt((0.25 * 0.75) / n));
  });

  it('Fresnel: R + T = 1, the normal-incidence reflectance, Brewster and total reflection', () => {
    for (const a of [0, 20, 45, 70, 85]) {
      const f = fresnel(1, 1.5, a * deg);
      expect(f.Rs + f.Ts).toBeCloseTo(1, 12);
      expect(f.Rp + f.Tp).toBeCloseTo(1, 12);
    }
    expect(fresnel(1, 1.5, 0).Rs).toBeCloseTo(0.04, 12);
    expect(fresnel(1, 1.5, Math.atan(1.5)).Rp).toBeLessThan(1e-28);
    const beyond = fresnel(1.5, 1, 60 * deg);
    expect(beyond.total).toBe(true);
    expect(beyond.Rs).toBeCloseTo(1, 12);
    expect(beyond.Rp).toBeCloseTo(1, 12);
  });
});
