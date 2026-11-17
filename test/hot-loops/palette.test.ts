// The in-place colour helpers (src/core/palette.ts) against the ones that allocate: rampInto,
// mixInto and scaleInto write exactly what ramp, mix and scale return, component for component,
// over every palette, clamped and cyclic t, and with `out` aliasing an input. A planted change in
// the comparison (mix at t + 1e−9) must fail it.
import { describe, expect, it } from 'vitest';
import { mix, mixInto, PALETTES, ramp, rampInto, scale, scaleInto, type RGB } from '../../src/core/palette';
import { mulberry32 } from '../../src/core/random';

const same = (a: RGB, b: RGB) => a.every((v, i) => Object.is(v, b[i]));

function differing(nudge: number): number {
  const rnd = mulberry32(3);
  let differ = 0;
  for (const pal of PALETTES) {
    for (let q = 0; q < 500; q++) {
      for (const cyclic of [false, true]) {
        const t = cyclic ? rnd() * 4 - 2 : rnd() * 1.6 - 0.3;
        if (!same(rampInto([0, 0, 0], pal, t, cyclic), ramp(pal, t, cyclic))) differ++;
      }
      const a = ramp(pal, rnd()); const b = ramp(pal, rnd()); const t = rnd() * 1.2 - 0.1; const k = rnd() * 2;
      const want = mix(a, b, t + nudge);
      if (!same(mixInto([0, 0, 0], a, b, t), want)) differ++;
      if (!same(mixInto([...a] as RGB, a, b, t), want)) differ++; // out aliases a
      const bb: RGB = [...b] as RGB;
      if (!same(mixInto(bb, a, bb, t), want)) differ++; // out aliases b
      const c: RGB = [...a] as RGB;
      if (!same(scaleInto(c, c, k), scale(a, k))) differ++;
    }
  }
  return differ;
}

describe('the in-place colour helpers', () => {
  it('write exactly what ramp, mix and scale return, aliasing included', () => {
    expect(differing(0)).toBe(0);
  });

  it('a planted change (mix compared at t + 1e−9) fails the same comparison', () => {
    expect(differing(1e-9)).toBeGreaterThan(0);
  });
});
