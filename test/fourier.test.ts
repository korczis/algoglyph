import { describe, expect, it } from 'vitest';
import { dft, evaluate, resample, rmsError } from '../src/plates/fourier/dft';
import { shape } from '../src/plates/fourier/plate';
import { mulberry32 } from '../src/core/random';

describe('fourier', () => {
  it('the full spectrum reproduces every sample (inverse DFT)', () => {
    const rnd = mulberry32(17);
    const n = 64;
    const xs = Float64Array.from({ length: n }, () => rnd() * 2 - 1);
    const ys = Float64Array.from({ length: n }, () => rnd() * 2 - 1);
    const terms = dft(xs, ys);
    for (let j = 0; j < n; j++) {
      const [x, y] = evaluate(terms, n, j / n);
      expect(Math.abs(x - xs[j])).toBeLessThan(1e-9);
      expect(Math.abs(y - ys[j])).toBeLessThan(1e-9);
    }
    expect(rmsError(terms, n, xs, ys)).toBeLessThan(1e-9);
  });

  it('a circle is one coefficient at frequency 1 with radius 1', () => {
    const n = 32;
    const xs = Float64Array.from({ length: n }, (_, j) => Math.cos((2 * Math.PI * j) / n));
    const ys = Float64Array.from({ length: n }, (_, j) => Math.sin((2 * Math.PI * j) / n));
    const [top, next] = dft(xs, ys);
    expect(top.freq).toBe(1);
    expect(top.amp).toBeCloseTo(1, 12);
    expect(next.amp).toBeLessThan(1e-12);
  });

  it('error falls as terms are added', () => {
    const [xs, ys] = shape('heart', mulberry32(1));
    const terms = dft(xs, ys);
    let prev = Infinity;
    for (const k of [1, 2, 4, 8, 16, 32, 64]) {
      const e = rmsError(terms, k, xs, ys);
      expect(e).toBeLessThanOrEqual(prev + 1e-12);
      prev = e;
    }
  });

  it('corners cost terms: at 12 terms the square is approximated worse than the trefoil', () => {
    const rel = (id: string) => {
      const [xs, ys] = shape(id, mulberry32(1));
      let size = 0;
      for (let j = 0; j < xs.length; j++) size += xs[j] ** 2 + ys[j] ** 2;
      return rmsError(dft(xs, ys), 12, xs, ys) / Math.sqrt(size / xs.length);
    };
    expect(rel('square')).toBeGreaterThan(rel('trefoil'));
  });

  it('resampling keeps points on the polygon and evenly spaced', () => {
    const [xs, ys] = resample([[0, 0], [1, 0], [1, 1], [0, 1]], 40);
    for (let j = 0; j < 40; j++) {
      const onEdge = Math.min(Math.abs(xs[j]), Math.abs(xs[j] - 1), Math.abs(ys[j]),
        Math.abs(ys[j] - 1));
      expect(onEdge).toBeLessThan(1e-12);
    }
    expect(Math.hypot(xs[1] - xs[0], ys[1] - ys[0])).toBeCloseTo(0.1, 12);
  });
});
