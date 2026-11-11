import { num } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import { stream } from '../../engines/stochastic/scenarios';
import type { StochasticKernel } from '../../engines/stochastic/trace';

export interface PageHinkleyResult {
  stream: number[];
  /** Index where the mean moves (the stream's length when it never does). */
  change: number;
  /** First index at which the test alarmed, or -1. */
  alarm: number;
  statistic: number[];
  lambda: number;
  delta: number;
}

/** The Page–Hinkley test for an upward shift of the mean: m_t sums x_i - mean_t - delta, and
 * the test alarms when m_t rises more than lambda above its running minimum. */
export function pageHinkley(xs: ArrayLike<number>, delta: number, lambda: number): { alarm: number; statistic: number[] } {
  let sum = 0;
  let m = 0;
  let minM = 0;
  let alarm = -1;
  const statistic: number[] = [];
  for (let t = 0; t < xs.length; t++) {
    sum += xs[t];
    m += xs[t] - sum / (t + 1) - delta;
    minM = Math.min(minM, m);
    statistic.push(m - minM);
    if (alarm < 0 && m - minM > lambda) alarm = t;
  }
  return { alarm, statistic };
}

const FRAMES = 160;

export const kernel: StochasticKernel<PageHinkleyResult> = {
  palette: 'spectral',
  params: [
    { kind: 'range', key: 'n', label: 'Stream length', min: 200, max: 2000, step: 50, value: 600, rebuild: true },
    { kind: 'range', key: 'shift', label: 'Mean shift (standard deviations)', min: 0, max: 3, step: 0.1, value: 1, rebuild: true },
    { kind: 'range', key: 'delta', label: 'Tolerance δ', min: 0, max: 1.5, step: 0.05, value: 0.5, rebuild: true },
    { kind: 'range', key: 'lambda', label: 'Threshold λ', min: 2, max: 60, step: 1, value: 15, rebuild: true },
  ],
  chart: { title: 'Page–Hinkley statistic', x: { label: 'sample' }, y: { label: 'm_t − min m' } },
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const n = num(cfg, 'n');
    const shift = num(cfg, 'shift');
    const delta = num(cfg, 'delta');
    const lambda = num(cfg, 'lambda');
    // the change point lies somewhere in the middle half of the stream
    const at = shift > 0 ? Math.floor(n * (0.35 + 0.3 * s.uniform())) : n;
    const xs = stream(s, n, at, shift);
    const { alarm, statistic } = pageHinkley(xs, delta, lambda);
    ops.count(n);
    const lo = Math.min(-3.5, ...xs);
    const hi = Math.max(3.5 + shift, ...xs);
    const top = Math.max(lambda * 1.3, ...statistic);
    const every = Math.max(1, Math.ceil(n / FRAMES));
    let mean = 0;
    for (let t = 0; t < n; t++) {
      mean += xs[t];
      if ((t + 1) % every === 0 || t === n - 1) {
        const upto = t + 1;
        ops.setSeries('statistic', statistic.slice(0, upto).map((v, i) => [i, v]));
        ops.setSeries('threshold λ', [[0, lambda], [upto - 1, lambda]]);
        const seen = alarm >= 0 && alarm <= t;
        const marks = [
          ...(at < n && at <= t ? [{ x: at, label: 'change', tone: 0.15, dash: true }] : []),
          ...(seen ? [{ x: alarm, label: 'alarm', tone: 0.85 }] : []),
        ];
        ops.frame([
          {
            kind: 'plot', title: 'Stream, and the mean it is drawn from', x: [0, n - 1], y: [lo, hi],
            dots: [{ pts: xs.slice(0, upto).map((v, i) => [i, v]), tones: xs.slice(0, upto).map((_, i) => (i >= at ? 0.85 : 0.6)), size: 1.6, alpha: 0.7 }],
            lines: [{ pts: [[0, 0], [Math.min(at, upto) - 1, 0], ...(upto > at ? [[at, shift], [upto - 1, shift]] as [number, number][] : [])], tone: -1, alpha: 0.35, weight: 1 }],
            marks,
          },
          {
            kind: 'plot', title: 'm_t − min m against the threshold λ', x: [0, n - 1], y: [0, top],
            lines: [{ pts: statistic.slice(0, upto).map((v, i) => [i, v]), tone: 0.85, weight: 1.5 }],
            marks: [{ y: lambda, label: `λ = ${lambda}`, tone: -1, dash: true }, ...marks],
          },
        ], [
          { label: 'Samples seen', value: fmt(upto) },
          { label: 'Running mean', value: fmt(mean / upto, 3) },
          { label: 'Statistic', value: `${fmt(statistic[t], 2)} (λ ${lambda})` },
          { label: 'Alarm', value: seen ? `at sample ${fmt(alarm)}` : 'none yet' },
          {
            label: 'Detection',
            value: !seen ? (at < n && t >= at ? 'change not yet detected' : '—')
              : at >= n || alarm < at ? 'false alarm (before any change)' : `delay ${fmt(alarm - at)} samples`,
          },
        ]);
      }
    }
    return { stream: xs, change: at, alarm, statistic, lambda, delta };
  },
};
