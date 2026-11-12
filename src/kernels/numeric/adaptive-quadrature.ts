// Adaptive Simpson quadrature: estimate an interval with one parabola and with two, accept when
// they agree within the interval's share of the tolerance, split otherwise. Each node is
// evaluated once (the parent hands its values down), and every evaluation is counted.
import { drain, fmt, int, mapSliced, Meter, sample, span, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';
import { integrand, integrandParam } from './_functions';
import { convergence } from './simpson-quadrature';

export interface Piece { a: number; b: number; depth: number; accepted: boolean; value: number }

export interface Adaptive { value: number; evals: number; pieces: Piece[]; nodes: XY[]; maxDepth: number }

/** Integrate f over [a, b] to within about eps (Lyness's criterion, |S2 - S1| <= 15 eps). */
export function adaptiveSimpson(f: (x: number) => number, a: number, b: number, eps: number, depthCap = 40): Adaptive {
  const m = new Meter();
  const nodes: XY[] = [];
  const g = (x: number) => { const y = m.counted(f)(x); nodes.push([x, y]); return y; };
  const pieces: Piece[] = [];
  let maxDepth = 0;
  const simp = (fa: number, fm: number, fb: number, h: number) => (h / 6) * (fa + 4 * fm + fb);
  const rec = (lo: number, hi: number, flo: number, fmid: number, fhi: number, whole: number, tol: number, depth: number): number => {
    const mid = (lo + hi) / 2;
    const fl = g((lo + mid) / 2);
    const fr = g((mid + hi) / 2);
    const left = simp(flo, fl, fmid, mid - lo);
    const right = simp(fmid, fr, fhi, hi - mid);
    const diff = left + right - whole;
    maxDepth = Math.max(maxDepth, depth);
    if (depth >= depthCap || Math.abs(diff) <= 15 * tol) {
      const value = left + right + diff / 15;
      pieces.push({ a: lo, b: hi, depth, accepted: true, value });
      return value;
    }
    pieces.push({ a: lo, b: hi, depth, accepted: false, value: NaN });
    return rec(lo, mid, flo, fl, fmid, left, tol / 2, depth + 1) + rec(mid, hi, fmid, fr, fhi, right, tol / 2, depth + 1);
  };
  const fa = g(a); const fb = g(b); const fm = g((a + b) / 2);
  const value = rec(a, b, fa, fm, fb, simp(fa, fm, fb, b - a), eps, 0);
  return { value, evals: m.get('evals'), pieces, nodes, maxDepth };
}

const TOLS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Error against evaluations as the tolerance tightens from 1e-2 to 1e-10. */
export function sweep(key: unknown): XY[] {
  return drain(sweepSteps(key));
}

/** sweep(), resumable: it yields after each tolerance. */
export function* sweepSteps(key: unknown): Generator<void, XY[], void> {
  const g = integrand(key);
  return yield* mapSliced(TOLS, (t) => { const r = adaptiveSimpson(g.f, g.a, g.b, 10 ** -t); return [r.evals, Math.abs(r.value - g.exact)] as XY; }, 1);
}

const axes = { x: { label: 'function evaluations', log: true }, y: { label: '|error|', log: true } };

function* build({ params }: RunInput): Generator<void, NumericRun, void> {
  const g = integrand(params.integrand);
  const eps = 10 ** -Number(params.tol ?? 6);
  const r = adaptiveSimpson(g.f, g.a, g.b, eps);
  yield;
  const curve = sample(g.f, g.a, g.b, 600);
  const yr = span([0, ...curve.map((q) => q[1])]);
  const panels = [
    { title: 'Integrand and the nodes evaluated', x: [g.a, g.b] as [number, number], y: yr, axes: true, weight: 1.4 },
    { title: 'Accepted intervals by depth', x: [g.a, g.b] as [number, number], y: [-(r.maxDepth + 1), 0.5] as [number, number] },
  ];
  const uniform = convergence(params.integrand).simp;
  yield;
  const chart = {
    title: 'Error against evaluations', ...axes,
    series: [{ name: 'Adaptive Simpson', points: yield* sweepSteps(params.integrand) }, { name: 'Uniform Simpson', points: uniform }],
  };
  // nodes are evaluated three at the start, then two per examined interval
  const steps: NumericRun['steps'] = [];
  const total = r.pieces.length;
  const per = Math.max(1, Math.ceil(total / 160));
  for (let k = per; k < total + per; k += per) {
    const upto = Math.min(k, total);
    const done = r.pieces.slice(0, upto);
    const accepted = done.filter((q) => q.accepted);
    const cur = done[done.length - 1];
    const layers: Layer[] = [
      { kind: 'curve', pts: curve, alpha: 0.5, weight: 1.5 },
      { kind: 'rects', rects: accepted.map((q, i) => [q.a, yr[0], q.b - q.a, yr[1] - yr[0], i % 2 ? 0.2 : 0.35] as [number, number, number, number, number]), alpha: 0.18 },
      { kind: 'points', pts: r.nodes, n: 3 + 2 * upto, size: 3.5, tone: 0.85 },
      { kind: 'rects', panel: 1, rects: done.map((q) => [q.a, -q.depth - 1, q.b - q.a, 0.8, q.accepted ? 0.3 : 0.75] as [number, number, number, number, number]), alpha: 0.85 },
    ];
    if (cur) layers.push({ kind: 'rects', rects: [[cur.a, yr[0], cur.b - cur.a, yr[1] - yr[0], -1]], outline: true, alpha: 0.7 });
    const partial = accepted.reduce((s, q) => s + q.value, 0);
    steps.push({
      layers,
      stats: [
        { label: 'Evaluations', value: `${int(3 + 2 * upto)} of ${int(r.evals)}` },
        { label: 'Intervals examined', value: `${int(upto)} (${int(accepted.length)} accepted)` },
        { label: 'Accepted area so far', value: fmt(partial, 10) },
        { label: 'Final estimate', value: `${fmt(r.value, 12)} (error ${fmt(Math.abs(r.value - g.exact))} against tolerance ${fmt(eps)})` },
        { label: 'Deepest split', value: int(r.maxDepth) },
      ],
    });
    yield;
  }
  return { panels, steps, chart };
}

export const kernel: NumericKernel = {
  params: [
    integrandParam(),
    { kind: 'range', key: 'tol', label: 'Tolerance 10^-k, k', min: 2, max: 10, step: 1, value: 6, rebuild: true },
  ],
  build,
  run: (inp) => drain(build(inp)),
  probe: {
    ...axes,
    measure({ params }) { return [{ name: 'tolerance 1e-2 to 1e-10', points: sweep(params.integrand) }]; },
  },
};
