// The direct-sum gravity of n-body beyond the entry's claims: the angular momentum kept by the
// leapfrog for an arbitrary system, the softened binary's rate against the force balance of a
// circle, and the leapfrog's phase error of order 2 measured by halving the step.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { accelerate, angularMomentum, bodies, leapfrog } from '../src/plates/n-body/gravity';
import { softenedRate } from '../src/plates/n-body/plate';

const EPS = 0.04;

/** The circular binary of total mass 1 at separation 1, run for time T at step dt: the angle turned. */
function turned(dt: number, T: number): number {
  const b = bodies(2);
  const v = softenedRate(1, 1) / 2;
  b.m[0] = 0.5;
  b.m[1] = 0.5;
  b.x.set([-0.5, 0, 0, 0.5, 0, 0]);
  b.v.set([0, -v, 0, 0, v, 0]);
  accelerate(b, 1, EPS);
  let angle = 0;
  let last = 0;
  for (let i = 0; i < Math.round(T / dt); i++) {
    leapfrog(b, dt, 1, EPS);
    const a = Math.atan2(b.x[4] - b.x[1], b.x[3] - b.x[0]);
    let d = a - last;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    angle += d;
    last = a;
  }
  return angle;
}

describe('n-body: the direct sum', () => {
  it('keeps the angular momentum of an arbitrary system to round-off', () => {
    const rnd = mulberry32(7);
    const b = bodies(40);
    for (let i = 0; i < 40; i++) {
      b.m[i] = 0.01 + rnd() * 0.05;
      for (let d = 0; d < 3; d++) { b.x[i * 3 + d] = rnd() * 2 - 1; b.v[i * 3 + d] = rnd() - 0.5; }
    }
    accelerate(b, 1, EPS);
    const L0 = angularMomentum(b);
    for (let s = 0; s < 500; s++) leapfrog(b, 0.002, 1, EPS);
    const L1 = angularMomentum(b);
    for (let d = 0; d < 3; d++) expect(Math.abs(L1[d] - L0[d])).toBeLessThan(1e-14);
  });

  it('has the softened binary’s rate from the balance of a circle: ω²(d/2) = G(M/2)·d/(d² + ε²)^(3/2) / (M/2)', () => {
    // each body, mass M/2 at radius d/2, is pulled by the other with G(M/2)²d/(d² + ε²)^(3/2)
    const d = 1;
    const M = 1;
    const pull = ((M / 2) ** 2 * d) / (d * d + EPS * EPS) ** 1.5;
    expect(softenedRate(M, d) ** 2 * (M / 2) * (d / 2)).toBeCloseTo(pull, 14);
  });

  it('turns the binary with a phase error of order 2, measured by halving the step', () => {
    const T = 2;
    const exact = softenedRate(1, 1) * T;
    const p = Math.log2(Math.abs(turned(0.02, T) - exact) / Math.abs(turned(0.01, T) - exact));
    expect(Math.abs(p - 2)).toBeLessThan(0.2);
  });
});
