// The discrete Stokes theorem of src/plates/stable-fluids/stokes.ts against fields whose
// circulation is known in closed form, and against a field with no structure at all.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { centredLoop, stokes } from '../src/plates/stable-fluids/stokes';

/** A field on the (n+2)² grid, cell (i, j) at x = (i − ½)/n, y = (j − ½)/n. */
function field(n: number, f: (x: number, y: number) => [number, number]) {
  const w = n + 2;
  const u = new Float64Array(w * w);
  const v = new Float64Array(w * w);
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const [a, b] = f((i - 0.5) / n, (j - 0.5) / n);
      u[i + w * j] = a;
      v[i + w * j] = b;
    }
  }
  return { u, v };
}

describe('stable-fluids: Stokes on the grid', () => {
  it('a solid rotation of rate Ω has ω = 2Ω, so ∮v·dl = 2Ω times the loop\'s area', () => {
    const n = 64;
    const om = 0.7;
    const { u, v } = field(n, (x, y) => [-om * (y - 0.5), om * (x - 0.5)]);
    const q = centredLoop(n, 0.5);
    const side = (q.b - q.a + 1) / n;
    const s = stokes(n, u, v, q);
    expect(s.circulation).toBeCloseTo(2 * om * side * side, 12);
    expect(s.flux).toBeCloseTo(2 * om * side * side, 12);
  });

  it('a uniform stream and a pure strain carry no circulation', () => {
    const n = 48;
    for (const f of [(): [number, number] => [0.3, -0.2], (x: number, y: number): [number, number] => [x, -y]]) {
      const { u, v } = field(n, f);
      const s = stokes(n, u, v, centredLoop(n, 0.6));
      expect(Math.abs(s.circulation)).toBeLessThan(1e-14);
      expect(Math.abs(s.flux)).toBeLessThan(1e-14);
    }
  });

  it('a shear (y, 0) circulates minus the area, as the vector-calculus plate asks', () => {
    const n = 40;
    const { u, v } = field(n, (_x, y) => [y, 0]);
    const q = centredLoop(n, 0.5);
    const side = (q.b - q.a + 1) / n;
    expect(stokes(n, u, v, q).circulation).toBeCloseTo(-side * side, 12);
  });

  it('on a random field, in float32 as the solver stores it, the two sums agree to rounding', () => {
    for (const n of [32, 96, 128]) {
      const rnd = mulberry32(n);
      const w = n + 2;
      const u = Float32Array.from({ length: w * w }, () => rnd() - 0.5);
      const v = Float32Array.from({ length: w * w }, () => rnd() - 0.5);
      for (const fraction of [0.1, 0.5, 0.9]) {
        const s = stokes(n, u, v, centredLoop(n, fraction));
        expect(s.gap, `n ${n}, loop ${fraction}`).toBeLessThan(1e-13);
        expect(Math.abs(s.circulation)).toBeGreaterThan(0);
      }
    }
  });

  it('a loop one face off is not the boundary of those cells: the test can see it', () => {
    const n = 32;
    const rnd = mulberry32(5);
    const w = n + 2;
    const u = Float64Array.from({ length: w * w }, () => rnd() - 0.5);
    const v = Float64Array.from({ length: w * w }, () => rnd() - 0.5);
    const q = centredLoop(n, 0.5);
    const line = stokes(n, u, v, q).circulation;
    const wider = stokes(n, u, v, { ...q, b: q.b + 1 }).flux;
    expect(Math.abs(line - wider)).toBeGreaterThan(1e-3);
  });

  it('the loop is centred to a cell, whole cells, inside the interior', () => {
    for (const n of [32, 96, 128]) {
      for (const fraction of [0.1, 0.5, 0.9]) {
        const q = centredLoop(n, fraction);
        expect(q.a).toBeGreaterThanOrEqual(2);
        expect(q.b).toBeLessThanOrEqual(n - 1);
        expect(Math.abs((q.a - 1) - (n - q.b))).toBeLessThanOrEqual(1);
        expect(q.d - q.c).toBe(q.b - q.a);
      }
    }
  });
});
