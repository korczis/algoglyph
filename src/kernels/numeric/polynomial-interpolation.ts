// The polynomial through n nodes, in Newton's divided-difference form, for equally spaced and
// Chebyshev nodes; the error is measured on a fine grid against the function itself.
import { fmt, int, sample, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { maxError, target, targetParam } from './_functions';

export type Spacing = 'equal' | 'chebyshev';

/** n nodes on [-1, 1]: equally spaced, or the Chebyshev points cos((2k + 1)π / 2n). */
export function nodes(kind: Spacing, n: number): number[] {
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, k) => (kind === 'equal'
    ? -1 + (2 * k) / (n - 1)
    : -Math.cos(((2 * k + 1) * Math.PI) / (2 * n))));
}

/** Divided-difference coefficients c with p(x) = c0 + c1 (x - x0) + c2 (x - x0)(x - x1) + ... */
export function dividedDifferences(xs: number[], ys: number[]): number[] {
  const c = ys.slice();
  for (let j = 1; j < xs.length; j++) {
    for (let i = xs.length - 1; i >= j; i--) c[i] = (c[i] - c[i - 1]) / (xs[i] - xs[i - j]);
  }
  return c;
}

/** Evaluate the Newton form by nesting from the highest term. */
export function newtonEval(xs: number[], c: number[], x: number): number {
  let v = c[c.length - 1];
  for (let i = c.length - 2; i >= 0; i--) v = v * (x - xs[i]) + c[i];
  return v;
}

export function interpolant(f: (x: number) => number, kind: Spacing, n: number): (x: number) => number {
  const xs = nodes(kind, n);
  const c = dividedDifferences(xs, xs.map(f));
  return (x) => newtonEval(xs, c, x);
}

const NS = Array.from({ length: 24 }, (_, i) => i + 2);

export function errors(key: unknown, kind: Spacing): XY[] {
  const f = target(key).f;
  return NS.map((n) => [n, maxError(f, interpolant(f, kind, n))] as XY);
}

const axes = { x: { label: 'nodes n' }, y: { label: 'max |f - p|', log: true } };

export const kernel: NumericKernel = {
  params: [
    targetParam(),
    { kind: 'select', key: 'spacing', label: 'Nodes', value: 'equal', rebuild: true,
      options: [{ value: 'equal', label: 'Equally spaced' }, { value: 'chebyshev', label: 'Chebyshev' }] },
  ],
  thumb: 0.5,
  run({ params }) {
    const t = target(params.target);
    const kind = (params.spacing === 'chebyshev' ? 'chebyshev' : 'equal') as Spacing;
    const fc = sample(t.f, -1, 1, 400);
    const yr = span(fc.map((q) => q[1]), 0.5);
    const eq = errors(params.target, 'equal');
    const ch = errors(params.target, 'chebyshev');
    const steps = NS.map((n, k) => {
      const xs = nodes(kind, n);
      const c = dividedDifferences(xs, xs.map(t.f));
      const p = (x: number) => newtonEval(xs, c, x);
      const pc = sample(p, -1, 1, 600);
      const err = sample((x) => t.f(x) - p(x), -1, 1, 600);
      const e = maxError(t.f, p);
      const layers: Layer[] = [
        { kind: 'curve', pts: fc, alpha: 0.4, weight: 3 },
        { kind: 'curve', pts: pc, tone: 0.15, weight: 2 },
        { kind: 'points', pts: xs.map((x) => [x, t.f(x)] as XY), size: 6, tone: 0.85 },
        { kind: 'curve', panel: 1, pts: err, tone: 0.15, weight: 1.5 },
        { kind: 'points', panel: 1, pts: xs.map((x) => [x, 0] as XY), size: 4, tone: 0.85 },
      ];
      return {
        layers,
        chart: {
          title: 'Max error as nodes are added', ...axes,
          series: [{ name: 'Equally spaced', points: eq.slice(0, k + 1) }, { name: 'Chebyshev', points: ch.slice(0, k + 1) }],
        },
        stats: [
          { label: 'Nodes', value: `${int(n)} (degree ${n - 1})` },
          { label: 'Max error on [-1, 1]', value: fmt(e) },
          { label: 'Largest Newton coefficient', value: fmt(Math.max(...c.map(Math.abs))) },
          { label: 'Other spacing, same n', value: fmt((kind === 'equal' ? ch : eq)[k][1]) },
        ],
      };
    });
    const er = span(sample((x) => t.f(x) - interpolant(t.f, kind, 8)(x), -1, 1, 300).map((q) => q[1]), 0.2);
    return {
      panels: [
        { title: `${t.label} and its interpolant`, x: [-1, 1], y: yr, axes: true, weight: 1.4 },
        { title: 'Error f − p', x: [-1, 1], y: er, axes: true },
      ],
      steps,
    };
  },
  probe: {
    ...axes,
    measure({ params }) {
      return [{ name: 'equal', points: errors(params.target, 'equal') }, { name: 'Chebyshev', points: errors(params.target, 'chebyshev') }];
    },
  },
};
