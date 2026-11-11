import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  BAILOUT, BOUNDED, escape, inCardioidOrBulb, interlace, julia, mandelbrot, toGrid, toPlane,
  zoomAt,
} from '../src/plates/fractal/escape';
import { JULIA_PRESETS } from '../src/plates/fractal/plate';

type C = [number, number];
const sq = ([a, b]: C, [cr, ci]: C): C => [a * a - b * b + cr, 2 * a * b + ci];

describe('escape time', () => {
  it('points of the Mandelbrot set never escape', () => {
    // 0 is fixed, −1 has period 2, ±i are preperiodic (i → −1+i → −i → −1+i), −0.75 and
    // 0.25 are parabolic boundary points, −2 lands on the fixed point 2 (|z| = 2 forever)
    const inside: C[] = [[0, 0], [-1, 0], [0, 1], [0, -1], [-0.75, 0], [0.25, 0], [-2, 0]];
    for (const [cr, ci] of inside) {
      expect(escape(0, 0, cr, ci, 20_000), `${cr}+${ci}i`).toBe(BOUNDED);
      expect(mandelbrot(cr, ci, 20_000), `${cr}+${ci}i`).toBe(BOUNDED);
    }
  });

  it('points outside escape at the step the orbit worked out by hand passes the bailout', () => {
    // c = 1: 0, 1, 2, 5, 26, 677        c = 0.5: |z₈| ≈ 12005
    // c = −2.1: …, 67.996, 4621.4        c = 1 + i: 1+i, 1+3i, −7+7i, 1−97i, −9407−193i
    const cases: [C, number][] = [[[1, 0], 5], [[0.5, 0], 8], [[-2.1, 0], 6], [[1, 1], 5]];
    for (const [[cr, ci], n] of cases) {
      const nu = mandelbrot(cr, ci, 1000);
      expect(nu).not.toBe(BOUNDED);
      // |z_n| < R², so the smooth count lies in [n, n + 1)
      expect(Math.floor(nu), `${cr}+${ci}i`).toBe(n);
    }
    // exact value for c = 1, where |z₅| = 677
    const exact = 6 - Math.log2(Math.log(677) / Math.log(BAILOUT));
    expect(mandelbrot(1, 0, 1000)).toBeCloseTo(exact, 12);
    const z5 = Math.hypot(9407, 193);
    expect(mandelbrot(1, 1, 1000)).toBeCloseTo(6 - Math.log2(Math.log(z5) / Math.log(BAILOUT)), 9);
  });

  it('the smooth count is continuous where the integer count jumps', () => {
    // rays that stay clear of the set: the real axis right of the cusp, and the diagonal
    const s = Math.SQRT1_2;
    const rays: [(t: number) => C, number, number][] = [
      [(t) => [t, 0], 0.6, 2],
      [(t) => [s * t, s * t], 0.7, 2.2],
    ];
    for (const [ray, from, to] of rays) {
      const steps = 20_000;
      let prev = NaN;
      let maxJump = 0;
      const counts = new Set<number>();
      for (let k = 0; k <= steps; k++) {
        const [cr, ci] = ray(from + ((to - from) * k) / steps);
        const nu = escape(0, 0, cr, ci, 5000);
        expect(nu).not.toBe(BOUNDED);
        counts.add(Math.floor(nu));
        if (k > 0) maxJump = Math.max(maxJump, Math.abs(nu - prev));
        prev = nu;
      }
      // several integer boundaries crossed, none of them visible as a step
      expect(counts.size).toBeGreaterThanOrEqual(4);
      // integer counts step by 1; neighbouring smooth counts differ by a fraction of a percent
      expect(maxJump).toBeLessThan(0.005);
    }
  });

  it('the Julia set of c = 0 is the unit circle, with ν = 1 − log₂(ln|z₀| / ln R)', () => {
    for (let k = 0; k < 24; k++) {
      const a = (2 * Math.PI * k) / 24;
      for (const r of [0.5, 0.99]) {
        expect(julia(r * Math.cos(a), r * Math.sin(a), 0, 0, 5000)).toBe(BOUNDED);
      }
      for (const r of [1.01, 1.5, 3]) {
        const nu = julia(r * Math.cos(a), r * Math.sin(a), 0, 0, 5000);
        // z_n = z₀^(2ⁿ) exactly, so the count has a closed form independent of the angle
        expect(nu).toBeCloseTo(1 - Math.log2(Math.log(r) / Math.log(BAILOUT)), 9);
      }
    }
  });

  it('the cardioid and period-2 disc shortcut only ever claims bounded points', () => {
    const rnd = mulberry32(7);
    let claimed = 0;
    for (let k = 0; k < 4000; k++) {
      const cr = -2 + 2.5 * rnd();
      const ci = -1.2 + 2.4 * rnd();
      if (!inCardioidOrBulb(cr, ci)) continue;
      claimed++;
      expect(escape(0, 0, cr, ci, 3000), `${cr}+${ci}i`).toBe(BOUNDED);
    }
    expect(claimed).toBeGreaterThan(500);
    for (const c of [[0, 0], [-1, 0], [0.24, 0], [-0.75, 0], [-1.24, 0]]) {
      expect(inCardioidOrBulb(c[0], c[1])).toBe(true);
    }
    for (const c of [[0.26, 0], [-1.26, 0], [0, 1], [-2, 0]]) {
      expect(inCardioidOrBulb(c[0], c[1])).toBe(false);
    }
  });
});

describe('Julia presets', () => {
  it('the connected presets have bounded critical orbits, the dust presets escape', () => {
    // the rabbit is the centre of a period-3 component: z₃ = 0 up to the rounding of c
    let z: C = [0, 0];
    for (let k = 0; k < 3; k++) z = sq(z, JULIA_PRESETS.rabbit);
    expect(Math.hypot(...z)).toBeLessThan(1e-5);
    // the basilica has the exact 2-cycle 0 → −1 → 0, the dendrite c = i is preperiodic
    z = sq(sq([0, 0], JULIA_PRESETS.basilica), JULIA_PRESETS.basilica);
    expect(z).toEqual([0, 0]);
    const z2 = sq(sq([0, 0], JULIA_PRESETS.dendrite), JULIA_PRESETS.dendrite);
    expect(sq(sq(z2, JULIA_PRESETS.dendrite), JULIA_PRESETS.dendrite)).toEqual(z2);
    expect(escape(0, 0, ...JULIA_PRESETS.siegel, 100_000)).toBe(BOUNDED);
    expect(escape(0, 0, ...JULIA_PRESETS.seahorse, 100_000)).not.toBe(BOUNDED);
    expect(escape(0, 0, ...JULIA_PRESETS.spirals, 100_000)).not.toBe(BOUNDED);
  });
});

describe('views and progressive order', () => {
  it('maps the grid to the plane and back, and zooms onto the clicked point', () => {
    const view = { cx: -0.65, cy: 0.1, width: 3.6 };
    const [re, im] = toPlane(view, 960, 600, 123.5, 456.25);
    const [x, y] = toGrid(view, 960, 600, re, im);
    expect(x).toBeCloseTo(123.5, 9);
    expect(y).toBeCloseTo(456.25, 9);
    expect(toPlane(view, 960, 600, 480, 300)).toEqual([-0.65, 0.1]);
    // the top edge is the larger imaginary part
    expect(toPlane(view, 960, 600, 480, 0)[1]).toBeCloseTo(0.1 + 1.125, 12);
    const z = zoomAt(view, 960, 600, 123.5, 456.25, 3);
    expect([z.cx, z.cy]).toEqual([re, im]);
    expect(z.width).toBeCloseTo(1.2, 12);
  });

  it('interlacing visits every row once and the first pass already covers the frame', () => {
    for (const h of [1, 7, 8, 9, 150, 301, 600]) {
      const order = interlace(h);
      expect(order.map(([r]) => r).sort((a, b) => a - b)).toEqual([...Array(h).keys()]);
      const covered = new Set<number>();
      for (const [r, span] of order.filter(([row]) => row % 8 === 0)) {
        for (let y = r; y < r + span; y++) covered.add(y);
      }
      expect(covered.size).toBe(h);
    }
  });
});
