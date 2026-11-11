import { num, str } from '../../core/plate';
import { ascending, fmt, pm, quantile, Sampler } from '../../engines/stochastic/sample';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

/** Value at risk (the level-quantile of the loss) and expected shortfall (the mean loss at or
 * beyond it), from an ascending sample. */
export function tailRisk(sorted: ArrayLike<number>, level: number): { var: number; cvar: number } {
  const v = quantile(sorted, level);
  let t = 0;
  let c = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i] >= v; i--) { t += sorted[i]; c++; }
  return { var: v, cvar: c ? t / c : NaN };
}

const SCENARIOS: Record<string, { label: string; draw(s: Sampler): number }> = {
  portfolio: {
    label: 'Five positions, heavy tails, one common factor',
    draw(s) {
      // a common Student-t factor and five idiosyncratic ones, nu = 4
      const common = s.studentT(4);
      let loss = 0;
      for (let i = 0; i < 5; i++) loss += 0.2 * (0.6 * common + 0.8 * s.studentT(4));
      return loss;
    },
  },
  jumps: {
    label: 'Normal losses with rare jumps',
    draw: (s) => s.normal(0, 1) + (s.bernoulli(0.02) ? 4 + s.exponential(0.5) : 0),
  },
  normal: { label: 'Normal N(0, 1)', draw: (s) => s.normal(0, 1) },
};

export interface RiskResult { losses: Float64Array; level: number; var: number; cvar: number; scenario: string }

const FRAMES = 140;
const BATCHES = 10;

// Simulate the loss many times and sort: the value at risk at level 0.99 is the loss exceeded
// in one run in a hundred, and the expected shortfall is the average of those worst runs, so
// it sees how bad the tail is and not only where it starts. Standard errors come from ten
// independent batches of the runs.
export const kernel: StochasticKernel<RiskResult> = {
  palette: 'ember',
  params: [
    {
      kind: 'select', key: 'scenario', label: 'Loss model', value: 'portfolio', rebuild: true,
      options: Object.entries(SCENARIOS).map(([value, x]) => ({ value, label: x.label })),
    },
    {
      kind: 'select', key: 'level', label: 'Level', value: '0.99', rebuild: true,
      options: ['0.9', '0.95', '0.99', '0.995'].map((v) => ({ value: v, label: `${fmt(Number(v) * 100, 1)}%` })),
    },
    { kind: 'range', key: 'n', label: 'Simulated losses', min: 1000, max: 100000, step: 1000, value: 20000, rebuild: true },
  ],
  chart: { title: 'Tail estimates as runs accumulate', x: { label: 'simulated losses', log: true }, y: { label: 'loss' } },
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const id = SCENARIOS[str(cfg, 'scenario')] ? str(cfg, 'scenario') : 'portfolio';
    const sc = SCENARIOS[id];
    const level = Number(str(cfg, 'level'));
    const n = num(cfg, 'n');
    const losses: number[] = [];
    const lo = -4;
    const hi = id === 'jumps' ? 12 : 6;
    let done = 0;
    for (let fr = 1; fr <= FRAMES; fr++) {
      const end = Math.max(BATCHES * 20, Math.round(n * (fr / FRAMES) ** 2));
      for (; done < end; done++) losses.push(ops.evaluate(sc.draw, s));
      const sorted = ascending(losses);
      const r = tailRisk(sorted, level);
      const size = Math.floor(done / BATCHES);
      const per = Array.from({ length: BATCHES }, (_, b) => tailRisk(ascending(losses.slice(b * size, (b + 1) * size)), level));
      const se = (xs: number[]) => {
        const m = xs.reduce((a, b) => a + b, 0) / xs.length;
        return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length);
      };
      ops.point('value at risk', done, r.var);
      ops.point('expected shortfall', done, r.cvar);
      ops.frame([{
        kind: 'hist', title: `Simulated losses; the worst ${fmt(100 * (1 - level), 1)}% shaded`, lo, hi,
        bins: histogram(losses, lo, hi, 64), shade: [r.var, hi],
        marks: [{ x: r.var, label: 'VaR', tone: -1 }, { x: r.cvar, label: 'ES', tone: 0.9 }],
      }], [
        { label: `Value at risk ${fmt(100 * level, 1)}%`, value: pm(r.var, se(per.map((q) => q.var))) },
        { label: 'Expected shortfall', value: pm(r.cvar, se(per.map((q) => q.cvar))) },
        { label: 'Simulated losses', value: `${fmt(done)}; ${fmt(Math.round(done * (1 - level)))} in the tail` },
        { label: 'Largest loss', value: fmt(sorted[sorted.length - 1], 3) },
      ]);
    }
    const sorted = ascending(losses);
    const r = tailRisk(sorted, level);
    return { losses: sorted, level, var: r.var, cvar: r.cvar, scenario: id };
  },
};
