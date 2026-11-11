import { num, str } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import type { StochasticKernel } from '../../engines/stochastic/trace';

export interface SobolModel {
  d: number;
  lo: number;
  hi: number;
  f(x: number[]): number;
  /** Analytic first-order and total indices. */
  first: number[];
  total: number[];
}

/** An additive linear model of uniform inputs: S_i = S_Ti = a_i² / Σ a_j². */
export function additive(a: number[]): SobolModel {
  const ss = a.reduce((t, ai) => t + ai * ai, 0);
  const s = a.map((ai) => (ai * ai) / ss);
  return { d: a.length, lo: 0, hi: 1, f: (x) => a.reduce((t, ai, i) => t + ai * x[i], 0), first: s, total: s.slice() };
}

/** The Ishigami function on [-π, π]³ with a = 7, b = 0.1, and its known indices. */
export function ishigami(): SobolModel {
  const a = 7;
  const b = 0.1;
  const pi4 = Math.PI ** 4;
  const v1 = 0.5 * (1 + (b * pi4) / 5) ** 2;
  const v2 = (a * a) / 8;
  const v13 = (b * b * pi4 * pi4 * 8) / 225;
  const v = v1 + v2 + v13;
  return {
    d: 3, lo: -Math.PI, hi: Math.PI,
    f: (x) => Math.sin(x[0]) + a * Math.sin(x[1]) ** 2 + b * x[2] ** 4 * Math.sin(x[0]),
    first: [v1 / v, v2 / v, 0],
    total: [(v1 + v13) / v, v2 / v, v13 / v],
  };
}

export interface SobolResult { first: number[]; total: number[]; analyticFirst: number[]; analyticTotal: number[]; n: number }

const FRAMES = 120;

// Two independent sample matrices A and B, and for each input i a matrix A_B(i): A with
// column i taken from B. The first-order index (Saltelli 2010) correlates f(B), centred on
// the sample mean, with f(A_B(i)) - f(A); the total index (Jansen) is half the mean square of f(A) - f(A_B(i)),
// each divided by the output variance. Cost: N (d + 2) evaluations.
export const kernel: StochasticKernel<SobolResult> = {
  palette: 'riso',
  params: [
    {
      kind: 'select', key: 'model', label: 'Model', value: 'ishigami', rebuild: true,
      options: [{ value: 'ishigami', label: 'Ishigami (interaction)' }, { value: 'additive', label: 'Additive linear' }],
    },
    { kind: 'range', key: 'n', label: 'Base samples N', min: 200, max: 20000, step: 200, value: 4000, rebuild: true },
  ],
  chart: { title: 'First-order indices as samples grow', x: { label: 'evaluations', log: true }, y: { label: 'S_i' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const m = str(cfg, 'model') === 'additive'
      ? additive(Array.from({ length: 4 }, () => s.uniform(0.2, 3)))
      : ishigami();
    const n = num(cfg, 'n');
    const d = m.d;
    const draw = () => Array.from({ length: d }, () => s.uniform(m.lo, m.hi));
    let sumA = 0;
    let sumA2 = 0;
    let sumB = 0;
    let sumB2 = 0;
    const sf = new Array<number>(d).fill(0);
    const st = new Array<number>(d).fill(0);
    // sums of f(A_B(i)) - f(A), so f(B) can be centred on the sample mean afterwards
    const sd = new Array<number>(d).fill(0);
    let k = 0;
    const tone = (i: number) => 0.1 + (0.8 * i) / Math.max(1, d - 1);
    for (let fr = 1; fr <= FRAMES; fr++) {
      const end = Math.max(2, Math.round(n * (fr / FRAMES) ** 2));
      for (; k < end; k++) {
        const a = draw();
        const b = draw();
        const fa = ops.evaluate(m.f, a);
        const fb = ops.evaluate(m.f, b);
        sumA += fa; sumA2 += fa * fa; sumB += fb; sumB2 += fb * fb;
        for (let i = 0; i < d; i++) {
          const ab = a.slice();
          ab[i] = b[i];
          const fab = ops.evaluate(m.f, ab);
          sf[i] += fb * (fab - fa);
          sd[i] += fab - fa;
          st[i] += (fa - fab) ** 2;
        }
        if (k % 1000 === 999) yield;
      }
      const mean = (sumA + sumB) / (2 * k);
      const v = (sumA2 + sumB2) / (2 * k) - mean * mean;
      const first = sf.map((t, i) => (t - mean * sd[i]) / k / v);
      const total = st.map((t) => t / (2 * k) / v);
      first.forEach((si, i) => ops.point(`S${i + 1}`, ops.evals, si));
      ops.frame([{
        kind: 'bars', title: 'First-order (upper) and total (lower) indices; ticks are analytic', x: [Math.min(0, ...first) - 0.05, 1],
        rows: first.flatMap((si, i) => [
          { label: `x${i + 1} first`, lo: 0, hi: si, tone: tone(i), mark: m.first[i] },
          { label: `x${i + 1} total`, lo: 0, hi: total[i], tone: tone(i), mark: m.total[i] },
        ]),
      }], [
        { label: 'Base samples N', value: fmt(k) },
        { label: 'Output variance', value: fmt(v, 4) },
        { label: 'Sum of first-order indices', value: `${fmt(first.reduce((a, b) => a + b, 0), 3)} (1 when additive)` },
        { label: 'Largest error against analytic', value: fmt(Math.max(...first.map((si, i) => Math.abs(si - m.first[i])), ...total.map((ti, i) => Math.abs(ti - m.total[i]))), 4) },
      ]);
      yield;
    }
    const mean = (sumA + sumB) / (2 * k);
    const v = (sumA2 + sumB2) / (2 * k) - mean * mean;
    return { first: sf.map((t, i) => (t - mean * sd[i]) / k / v), total: st.map((t) => t / (2 * k) / v), analyticFirst: m.first, analyticTotal: m.total, n: k };
  },
};
