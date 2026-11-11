import { num } from '../../core/plate';
import { fmt, pm, Sampler } from '../../engines/stochastic/sample';
import type { StochasticKernel } from '../../engines/stochastic/trace';

export interface ShapleyResult {
  d: number;
  /** v(S) for every coalition S, indexed by bit mask. */
  values: number[];
  /** Exact values by walking every ordering; estimates and their standard errors. */
  exact: number[];
  estimate: number[];
  se: number[];
  permutations: number;
}

/** A synthetic model with main effects and two pairwise interactions. */
function model(s: Sampler, d: number) {
  const a = Array.from({ length: d }, () => s.uniform(-1, 2));
  const pairs: [number, number, number][] = [];
  for (let k = 0; k < 2; k++) {
    const i = s.int(d);
    const j = (i + 1 + s.int(d - 1)) % d;
    pairs.push([i, j, s.uniform(-3, 3)]);
  }
  return (x: number[]) => a.reduce((t, ai, i) => t + ai * x[i], 0) + pairs.reduce((t, [i, j, b]) => t + b * x[i] * x[j], 0);
}

/** Every ordering of 0..d-1. */
function orderings(d: number): number[][] {
  if (d === 1) return [[0]];
  return orderings(d - 1).flatMap((p) => Array.from({ length: d }, (_, k) => [...p.slice(0, k), d - 1, ...p.slice(k)]));
}

const FRAMES = 150;

// A coalition S of inputs takes the instance's values for its members and a baseline's for the
// rest; v(S) is the model's output there. In a random ordering each input joins the inputs
// before it, and its Shapley value is the mean of the change it makes. Every ordering's
// contributions add up to v(all) - v(none), so the estimates do too, exactly.
export const kernel: StochasticKernel<ShapleyResult> = {
  palette: 'riso',
  params: [
    { kind: 'range', key: 'd', label: 'Inputs', min: 2, max: 6, step: 1, value: 5, rebuild: true },
    { kind: 'range', key: 'm', label: 'Sampled orderings', min: 20, max: 4000, step: 20, value: 600, rebuild: true },
  ],
  chart: { title: 'Error of the sampled values', x: { label: 'orderings sampled', log: true }, y: { label: 'largest |estimate − exact|', log: true } },
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const d = num(cfg, 'd');
    const m = num(cfg, 'm');
    const f = model(s, d);
    const x = Array.from({ length: d }, () => s.uniform());
    const base = Array.from({ length: d }, () => s.uniform());
    const v = (mask: number) => f(x.map((xi, i) => (mask & (1 << i) ? xi : base[i])));
    const values = Array.from({ length: 1 << d }, (_, mask) => ops.evaluate(v, mask));
    const all = orderings(d);
    const exact = new Array<number>(d).fill(0);
    for (const o of all) {
      let mask = 0;
      for (const i of o) { exact[i] += (values[mask | (1 << i)] - values[mask]) / all.length; mask |= 1 << i; }
    }
    const sum = new Array<number>(d).fill(0);
    const sum2 = new Array<number>(d).fill(0);
    const paths: [number, number][][] = Array.from({ length: d }, () => []);
    const full = values[(1 << d) - 1] - values[0];
    let done = 0;
    const est = () => sum.map((t) => t / Math.max(1, done));
    const ses = () => sum.map((t, i) => (done > 1 ? Math.sqrt(Math.max(0, sum2[i] / done - (t / done) ** 2) / (done - 1)) : NaN));
    const lo = Math.min(0, ...exact) * 1.4 - 0.1;
    const hi = Math.max(0, ...exact) * 1.4 + 0.1;
    for (let fr = 1; fr <= FRAMES; fr++) {
      const end = Math.max(1, Math.round(m * (fr / FRAMES) ** 2));
      for (; done < end;) {
        const o = Array.from({ length: d }, (_, i) => i);
        for (let i = d - 1; i > 0; i--) { const j = s.int(i + 1); [o[i], o[j]] = [o[j], o[i]]; }
        let mask = 0;
        let prev = ops.evaluate(v, 0);
        for (const i of o) {
          mask |= 1 << i;
          const cur = ops.evaluate(v, mask);
          sum[i] += cur - prev;
          sum2[i] += (cur - prev) ** 2;
          prev = cur;
        }
        done++;
      }
      const e = est();
      const se = ses();
      e.forEach((ei, i) => paths[i].push([Math.log10(done), ei]));
      const err = Math.max(...e.map((ei, i) => Math.abs(ei - exact[i])));
      if (err > 0) ops.point('largest error', done, err);
      const top = e.reduce((b, ei, i) => (Math.abs(ei) > Math.abs(e[b]) ? i : b), 0);
      ops.frame([
        {
          kind: 'bars', title: 'Sampled Shapley values ± 2 SE; ticks are the exact values', x: [lo, hi],
          rows: e.map((ei, i) => ({
            label: `x${i + 1}`, lo: 0, hi: ei, tone: 0.1 + (0.8 * i) / Math.max(1, d - 1), mark: exact[i],
            ...(Number.isFinite(se[i]) ? { err: [ei - 2 * se[i], ei + 2 * se[i]] as [number, number] } : {}),
          })),
        },
        {
          kind: 'plot', title: 'Estimates against log10 orderings', x: [0, Math.log10(m)], y: [lo, hi],
          lines: paths.map((pts, i) => ({ pts: pts.slice(), tone: 0.1 + (0.8 * i) / Math.max(1, d - 1), weight: 1.5 })),
          marks: exact.map((ex, i) => ({ y: ex, tone: 0.1 + (0.8 * i) / Math.max(1, d - 1), dash: true })),
        },
      ], [
        { label: 'Orderings sampled', value: fmt(done) },
        { label: 'Sum of estimates', value: `${fmt(e.reduce((a, b) => a + b, 0), 6)} = v(all) − v(none) ${fmt(full, 6)}` },
        { label: 'Largest error', value: fmt(err, 4) },
        { label: `Largest attribution x${top + 1}`, value: Number.isFinite(se[top]) ? pm(e[top], se[top]) : fmt(e[top], 3) },
      ]);
    }
    return { d, values, exact, estimate: est(), se: ses(), permutations: done };
  },
};
