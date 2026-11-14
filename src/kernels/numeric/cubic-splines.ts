// The natural cubic spline through n knots: a tridiagonal system for the second derivatives at
// the knots (solved by forward elimination and back substitution), then one cubic per interval.
import { fitLine, fmt, int, sample, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { maxError, target, targetParam } from './_functions';
import { errors as polyErrors, nodes } from './polynomial-interpolation';

export interface Spline {
  xs: number[];
  ys: number[];
  /** Second derivative at each knot; zero at both ends (natural). */
  m: number[];
  at(x: number): number;
  slope(x: number): number;
  curvature(x: number): number;
}

/** Solve a tridiagonal system (sub a, diagonal b, super c, right side d) without pivoting. */
export function tridiagonal(a: number[], b: number[], c: number[], d: number[]): number[] {
  const n = b.length;
  const cp = new Array<number>(n).fill(0);
  const dp = new Array<number>(n).fill(0);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const w = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / w;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / w;
  }
  const x = new Array<number>(n).fill(0);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export function naturalSpline(xs: number[], ys: number[]): Spline {
  const n = xs.length;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const m = new Array<number>(n).fill(0);
  if (n > 2) {
    const k = n - 2;
    const a = new Array<number>(k).fill(0); const b = new Array<number>(k).fill(0);
    const c = new Array<number>(k).fill(0); const d = new Array<number>(k).fill(0);
    for (let i = 1; i <= k; i++) {
      a[i - 1] = h[i - 1];
      b[i - 1] = 2 * (h[i - 1] + h[i]);
      c[i - 1] = h[i];
      d[i - 1] = 6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]);
    }
    tridiagonal(a, b, c, d).forEach((v, i) => { m[i + 1] = v; });
  }
  const seg = (x: number) => {
    let lo = 0; let hi = n - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const parts = (x: number) => {
    const i = seg(x);
    const hi = h[i];
    const A = (xs[i + 1] - x) / hi;
    const B = (x - xs[i]) / hi;
    return { i, hi, A, B };
  };
  return {
    xs, ys, m,
    at(x) {
      const { i, hi, A, B } = parts(x);
      return A * ys[i] + B * ys[i + 1] + ((A ** 3 - A) * m[i] + (B ** 3 - B) * m[i + 1]) * (hi * hi) / 6;
    },
    slope(x) {
      const { i, hi, A, B } = parts(x);
      return (ys[i + 1] - ys[i]) / hi - ((3 * A * A - 1) * m[i] - (3 * B * B - 1) * m[i + 1]) * hi / 6;
    },
    curvature(x) {
      const { i, A, B } = parts(x);
      return A * m[i] + B * m[i + 1];
    },
  };
}

const NS = Array.from({ length: 23 }, (_, i) => i + 3);

export function errors(key: unknown): XY[] {
  const f = target(key).f;
  return NS.map((n) => { const xs = nodes('equal', n); return [n, maxError(f, naturalSpline(xs, xs.map(f)).at)] as XY; });
}

/** Largest jump of the slope across the interior knots, from each side's own cubic. */
export function slopeJump(s: Spline): number {
  let j = 0;
  for (let i = 1; i < s.xs.length - 1; i++) {
    const x = s.xs[i];
    const h = Math.min(s.xs[i] - s.xs[i - 1], s.xs[i + 1] - s.xs[i]) * 1e-7;
    j = Math.max(j, Math.abs(s.slope(x - h) - s.slope(x + h)));
  }
  return j;
}

const axes = { x: { label: 'nodes n' }, y: { label: 'max |f - s|', log: true } };

/**
 * The order p in error ≈ C·h^p, fitted by least squares to the chart's measured errors over the
 * last halving of h (knots ⌈(N + 1)/2⌉ … N, with h = 2/(n − 1)), with the slope's standard
 * error from the fit's residuals. Null until the window holds three sizes.
 */
export function measuredOrder(se: XY[], upto: number): { p: number; sd: number; from: number } | null {
  const from = Math.ceil((upto + 1) / 2);
  const pts = se.filter(([n, e]) => n >= from && n <= upto && e > 0).map(([n, e]) => [Math.log(2 / (n - 1)), Math.log(e)] as XY);
  if (pts.length < 3) return null;
  const [p, c] = fitLine(pts);
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const sxx = pts.reduce((s, q) => s + (q[0] - mx) ** 2, 0);
  const rss = pts.reduce((s, [x, y]) => s + (y - p * x - c) ** 2, 0);
  return { p, sd: Math.sqrt(rss / (pts.length - 2) / sxx), from };
}

export const kernel: NumericKernel = {
  params: [targetParam()],
  thumb: 0.3,
  run({ params }) {
    const t = target(params.target);
    const fc = sample(t.f, -1, 1, 400);
    const yr = span(fc.map((q) => q[1]), 0.3);
    const se = errors(params.target);
    const pe = polyErrors(params.target, 'equal');
    let ky = [Infinity, -Infinity];
    const steps = NS.map((n, k) => {
      const xs = nodes('equal', n);
      const s = naturalSpline(xs, xs.map(t.f));
      const layers: Layer[] = [{ kind: 'curve', pts: fc, alpha: 0.4, weight: 3 }];
      for (let i = 0; i < n - 1; i++) {
        layers.push({ kind: 'curve', pts: sample(s.at, xs[i], xs[i + 1], 24), tone: i % 2 ? 0.2 : 0.8, weight: 2.5 });
        layers.push({ kind: 'curve', panel: 1, pts: [[xs[i], s.m[i]], [xs[i + 1], s.m[i + 1]]], tone: i % 2 ? 0.2 : 0.8, weight: 2 });
      }
      layers.push({ kind: 'points', pts: xs.map((x, i) => [x, s.ys[i]] as XY), size: 6 });
      layers.push({ kind: 'points', panel: 1, pts: xs.map((x, i) => [x, s.m[i]] as XY), size: 5 });
      ky = [Math.min(ky[0], ...s.m), Math.max(ky[1], ...s.m)];
      const fitted = measuredOrder(se, n);
      return {
        layers,
        chart: {
          title: 'Max error as knots are added', ...axes,
          series: [{ name: 'Natural cubic spline', points: se.slice(0, k + 1) },
            { name: 'One polynomial, equal spacing', points: pe.filter((q) => q[0] <= n) }],
        },
        stats: [
          { label: 'Knots', value: int(n) },
          { label: 'Max error on [-1, 1]', value: fmt(se[k][1]) },
          { label: 'One polynomial through the same knots', value: fmt(pe.find((q) => q[0] === n)?.[1] ?? NaN) },
          { label: 'Largest slope jump at a knot', value: fmt(slopeJump(s)) },
          { label: 'Curvature at the ends', value: `${fmt(s.curvature(-1))}, ${fmt(s.curvature(1))}` },
          { label: 'Measured order, last halving of h', value: fitted ? `${fmt(fitted.p, 4)} ± ${fmt(fitted.sd, 2)} (h^p fitted over n = ${fitted.from}…${n})` : 'after three sizes' },
        ],
      };
    });
    return {
      panels: [
        { title: `${t.label}, one cubic per interval`, x: [-1, 1], y: yr, axes: true, weight: 1.4 },
        { title: 'Second derivative s″ (piecewise linear)', x: [-1, 1], y: span(ky), axes: true },
      ],
      steps,
    };
  },
  probe: {
    ...axes,
    measure({ params }) { return [{ name: 'natural', points: errors(params.target) }]; },
  },
};
