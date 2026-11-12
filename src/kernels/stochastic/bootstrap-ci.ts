import { num, str } from '../../core/plate';
import { ascending, fmt, mean, pct, quantile, Sampler, variance } from '../../engines/stochastic/sample';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';
import { COVERAGE, coverageChart, ladder, LEVELS, publishCoverage, repetitionsParam, SHOWN_LEVEL } from './_coverage';

export interface Population { label: string; draw(s: Sampler): number; mean: number }

export const POPULATIONS: Record<string, Population> = {
  lognormal: { label: 'Log-normal (skewed)', draw: (s) => s.lognormal(0, 0.75), mean: Math.exp(0.75 ** 2 / 2) },
  exponential: { label: 'Exponential', draw: (s) => s.exponential(1), mean: 1 },
  normal: { label: 'Normal', draw: (s) => s.normal(0, 1), mean: 0 },
};

/** The means of b resamples of xs, each drawn with replacement; yields every few thousand
 * draws so that a large resampling is spread over frames. */
export function* bootstrapMeans(s: Sampler, xs: number[], b: number): Generator<void, Float64Array, void> {
  const n = xs.length;
  const out = new Float64Array(b);
  let since = 0;
  for (let k = 0; k < b; k++) {
    let t = 0;
    for (let i = 0; i < n; i++) t += xs[s.int(n)];
    out[k] = t / n;
    since += n;
    if (since >= 20000) { since = 0; yield; }
  }
  return out;
}

/** Draws the repeated experiments may spend in all: beyond it each experiment resamples less. */
export const COVERAGE_DRAWS = 2e7;

/** The percentile interval at a level from sorted bootstrap statistics. */
export function percentile(sorted: Float64Array, level: number): [number, number] {
  return [quantile(sorted, (1 - level) / 2), quantile(sorted, 1 - (1 - level) / 2)];
}

export interface BootstrapResult {
  data: number[];
  boots: Float64Array;
  se: number;
  interval: [number, number];
  truth: number;
  coverage: number[];
  reps: number;
  /** Resamples per repeated experiment. */
  resamplesPerExperiment: number;
}

const FILL = 60;
const LADDER = 20;

// The sample stands in for the population: resampling it with replacement, many times, and
// recomputing the mean each time gives the spread the mean would have had over new samples.
// The percentile interval cuts the tails off that spread. Repeating the whole experiment on
// fresh samples measures how often the interval really contains the population mean.
export const kernel: StochasticKernel<BootstrapResult> = {
  palette: 'phosphor',
  params: [
    {
      kind: 'select', key: 'population', label: 'Population', value: 'lognormal', rebuild: true,
      options: Object.entries(POPULATIONS).map(([value, p]) => ({ value, label: p.label })),
    },
    { kind: 'range', key: 'n', label: 'Sample size', min: 5, max: 200, step: 5, value: 30, rebuild: true },
    { kind: 'range', key: 'b', label: 'Resamples', min: 200, max: 4000, step: 100, value: 1000, rebuild: true },
    repetitionsParam(),
  ],
  chart: coverageChart,
  labSeries: COVERAGE,
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const pop = POPULATIONS[str(cfg, 'population')] ?? POPULATIONS.lognormal;
    const n = num(cfg, 'n');
    const b = num(cfg, 'b');
    const reps = num(cfg, 'reps');
    const data = Array.from({ length: n }, () => pop.draw(s));
    const m = mean(data);
    const sd = Math.sqrt(variance(data));
    const lo = Math.min(pop.mean, m) - 4.5 * (sd / Math.sqrt(n));
    const hi = Math.max(pop.mean, m) + 4.5 * (sd / Math.sqrt(n));
    const boots = new Float64Array(b);
    for (let fr = 1; fr <= FILL; fr++) {
      const from = Math.round(((fr - 1) / FILL) * b);
      const to = Math.round((fr / FILL) * b);
      boots.set(yield* bootstrapMeans(s, data, to - from), from);
      ops.count(to - from);
      const sorted = ascending(boots.subarray(0, to));
      const [a, z] = percentile(sorted, SHOWN_LEVEL);
      ops.frame([{
        kind: 'hist', title: 'Means of the resamples; the 90% percentile interval shaded', lo, hi, bins: histogram(boots, lo, hi, 40, 0, to),
        shade: [a, z], marks: [{ x: m, label: 'sample mean', tone: -1 }, { x: pop.mean, label: 'population mean', tone: 0.05, dash: true }],
      }], [
        { label: 'Resamples', value: `${fmt(to)} of ${fmt(b)}` },
        { label: 'Sample mean', value: fmt(m, 4) },
        { label: 'Bootstrap standard error', value: `${fmt(Math.sqrt(variance(boots.subarray(0, to))), 4)} (s/√n ${fmt(sd / Math.sqrt(n), 4)})` },
        { label: '90% percentile interval', value: `${fmt(a, 4)} – ${fmt(z, 4)}` },
      ]);
      yield;
    }
    const sorted = ascending(boots);
    const se = Math.sqrt(variance(boots));
    // the sample shown keeps its comparison while the repeated experiments run
    const seRow = { label: 'Bootstrap standard error', value: `${fmt(se, 4)} (s/√n ${fmt(sd / Math.sqrt(n), 4)})` };
    const interval = percentile(sorted, SHOWN_LEVEL);
    const hits = new Array<number>(LEVELS.length).fill(0);
    const shown: { label: string; lo: number; hi: number; truth: number }[] = [];
    let width = 0;
    const span = 3 * Math.sqrt(variance(Array.from({ length: 400 }, () => pop.draw(s)))) / Math.sqrt(n);
    const x: [number, number] = [pop.mean - 1.6 * span, pop.mean + 1.6 * span];
    // the experiments' resamples are bounded so the whole run stays within COVERAGE_DRAWS
    const bRep = Math.max(100, Math.min(b, Math.floor(COVERAGE_DRAWS / (reps * n))));
    for (let r = 1; r <= reps; r++) {
      const fresh = Array.from({ length: n }, () => pop.draw(s));
      const bs = ascending(yield* bootstrapMeans(s, fresh, bRep));
      ops.count(bRep);
      LEVELS.forEach((l, i) => {
        const [a, z] = percentile(bs, l);
        if (a <= pop.mean && pop.mean <= z) hits[i]++;
      });
      const [a, z] = percentile(bs, SHOWN_LEVEL);
      width += z - a;
      shown.push({ label: `run ${r}`, lo: a, hi: z, truth: pop.mean });
      if (shown.length > LADDER) shown.shift();
      publishCoverage(ops, hits, r);
      const k = LEVELS.indexOf(SHOWN_LEVEL);
      const c = hits[k] / r;
      ops.frame([ladder('Latest 90% intervals against the population mean (tick)', shown.slice(), x)], [
        { label: 'Experiments', value: `${fmt(r)} of ${fmt(reps)}, ${fmt(bRep)} resamples each` },
        { label: '90% intervals covering', value: `${pct(c)} ± ${pct(Math.sqrt(c * (1 - c) / r))}` },
        { label: '50% intervals covering', value: pct(hits[0] / r) },
        { label: 'Mean 90% width', value: fmt(width / r, 4) },
        seRow,
      ]);
      yield;
    }
    return { data, boots: sorted, se, interval, truth: pop.mean, coverage: hits.map((h) => h / reps), reps, resamplesPerExperiment: bRep };
  },
};
