// The collisions plate's runs (src/plates/collisions/plate.ts on the shared event core,
// src/plates/_shared/ensemble/hard-disks.ts) beyond its claims: the restitution law against the
// head-on closed form at several e and mass ratios, a perfectly inelastic pair moving on together,
// and Galperin's count at k = 0, 1, 2, 3 against ⌈π/θ⌉ − 1.
import { describe, expect, it } from 'vitest';
import { headOn, recordGalperin, recordInTime } from '../src/plates/collisions/plate';

const pair = (m2: number, u2: number) => ({
  x: Float64Array.from([0.3, 0.7]), y: Float64Array.from([0.5, 0.5]),
  vx: Float64Array.from([0.25, 0.25 * u2]), vy: new Float64Array(2), m: Float64Array.from([1, m2]),
});

describe('collisions', () => {
  it('obeys the restitution law of a head-on collision', () => {
    for (const [m2, u2, e] of [[3, 0, 0.5], [0.4, -0.6, 0.8], [2, 0.3, 0.1], [1, -1, 1]]) {
      const r = recordInTime(pair(m2, u2), 0.08, 1, e);
      const [v1, v2] = headOn(1, m2, 1, u2, e);
      expect(r.gas.collisions).toBe(1);
      expect(r.gas.vx[0] / 0.25).toBeCloseTo(v1, 12);
      expect(r.gas.vx[1] / 0.25).toBeCloseTo(v2, 12);
      // the separation speed is e times the approach speed
      expect((r.gas.vx[1] - r.gas.vx[0]) / 0.25).toBeCloseTo(e * (1 - u2), 12);
    }
  });

  it('sends a perfectly inelastic pair on together at the centre-of-mass velocity', () => {
    const r = recordInTime(pair(3, 0), 0.08, 1, 0);
    expect(r.gas.vx[0]).toBeCloseTo(0.25 / 4, 14);
    expect(r.gas.vx[1]).toBeCloseTo(0.25 / 4, 14);
  });

  it('counts the digits of π in Galperin’s billiard', () => {
    for (const k of [0, 1, 3]) {
      const ratio = 100 ** k;
      const expected = Math.ceil(Math.PI / Math.atan(Math.sqrt(1 / ratio))) - 1;
      expect(recordGalperin(ratio, 0.02).count).toBe(expected);
    }
    expect(recordGalperin(1, 0.02).count).toBe(3);
    expect(recordGalperin(10000, 0.02).count).toBe(314);
  });
});
