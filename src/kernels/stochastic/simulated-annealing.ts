import { num, str } from '../../core/plate';
import { fmt, pct, Sampler } from '../../engines/stochastic/sample';
import { landscape, landscapeField, landscapeParam } from '../../engines/stochastic/scenarios';
import type { StochasticKernel } from '../../engines/stochastic/trace';
import { budgetParam, clamp, RandomSearch, searchStats, type SearchResult } from './_search';

const FRAMES = 150;
const SERIES = 'Simulated annealing';

// Metropolis moves on a cooling schedule: a proposal a Gaussian step away is always taken when
// it is better and taken with probability exp(-delta / T) when it is worse; T falls
// geometrically, so early on the walk crosses ridges and late on it only descends.
export const kernel: StochasticKernel<SearchResult> = {
  palette: 'ember',
  params: [
    landscapeParam(),
    budgetParam(),
    { kind: 'range', key: 'cooling', label: 'Final temperature (fraction of the first)', min: 0.0001, max: 0.1, step: 0.0001, value: 0.001, rebuild: true },
  ],
  chart: { title: 'Best value found', x: { label: 'evaluations' }, y: { label: 'best objective' } },
  labSeries: SERIES,
  *run(ops, cfg) {
    const l = landscape(str(cfg, 'landscape'));
    const field = landscapeField(l);
    const s = new Sampler(() => ops.rnd());
    const rs = new RandomSearch(ops, l);
    const budget = num(cfg, 'budget');
    const span = Math.max(l.x[1] - l.x[0], l.y[1] - l.y[0]);
    // the first temperature is the spread of the objective over a few random points
    const probe = 20;
    const vals: number[] = [];
    for (let i = 0; i < probe; i++) {
      vals.push(ops.evaluate(l.f, s.uniform(l.x[0], l.x[1]), s.uniform(l.y[0], l.y[1])));
      rs.step();
    }
    const mu = vals.reduce((a, b) => a + b, 0) / probe;
    const t0 = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / (probe - 1)) || 1;
    const tEnd = t0 * num(cfg, 'cooling');
    let x = s.uniform(l.x[0], l.x[1]);
    let y = s.uniform(l.y[0], l.y[1]);
    let fx = ops.evaluate(l.f, x, y);
    rs.step();
    let best = fx;
    let bestAt: [number, number] = [x, y];
    let accepted = 0;
    let worseTaken = 0;
    let tried = 0;
    const path: [number, number][] = [[x, y]];
    const steps = budget - probe - 1;
    const every = Math.max(1, Math.floor(steps / FRAMES));
    let T = t0;
    for (let k = 1; k <= steps; k++) {
      T = t0 * Math.pow(tEnd / t0, k / steps);
      const sd = span * (0.005 + 0.12 * Math.sqrt(T / t0));
      const nx = clamp(x + s.normal(0, sd), l.x);
      const ny = clamp(y + s.normal(0, sd), l.y);
      const fn = ops.evaluate(l.f, nx, ny);
      rs.step();
      tried++;
      const d = fn - fx;
      if (d <= 0 || s.uniform() < Math.exp(-d / T)) {
        if (d > 0) worseTaken++;
        accepted++;
        x = nx; y = ny; fx = fn;
        path.push([x, y]);
        if (path.length > 240) path.shift();
        if (fx < best) { best = fx; bestAt = [x, y]; }
      }
      if (k % every === 0 || k === steps) {
        const evals = probe + 1 + k;
        ops.point(SERIES, evals, best);
        ops.point('Random search', evals, rs.best);
        ops.frame([{
          kind: 'plot', title: `${l.label}: the walk, and its best point`, x: l.x, y: l.y, field,
          lines: [{ pts: path.slice(), tone: -1, weight: 1, alpha: 0.6 }],
          dots: [{ pts: [[x, y]], tone: -1, size: 5 }, { pts: [bestAt], tone: 1, size: 6 }, { pts: [rs.at], tone: 0, size: 4 }],
        }], [
          ...searchStats('Annealing', evals, best, rs, l),
          { label: 'Temperature', value: `${fmt(T, 4)} (first ${fmt(t0, 3)})` },
          { label: 'Acceptance rate', value: `${pct(accepted / tried)}; uphill moves taken ${fmt(worseTaken)}` },
        ]);
        yield;
      }
    }
    return { landscape: l.id, best, bestAt, randomBest: rs.best, evals: budget };
  },
};
