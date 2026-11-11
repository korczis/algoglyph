import { num, str } from '../../core/plate';
import { fmt, pm, Sampler } from '../../engines/stochastic/sample';
import type { StochasticKernel } from '../../engines/stochastic/trace';

export interface BayesResult {
  /** Grid points on (0, 1) and the posterior density on them. */
  grid: number[];
  posterior: number[];
  prior: [number, number];
  successes: number;
  failures: number;
  truth: number;
  mean: number;
}

const G = 400;
const FRAMES = 160;
const PRIORS: Record<string, [number, number]> = { flat: [1, 1], sceptical: [2, 8], hopeful: [8, 2], jeffreys: [0.5, 0.5] };

/** Normalise a density on the grid to unit area (midpoint rule, spacing 1 / G). */
function normalise(d: number[]): number[] {
  const z = d.reduce((a, b) => a + b, 0) / G;
  return d.map((v) => v / z);
}

function summary(grid: number[], d: number[]) {
  let m = 0;
  let m2 = 0;
  for (let i = 0; i < G; i++) { m += grid[i] * d[i] / G; m2 += grid[i] * grid[i] * d[i] / G; }
  let c = 0;
  let lo = NaN;
  let hi = NaN;
  for (let i = 0; i < G; i++) {
    c += d[i] / G;
    if (Number.isNaN(lo) && c >= 0.05) lo = grid[i];
    if (Number.isNaN(hi) && c >= 0.95) hi = grid[i];
  }
  return { mean: m, sd: Math.sqrt(Math.max(0, m2 - m * m)), lo, hi };
}

// The rate of an event, unknown, believed a priori to follow a Beta density; each observed
// trial multiplies the density by the likelihood of what was seen (theta for an event,
// 1 - theta for none) and renormalises. The grid is generic Bayes; the Beta prior is chosen
// so that the closed form, Beta(a + events, b + non-events), can check it.
export const kernel: StochasticKernel<BayesResult> = {
  palette: 'abyss',
  params: [
    {
      kind: 'select', key: 'prior', label: 'Prior', value: 'flat', rebuild: true,
      options: [
        { value: 'flat', label: 'Flat, Beta(1, 1)' },
        { value: 'jeffreys', label: 'Jeffreys, Beta(½, ½)' },
        { value: 'sceptical', label: 'Sceptical, Beta(2, 8)' },
        { value: 'hopeful', label: 'Hopeful, Beta(8, 2)' },
      ],
    },
    { kind: 'range', key: 'truth', label: 'True rate', min: 0.02, max: 0.98, step: 0.01, value: 0.3, rebuild: true },
    { kind: 'range', key: 'n', label: 'Observations', min: 5, max: 500, step: 5, value: 120, rebuild: true },
  ],
  chart: { title: 'Posterior as evidence arrives', x: { label: 'observations' }, y: { label: 'rate' } },
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const [a, b] = PRIORS[str(cfg, 'prior')] ?? PRIORS.flat;
    const truth = num(cfg, 'truth');
    const n = num(cfg, 'n');
    const grid = Array.from({ length: G }, (_, i) => (i + 0.5) / G);
    const prior = normalise(grid.map((t) => Math.pow(t, a - 1) * Math.pow(1 - t, b - 1)));
    let post = prior.slice();
    let succ = 0;
    const every = Math.max(1, Math.ceil(n / FRAMES));
    const curve = (d: number[]) => grid.map((t, i) => [t, d[i]] as [number, number]);
    const priorCurve = curve(prior);
    const show = (k: number, last: string) => {
      const sm = summary(grid, post);
      ops.point('posterior mean', k, sm.mean);
      ops.point('5% bound', k, sm.lo);
      ops.point('95% bound', k, sm.hi);
      ops.point('true rate', k, truth);
      const top = Math.max(...post, ...prior) * 1.05;
      const cm = (a + succ) / (a + b + k);
      ops.frame([{
        kind: 'plot', title: 'Prior (faint) and posterior density of the rate', x: [0, 1], y: [0, top],
        band: { pts: grid.filter((t) => t >= sm.lo && t <= sm.hi).map((t) => [t, 0, post[Math.floor(t * G)]]), tone: 0.45 },
        lines: [{ pts: priorCurve, tone: -1, alpha: 0.35, weight: 1 }, { pts: curve(post), tone: 0.6, weight: 2 }],
        marks: [{ x: truth, label: 'true rate', tone: -1, dash: true }],
      }], [
        { label: 'Observations', value: `${fmt(k)}: ${fmt(succ)} events, ${fmt(k - succ)} none` },
        { label: 'Posterior mean', value: pm(sm.mean, sm.sd) },
        { label: '90% credible interval', value: `${fmt(sm.lo, 3)} – ${fmt(sm.hi, 3)}` },
        { label: 'Last observation', value: last },
        { label: 'Closed form Beta mean', value: `${fmt(cm, 3)} for Beta(${fmt(a + succ, 1)}, ${fmt(b + k - succ, 1)})` },
      ]);
    };
    show(0, '—');
    for (let k = 1; k <= n; k++) {
      const event = s.bernoulli(truth);
      if (event) succ++;
      post = normalise(post.map((d, i) => d * (event ? grid[i] : 1 - grid[i])));
      ops.count(G);
      if (k % every === 0 || k === n) show(k, event ? 'event' : 'no event');
    }
    return { grid, posterior: post, prior: [a, b], successes: succ, failures: n - succ, truth, mean: summary(grid, post).mean };
  },
};
