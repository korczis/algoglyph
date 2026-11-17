// A derivative from function values alone: forward, central and five-point difference quotients
// at a point x₀, with the step h halved each step of the run. Each error is measured against the
// closed-form derivative, and each scheme's order is measured from the halving itself: the slope
// of log |error| against log h over the steps where truncation, not rounding, sets the error.
import type { Chart, SelectParam } from '../../core/plate';
import { fmt, int, logSlope, sample, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';

export interface Differentiable {
  label: string;
  f: (x: number) => number;
  /** The derivative in closed form, the oracle every error is measured against. */
  d: (x: number) => number;
  /** |f‴(x₀)|, for the step at which central differences are most accurate. */
  d3: (x: number) => number;
  x0: number;
}

export const FUNCTIONS: Record<string, Differentiable> = {
  sine: { label: 'sin x at x₀ = 1', f: Math.sin, d: Math.cos, d3: (x) => Math.abs(Math.cos(x)), x0: 1 },
  exp: { label: 'eˣ at x₀ = 0.5', f: Math.exp, d: Math.exp, d3: Math.exp, x0: 0.5 },
  // a cubic: central differences err by exactly h², and five points differentiate it exactly
  cubic: { label: 'x³ at x₀ = 1', f: (x) => x * x * x, d: (x) => 3 * x * x, d3: () => 6, x0: 1 },
  atan: { label: 'atan 4x at x₀ = 0.3', f: (x) => Math.atan(4 * x), d: (x) => 4 / (1 + 16 * x * x),
    d3: (x) => Math.abs((128 * (48 * x * x - 1)) / (1 + 16 * x * x) ** 3), x0: 0.3 },
};

export const functionParam = (): SelectParam => ({
  kind: 'select', key: 'fn', label: 'Function', value: 'sine', rebuild: true,
  options: Object.entries(FUNCTIONS).map(([value, g]) => ({ value, label: g.label })),
});

export const differentiable = (key: unknown): Differentiable => FUNCTIONS[String(key)] ?? FUNCTIONS.sine;

type F = (x: number) => number;

/** (f(x + h) − f(x)) / h: first order. */
export const forward = (f: F, x: number, h: number) => (f(x + h) - f(x)) / h;
/** (f(x + h) − f(x − h)) / 2h: second order. */
export const central = (f: F, x: number, h: number) => (f(x + h) - f(x - h)) / (2 * h);
/** The five-point stencil (−f(x + 2h) + 8f(x + h) − 8f(x − h) + f(x − 2h)) / 12h: fourth order. */
export const fivePoint = (f: F, x: number, h: number) =>
  (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);

export const SCHEMES = [
  { key: 'forward', name: 'Forward', order: 1, q: forward },
  { key: 'central', name: 'Central', order: 2, q: central },
  { key: 'five', name: 'Five-point', order: 4, q: fivePoint },
] as const;

/** The exponents k of the steps h = 2⁻ᵏ the run visits, one a step. */
export const HALVINGS = Array.from({ length: 30 }, (_, i) => i + 1);
/** The steps whose error truncation sets on every function offered: h = 1/4 … 1/64. */
export const TRUNCATION: [number, number] = [2, 6];

/** |error| of each scheme at every step h = 2⁻ᵏ. */
export function errors(g: Differentiable): { h: number; e: number[] }[] {
  const exact = g.d(g.x0);
  return HALVINGS.map((k) => {
    const h = 2 ** -k;
    return { h, e: SCHEMES.map((s) => Math.abs(s.q(g.f, g.x0, h) - exact)) };
  });
}

/** Each scheme's order measured by h-halving over the truncation range; NaN where no error is left. */
export function orders(rows: { h: number; e: number[] }[]): number[] {
  const inRange = rows.filter((_, i) => HALVINGS[i] >= TRUNCATION[0] && HALVINGS[i] <= TRUNCATION[1]);
  return SCHEMES.map((_, s) => logSlope(inRange.map((r) => [r.h, r.e[s]] as XY)));
}

const EPS = 2 ** -52;

/** The step at which central differences are most accurate, truncation h²|f‴|/6 against rounding ε|f|/h. */
export const centralOptimum = (g: Differentiable) => Math.cbrt((3 * EPS * Math.max(Math.abs(g.f(g.x0)), 1e-300)) / g.d3(g.x0));

const axes = { x: { label: 'step h', log: true }, y: { label: '|error|', log: true } };

const sci = (v: number) => (v === 0 ? '0' : v.toExponential(2));

export const kernel: NumericKernel = {
  params: [functionParam()],
  thumb: 0.15,
  run({ params }) {
    const g = differentiable(params.fn);
    const exact = g.d(g.x0);
    const wide = sample(g.f, g.x0 - 2, g.x0 + 2, 400);
    const rows = errors(g);
    const p = orders(rows);
    const opt = centralOptimum(g);
    const panels = [
      { title: 'The function and the stencil', x: [g.x0 - 2, g.x0 + 2] as [number, number], y: span(wide.map((q) => q[1])), axes: true, weight: 1 },
      { title: 'Zoomed to the stencil, x₀ ± 2.5h', x: [-2.5, 2.5] as [number, number], y: [-3, 3] as [number, number], axes: true, weight: 1 },
    ];
    const series = (k: number) => SCHEMES.map((s, i) => ({
      name: s.name, points: rows.slice(0, k + 1).filter((r) => r.e[i] > 0).map((r) => [r.h, r.e[i]] as XY),
    }));
    const best = SCHEMES.map((_, i) => rows.reduce((b, r) => (r.e[i] < b.e[i] ? r : b), rows[0]));
    const steps = rows.map((r, k) => {
      const h = r.h;
      const est = SCHEMES.map((s) => s.q(g.f, g.x0, h));
      const layers: Layer[] = [{ kind: 'curve', pts: wide, alpha: 0.6, weight: 1.5 }];
      const nodes = [-2, -1, 0, 1, 2].map((m) => [g.x0 + m * h, g.f(g.x0 + m * h)] as XY);
      // the tangent and each estimate's line through (x₀, f(x₀)), over the wide panel
      const f0 = g.f(g.x0);
      const line = (slope: number, w: number): [number, number, number, number] => [g.x0 - w, f0 - slope * w, g.x0 + w, f0 + slope * w];
      layers.push({ kind: 'segments', segs: [line(exact, 1.5)], weight: 1, tone: -1, alpha: 0.5 });
      est.forEach((m, i) => layers.push({ kind: 'segments', segs: [line(m, 1.5)], weight: 2, tone: 0.15 + 0.35 * i, alpha: 0.85 }));
      layers.push({ kind: 'points', pts: nodes, size: 6 });
      // zoomed: x in units of h about x₀, y the departure from the tangent in units of h²|f″|/2 + h
      const scale = Math.max(h * h, 1e-300);
      const z = (x: number) => (g.f(g.x0 + x * h) - f0 - exact * x * h) / scale;
      const zoom = sample(z, -2.5, 2.5, 120).map(([x, y]) => [x, Math.max(-3, Math.min(3, y))] as XY);
      layers.push({ kind: 'curve', panel: 1, pts: zoom, weight: 1.5, alpha: 0.6 });
      layers.push({ kind: 'points', panel: 1, pts: [-2, -1, 0, 1, 2].map((m) => [m, Math.max(-3, Math.min(3, z(m)))] as XY), size: 6 });
      layers.push({ kind: 'text', panel: 1, x: 0, y: 2.6, text: `h = 2^−${HALVINGS[k]}`, align: 'center' });
      const chart: Chart = { title: 'Error against the step, halved each step', ...axes, series: series(k) };
      const ratio = (i: number) => (k && r.e[i] > 0 && rows[k - 1].e[i] > 0 ? fmt(Math.log2(rows[k - 1].e[i] / r.e[i]), 3) : '—');
      return {
        layers,
        chart,
        stats: [
          { label: 'Step h', value: `2^−${HALVINGS[k]} = ${sci(h)}` },
          { label: 'Exact derivative f′(x₀), closed form', value: fmt(exact, 12) },
          ...SCHEMES.map((s, i) => ({ label: `${s.name} difference, error`, value: `${sci(r.e[i])} (estimate ${fmt(est[i], 12)})` })),
          { label: 'This halving, log₂ of the error ratio', value: `forward ${ratio(0)}, central ${ratio(1)}, five-point ${ratio(2)}` },
          ...SCHEMES.map((s, i) => ({ label: `${s.name} differences, measured order`, value: Number.isFinite(p[i]) ? fmt(p[i], 4) : 'no error left to fit' })),
          { label: 'Measured over', value: `h = 2^−${TRUNCATION[0]} … 2^−${TRUNCATION[1]}, where truncation sets the error` },
          ...SCHEMES.map((s, i) => ({ label: `${s.name} differences, smallest error`, value: `${sci(best[i].e[i])} at h = ${sci(best[i].h)}` })),
          { label: 'Central differences, best step, log₂', value: fmt(Math.log2(best[1].h), 4) },
          { label: 'Central differences, predicted best step (3ε|f|/|f‴|)^⅓, log₂', value: fmt(Math.log2(opt), 4) },
          { label: 'Central error at the smallest step, over its smallest', value: best[1].e[1] > 0 ? fmt(rows[rows.length - 1].e[1] / best[1].e[1], 4) : 'no error left' },
          { label: 'Steps', value: int(rows.length) },
        ],
      };
    });
    return { panels, steps };
  },
};
