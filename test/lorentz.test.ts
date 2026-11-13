// Special relativity (src/plates/_shared/lorentz and the two relativity stills), each identity
// checked against a second, independent computation or a closed form.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  addVelocities, boost, boostFields, boostMatrix, boostMomentum, boostTensor, fieldsOf, fieldTensor,
  gammaOf, hyperbolic, hyperbolicTau, interval, mass, multiply, properTime, rapidityOf,
  twin, twinTau, type V3,
} from '../src/plates/_shared/lorentz/lorentz';
import { compositionDefect, intervalDrift, rodInPrime, sceneEvents, sliderVelocities } from '../src/plates/minkowski-diagram/plate';
import { fixedTarget, invariantDrift, transformDefect, wireForces } from '../src/plates/four-vectors/plate';

const rnd = mulberry32(2026);
const r = (lo: number, hi: number) => lo + (hi - lo) * rnd();

describe('boosts', () => {
  it('keep the interval of random events under random boosts', () => {
    for (let i = 0; i < 500; i++) {
      const a = { t: r(-5, 5), x: r(-5, 5) }; const b = { t: r(-5, 5), x: r(-5, 5) };
      const phi = r(-3, 3);
      expect(interval(boost(a, phi), boost(b, phi))).toBeCloseTo(interval(a, b), 9);
    }
  });

  it('are the textbook γ form: t′ = γ (t − v x), x′ = γ (x − v t)', () => {
    for (let i = 0; i < 100; i++) {
      const v = r(-0.99, 0.99); const e = { t: r(-3, 3), x: r(-3, 3) };
      const g = 1 / Math.sqrt(1 - v * v);
      const q = boost(e, rapidityOf(v));
      expect(q.t).toBeCloseTo(g * (e.t - v * e.x), 10);
      expect(q.x).toBeCloseTo(g * (e.x - v * e.t), 10);
    }
  });

  it('compose by adding rapidities, which is Einstein\'s velocity addition', () => {
    for (let i = 0; i < 200; i++) {
      const u = r(-0.95, 0.95); const v = r(-0.95, 0.95);
      expect(Math.tanh(rapidityOf(u) + rapidityOf(v))).toBeCloseTo(addVelocities(u, v), 13);
      expect(compositionDefect(u, v)).toBeLessThan(1e-12);
      const m = multiply(boostMatrix(rapidityOf(u)), boostMatrix(-rapidityOf(u)));
      expect(m[0][0]).toBeCloseTo(1, 13); expect(m[0][1]).toBeCloseTo(0, 13);
    }
    // no two speeds below c add to c or more
    expect(addVelocities(0.95, 0.95)).toBeLessThan(1);
  });

  it('the stills\' invariance readouts are rounding over every slider position', () => {
    expect(sliderVelocities().length).toBe(191);
    for (const scene of ['simultaneity', 'rod', 'twins']) {
      expect(intervalDrift(sceneEvents(scene, 1, 8), sliderVelocities())).toBeLessThan(1e-12);
    }
  });

  it('a rod at rest in S is measured γ times shorter in S′', () => {
    for (const v of [0.1, 0.5, 0.9, -0.6]) expect(rodInPrime(v)).toBeCloseTo(2 / gammaOf(v), 12);
  });
});

describe('proper time', () => {
  it('of hyperbolic motion, by quadrature, is asinh(aT)/a', () => {
    for (const [a, T] of [[1, 2], [0.3, 7], [4, 0.5]]) {
      expect(properTime(hyperbolic(a, T)).tau).toBeCloseTo(hyperbolicTau(a, T), 10);
    }
  });

  it('of the travelling twin is 4 asinh(aT/4)/a, less than T, and the twin comes home at rest', () => {
    for (const [a, T] of [[1, 8], [0.5, 12], [3, 2]]) {
      const w = twin(a, T);
      expect(properTime(w).tau).toBeCloseTo(twinTau(a, T), 10);
      expect(twinTau(a, T)).toBeLessThan(T);
      expect(w.x(T)).toBeCloseTo(0, 12);
      expect(w.v(T)).toBeCloseTo(0, 12);
      // x is the integral of v: a centred difference at a smooth point
      const t = T * 0.37; const h = 1e-6;
      expect((w.x(t + h) - w.x(t - h)) / (2 * h)).toBeCloseTo(w.v(t), 6);
    }
  });
});

describe('four-vectors and fields', () => {
  const rv = (): V3 => [r(-2, 2), r(-2, 2), r(-2, 2)];

  it('the field formulas agree with F′ = Λ F Λᵀ, and the tensor reads back its fields', () => {
    for (let i = 0; i < 200; i++) {
      const E = rv(); const B = rv(); const v = r(-0.99, 0.99);
      expect(transformDefect(E, B, v)).toBeLessThan(1e-11);
      const back = fieldsOf(fieldTensor(E, B));
      expect(back.E).toEqual(E); expect(back.B).toEqual(B);
    }
  });

  it('E·B and E² − B² do not change under any boost the slider allows', () => {
    for (let i = 0; i < 50; i++) {
      const [d1, d2] = invariantDrift(rv(), rv(), sliderVelocities());
      expect(d1).toBeLessThan(1e-12); expect(d2).toBeLessThan(1e-12);
    }
  });

  it('a pure E field seen from a moving frame grows a B field, B′ = −v × E′ for E ⊥ v', () => {
    const v = 0.6; const f = boostFields([0, 1, 0], [0, 0, 0], v);
    expect(f.E[1]).toBeCloseTo(gammaOf(v), 14);
    expect(f.B[2]).toBeCloseTo(-v * gammaOf(v), 14);
    // the tensor agrees, at the same rapidity
    const t = fieldsOf(boostTensor(fieldTensor([0, 1, 0], [0, 0, 0]), rapidityOf(v)));
    expect(t.B[2]).toBeCloseTo(-v * gammaOf(v), 14);
  });

  it('the invariant mass is the same in every frame; the antiproton threshold is a 7 m beam', () => {
    for (const e of [1.5, 7, 19]) {
      const k = fixedTarget(e);
      for (const v of [-0.9, 0, 0.4, 0.99]) expect(mass(boostMomentum(k, rapidityOf(v)))).toBeCloseTo(mass(k), 9);
      // √s² = 2m² + 2 E m for a beam on a target at rest
      expect(mass(k) ** 2).toBeCloseTo(2 + 2 * e, 10);
    }
    expect(mass(fixedTarget(7))).toBeCloseTo(4, 12);
  });

  it('the magnetic force in the lab is the electric force in the charge\'s frame, transformed', () => {
    for (const [w, u] of [[0.1, 0.5], [0.001, 0.9], [0.5, -0.3], [0.9, 0.9]]) {
      const f = wireForces(1, w, u, 1);
      expect(f.fromRest).toBeCloseTo(f.lab, 13);
      // and the lab force is q u λ w / (2π r): repulsive when the charge moves with the electrons
      expect(f.lab).toBeCloseTo((u * w) / (2 * Math.PI), 14);
    }
  });
});
