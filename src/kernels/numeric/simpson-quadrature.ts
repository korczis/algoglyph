// Composite trapezoid and Simpson rules on n panels, n doubling each step; every evaluation of
// the integrand is counted, and the error is measured against the closed-form integral.
import type { Chart } from '../../core/plate';
import { fmt, int, logSlope, Meter, sample, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { integrand, integrandParam } from './_functions';

/** Composite trapezoid rule with n panels. */
export function trapezoid(f: (x: number) => number, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let s = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i++) s += f(a + i * h);
  return s * h;
}

/** Composite Simpson rule with n panels (n even). */
export function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  if (n % 2) throw new RangeError('Simpson needs an even number of panels');
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

const SIZES = Array.from({ length: 10 }, (_, k) => 2 ** (k + 1));

/** Error against evaluations for both rules, as n doubles. */
export function convergence(key: unknown): { trap: XY[]; simp: XY[] } {
  const g = integrand(key);
  const trap: XY[] = []; const simp: XY[] = [];
  for (const n of SIZES) {
    const mt = new Meter(); const ms = new Meter();
    const t = trapezoid(mt.counted(g.f), g.a, g.b, n);
    const s = simpson(ms.counted(g.f), g.a, g.b, n);
    trap.push([mt.get('evals'), Math.abs(t - g.exact)]);
    simp.push([ms.get('evals'), Math.abs(s - g.exact)]);
  }
  return { trap, simp };
}

const axes = { x: { label: 'function evaluations', log: true }, y: { label: '|error|', log: true } };

/** The fitted order of an error series, or a note when no nonzero error is left to fit. */
function order(pts: XY[]): string {
  const p = logSlope(pts);
  return Number.isFinite(p) ? `n^${fmt(p, 3)}` : 'no error to fit';
}

export const kernel: NumericKernel = {
  params: [integrandParam()],
  thumb: 0.3,
  run({ params }) {
    const g = integrand(params.integrand);
    const curve = sample(g.f, g.a, g.b, 400);
    const yr = span([0, ...curve.map((q) => q[1])]);
    const panels = [
      { title: 'Trapezoids', x: [g.a, g.b] as [number, number], y: yr, axes: true },
      { title: 'Simpson parabolas', x: [g.a, g.b] as [number, number], y: yr, axes: true },
    ];
    const { trap, simp } = convergence(params.integrand);
    const steps = SIZES.map((n, k) => {
      const h = (g.b - g.a) / n;
      const xs = Array.from({ length: n + 1 }, (_, i) => g.a + i * h);
      const ys = xs.map(g.f);
      const layers: Layer[] = [];
      for (const panel of [0, 1]) layers.push({ kind: 'curve', panel, pts: curve, alpha: 0.35, weight: 1.5 });
      if (n <= 128) {
        for (let i = 0; i < n; i++) {
          layers.push({ kind: 'polygon', pts: [[xs[i], 0], [xs[i], ys[i]], [xs[i + 1], ys[i + 1]], [xs[i + 1], 0]],
            tone: i % 2 ? 0.15 : 0.3, alpha: 0.55 });
        }
        for (let i = 0; i < n; i += 2) {
          const [x0, x1, x2] = [xs[i], xs[i + 1], xs[i + 2]];
          const [y0, y1, y2] = [ys[i], ys[i + 1], ys[i + 2]];
          // the parabola through the three nodes, in Lagrange form
          const q = (x: number) => y0 * ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2))
            + y1 * ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2)) + y2 * ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
          const arc = sample(q, x0, x2, 12);
          layers.push({ kind: 'polygon', panel: 1, pts: [[x0, 0], ...arc, [x2, 0]], tone: (i / 2) % 2 ? 0.75 : 0.9, alpha: 0.55 });
        }
      }
      layers.push({ kind: 'points', pts: xs.map((x, i) => [x, ys[i]] as XY), size: n > 128 ? 1.5 : 4 });
      layers.push({ kind: 'points', panel: 1, pts: xs.map((x, i) => [x, ys[i]] as XY), size: n > 128 ? 1.5 : 4 });
      const t = trapezoid(g.f, g.a, g.b, n);
      const s = simpson(g.f, g.a, g.b, n);
      const simpErr = Math.abs(s - g.exact);
      const chart: Chart = {
        title: 'Error against evaluations', ...axes,
        series: [{ name: 'Trapezoid', points: trap.slice(0, k + 1) }, { name: 'Simpson', points: simp.slice(0, k + 1) }],
      };
      return {
        layers,
        chart,
        stats: [
          { label: 'Panels n', value: int(n) },
          { label: 'Exact integral', value: fmt(g.exact, 10) },
          { label: 'Trapezoid', value: `${fmt(t, 10)} (error ${fmt(Math.abs(t - g.exact))}, ${int(trap[k][0])} evaluations)` },
          { label: 'Simpson', value: `${fmt(s, 10)} (error ${fmt(Math.abs(s - g.exact))}, ${int(simp[k][0])} evaluations)` },
          { label: 'Measured order so far', value: k ? `trapezoid ${order(trap.slice(0, k + 1))}, Simpson ${order(simp.slice(0, k + 1))}` : 'after two sizes' },
          // the error alone, as a first number, with four significant digits
          { label: 'Simpson error', value: `${simpErr === 0 ? '0' : simpErr.toExponential(3)} on ${int(n)} panels` },
        ],
      };
    });
    return { panels, steps };
  },
  probe: {
    ...axes,
    measure({ params }) {
      const { trap, simp } = convergence(params.integrand);
      return [{ name: 'trapezoid', points: trap }, { name: 'Simpson', points: simp }];
    },
  },
};
