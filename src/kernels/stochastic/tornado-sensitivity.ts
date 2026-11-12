import { num } from '../../core/plate';
import { fmt, Sampler, SortedSample } from '../../engines/stochastic/sample';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

export interface Input { name: string; low: number; base: number; high: number }

export const NAMES = ['volume', 'price', 'unit cost', 'loss rate', 'fixed cost'];

/** A generic margin model: volume × (price − unit cost) × (1 − loss rate) − fixed cost. */
export function model(x: number[]): number {
  return x[0] * (x[1] - x[2]) * (1 - x[3]) - x[4];
}

/** Seeded ranges around a base case. */
export function inputs(s: Sampler): Input[] {
  const volume = 800 + 400 * s.uniform();
  const price = 20 + 10 * s.uniform();
  const cost = price * (0.45 + 0.2 * s.uniform());
  const loss = 0.04 + 0.06 * s.uniform();
  const fixed = 2000 + 3000 * s.uniform();
  const r = (base: number, down: number, up: number) => ({ base, low: base * (1 - down), high: base * (1 + up) });
  return [
    { name: NAMES[0], ...r(volume, 0.1 + 0.3 * s.uniform(), 0.1 + 0.3 * s.uniform()) },
    { name: NAMES[1], ...r(price, 0.05 + 0.1 * s.uniform(), 0.05 + 0.1 * s.uniform()) },
    { name: NAMES[2], ...r(cost, 0.05 + 0.15 * s.uniform(), 0.05 + 0.25 * s.uniform()) },
    { name: NAMES[3], ...r(loss, 0.5, 1 + s.uniform()) },
    { name: NAMES[4], ...r(fixed, 0.2, 0.2 + 0.4 * s.uniform()) },
  ];
}

/** Inverse distribution function of the triangular distribution (low, mode, high). */
export function triangular(u: number, a: number, c: number, b: number): number {
  const f = (c - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

export interface TornadoResult {
  inputs: Input[];
  base: number;
  /** Rows in tornado order (widest swing first): input index, output at low and at high. */
  swings: { i: number; atLow: number; atHigh: number }[];
  samples: number[];
}

const HOLD = 20;
const FILL = 100;

// One input at a time is moved from its low to its high value with every other input held at
// its base case; the widest swings go on top. A joint Monte Carlo run, every input drawn from
// a triangular distribution on its range, shows how the swings combine.
export const kernel: StochasticKernel<TornadoResult> = {
  palette: 'ember',
  params: [{ kind: 'range', key: 'n', label: 'Joint Monte Carlo runs', min: 500, max: 40000, step: 500, value: 8000, rebuild: true }],
  chart: { title: 'Spider plot: output as each input moves alone', x: { label: 'input position, low (0) to high (1)' }, y: { label: 'output' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const xs = inputs(s);
    const baseX = xs.map((x) => x.base);
    const base = ops.evaluate(model, baseX);
    const at = (i: number, v: number) => ops.evaluate(model, baseX.map((b, j) => (j === i ? v : b)));
    const raw = xs.map((x, i) => ({ i, atLow: at(i, x.low), atHigh: at(i, x.high) }));
    const swings = raw.slice().sort((a, b) => Math.abs(b.atHigh - b.atLow) - Math.abs(a.atHigh - a.atLow));
    xs.forEach((x, i) => {
      ops.setSeries(x.name, Array.from({ length: 11 }, (_, k) => [k / 10, at(i, x.low + (k / 10) * (x.high - x.low))] as [number, number]));
    });
    const n = num(cfg, 'n');
    const samples: number[] = [];
    let lo = Math.min(...raw.flatMap((r) => [r.atLow, r.atHigh]));
    let hi = Math.max(...raw.flatMap((r) => [r.atLow, r.atHigh]));
    const pad = 0.6 * (hi - lo);
    lo -= pad;
    hi += pad;
    const tornado = (shown: number) => ({
      kind: 'bars' as const, title: 'Tornado: output from each input’s low to high; tick is the base case', x: [lo, hi] as [number, number],
      rows: swings.slice(0, shown).map((r) => ({
        label: xs[r.i].name, lo: Math.min(r.atLow, r.atHigh), hi: Math.max(r.atLow, r.atHigh),
        tone: r.atHigh >= r.atLow ? 0.75 : 0.25, mark: base,
      })),
    });
    const swingStats = (shown: number) => swings.slice(0, Math.min(shown, 3)).map((r) => ({
      label: `Swing of ${xs[r.i].name}`, value: `${fmt(Math.abs(r.atHigh - r.atLow), 0)} (${fmt(Math.min(r.atLow, r.atHigh), 0)} to ${fmt(Math.max(r.atLow, r.atHigh), 0)})`,
    }));
    for (let k = 1; k <= swings.length; k++) {
      for (let h = 0; h < HOLD; h++) ops.frame([tornado(k)], [{ label: 'Base case output', value: fmt(base, 0) }, ...swingStats(k)]);
      yield;
    }
    // the joint runs, kept sorted and binned as they grow
    const sorted = new SortedSample();
    const bins = new Array<number>(40).fill(0);
    for (let fr = 1; fr <= FILL; fr++) {
      const end = Math.round(n * (fr / FILL));
      const from = samples.length;
      while (samples.length < end) {
        samples.push(ops.evaluate(model, xs.map((x) => triangular(s.uniform(), x.low, x.base, x.high))));
        if (samples.length % 5000 === 0) yield;
      }
      histogram(samples, lo, hi, 40, from, samples.length, bins);
      sorted.add(samples.slice(from));
      const p10 = sorted.quantile(0.1);
      const p50 = sorted.quantile(0.5);
      const p90 = sorted.quantile(0.9);
      ops.frame([
        tornado(swings.length),
        {
          kind: 'hist', title: 'Joint Monte Carlo output, P10 to P90 shaded', lo, hi, bins: bins.slice(), shade: [p10, p90],
          marks: [{ x: base, label: 'base', tone: -1, dash: true }, { x: p50, label: 'P50', tone: -1 }],
        },
      ], [
        { label: 'Base case output', value: fmt(base, 0) },
        ...swingStats(swings.length),
        { label: 'Joint runs', value: fmt(samples.length) },
        { label: 'P10 / P50 / P90', value: `${fmt(p10, 0)} / ${fmt(p50, 0)} / ${fmt(p90, 0)}` },
      ]);
      yield;
    }
    return { inputs: xs, base, swings, samples };
  },
};
