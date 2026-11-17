import { num, str, type Params } from '../../core/plate';
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { column, readerInput, readerTable } from '../../engines/stochastic/reader';
import { betaCdf, fmt, pm, Sampler } from '../../engines/stochastic/sample';
import type { StochasticKernel, StochasticOps } from '../../engines/stochastic/trace';

export interface BayesResult {
  /** Cell midpoints on (0, 1) and the posterior probability of each cell. */
  grid: number[];
  posterior: number[];
  prior: [number, number];
  successes: number;
  failures: number;
  truth: number;
  mean: number;
}

/** Cells the rate's belief is held in: the default is the old fixed grid. */
const CELLS = ['100', '200', '400'];
const FRAMES = 160;
/** Central credible intervals: the tail probabilities each end cuts off, written out so that the
 * default's 0.05 and 0.95 are the old constants exactly (1 − 0.9 is not 0.1 in floating point). */
const CREDIBLE: Record<string, { lo: number; hi: number; name: string; lower: string; upper: string }> = {
  '0.8': { lo: 0.1, hi: 0.9, name: '80%', lower: '10%', upper: '90%' },
  '0.9': { lo: 0.05, hi: 0.95, name: '90%', lower: '5%', upper: '95%' },
  '0.95': { lo: 0.025, hi: 0.975, name: '95%', lower: '2.5%', upper: '97.5%' },
  '0.99': { lo: 0.005, hi: 0.995, name: '99%', lower: '0.5%', upper: '99.5%' },
};
const PRIORS: Record<string, [number, number]> = { flat: [1, 1], sceptical: [2, 8], hopeful: [8, 2], jeffreys: [0.5, 0.5] };

/** Scale cell masses to sum to one. */
function normalise(m: number[]): number[] {
  const z = m.reduce((x, y) => x + y, 0);
  return m.map((v) => v / z);
}

/** Mean, standard deviation and the ends cutting off `tails` of a distribution held as G cell
 * masses; an end is the right edge of the cell where the cumulative mass crosses, so it is exact
 * only to the cell width 1 / G. */
function summary(grid: number[], m: number[], tails: { lo: number; hi: number }) {
  const G = grid.length;
  let mu = 0;
  let m2 = 0;
  for (let i = 0; i < G; i++) { mu += grid[i] * m[i]; m2 += grid[i] * grid[i] * m[i]; }
  let c = 0;
  let lo = NaN;
  let hi = NaN;
  for (let i = 0; i < G; i++) {
    c += m[i];
    if (Number.isNaN(lo) && c >= tails.lo) lo = (i + 1) / G;
    if (Number.isNaN(hi) && c >= tails.hi) hi = (i + 1) / G;
  }
  return { mean: mu, sd: Math.sqrt(Math.max(0, m2 - mu * mu)), lo, hi };
}

/** The Beta(a, b) q-quantile, by bisection on its distribution function to below 1e-12. */
function betaQuantile(q: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 42; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The most trials the data form takes (the grid update is one pass, so this bounds nothing heavy). */
export const MAX_TRIALS = 1e9;

/**
 * A caller's evidence {successes, failures, prior?, credible?, cells?}: the posterior of the rate
 * in closed form, Beta(a + successes, b + failures), and the plate's own grid update beside it as
 * the check (each cell multiplied by theta^s (1 - theta)^f at its midpoint, in logs).
 */
export const data: DataForm = {
  input: '{successes, failures, prior?: "flat" | "jeffreys" | "sceptical" | "hopeful" | [a, b], credible?: 0.8 | 0.9 | 0.95 | 0.99, cells?: 100 | 200 | 400}',
  solve(raw) {
    if (!record(raw)) return 'the input must be an object {successes, failures, prior?, credible?, cells?}';
    const extra = unknownKeys(raw, ['successes', 'failures', 'prior', 'credible', 'cells']);
    if (extra) return extra;
    const { successes: k, failures: f, prior = 'flat', credible = 0.9, cells = 400 } = raw;
    if (!integer(k) || !integer(f) || k < 0 || f < 0 || k + f > MAX_TRIALS) return `successes and failures must be non-negative integers, at most ${MAX_TRIALS} in all`;
    const ab = typeof prior === 'string' ? PRIORS[prior] : Array.isArray(prior) && prior.length === 2 && prior.every((v) => finite(v) && v > 0) ? (prior as [number, number]) : undefined;
    if (!ab) return `prior must be one of ${Object.keys(PRIORS).join(', ')} or [a, b] with a, b > 0`;
    const ci = CREDIBLE[String(credible)];
    if (!ci) return `credible must be one of ${Object.keys(CREDIBLE).join(', ')}`;
    if (!CELLS.includes(String(cells))) return `cells must be one of ${CELLS.join(', ')}`;
    const [a, b] = ab; const s = k; const n = f;
    const [ca, cb] = [a + s, b + n];
    const G = Number(cells);
    const grid = Array.from({ length: G }, (_, i) => (i + 0.5) / G);
    const logs = grid.map((t, i) => Math.log(betaCdf((i + 1) / G, a, b) - betaCdf(i / G, a, b)) + s * Math.log(t) + n * Math.log(1 - t));
    const top = Math.max(...logs);
    const sm = summary(grid, normalise(logs.map((l) => Math.exp(l - top))), ci);
    return {
      prior: [a, b],
      posterior: [ca, cb],
      mean: ca / (ca + cb),
      sd: Math.sqrt((ca * cb) / ((ca + cb) ** 2 * (ca + cb + 1))),
      level: ci.name,
      lower: betaQuantile(ci.lo, ca, cb),
      upper: betaQuantile(ci.hi, ca, cb),
      grid: { cells: G, mean: sm.mean, sd: sm.sd, lower: sm.lo, upper: sm.hi },
    };
  },
};

// The rate of an event, unknown, believed a priori to follow a Beta density. The belief is held
// as the probability of each of G cells of the rate, the prior's taken exactly from the Beta
// distribution function (so a prior that is infinite at an end, like Jeffreys', is still a
// finite mass per cell); each observed trial multiplies every cell by the likelihood of what
// was seen at the cell's midpoint (theta for an event, 1 - theta for none) and renormalises.
// That is generic Bayes; the Beta prior is chosen so that the closed form,
// Beta(a + events, b + non-events), can check it.
export const kernel: StochasticKernel<BayesResult> = {
  data,
  palette: 'abyss',
  params: [
    // the input: today's only seeded evidence, beside which a reader's own outcomes are offered (ADR 0010)
    { kind: 'select', key: 'evidence', label: 'Evidence', value: 'simulated', rebuild: true,
      options: [{ value: 'simulated', label: 'Trials drawn at the true rate' }] },
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
    {
      kind: 'select', key: 'cells', label: 'Grid cells', value: '400', rebuild: true,
      options: CELLS.map((value) => ({ value, label: `${value} cells` })),
    },
    {
      kind: 'select', key: 'credible', label: 'Credible level', value: '0.9', rebuild: true,
      options: Object.entries(CREDIBLE).map(([value, c]) => ({ value, label: c.name })),
    },
  ],
  chart: { title: 'Posterior as evidence arrives', x: { label: 'observations' }, y: { label: 'rate' } },
  *run(ops, cfg, reader) {
    // a reader's outcomes (ADR 0010): the same update on them, with no true rate behind them
    const mine = readerTable(cfg, 'evidence', reader);
    if (mine) return yield* onOutcomes(ops, column(mine), cfg);
    const s = new Sampler(() => ops.rnd());
    const [a, b] = PRIORS[str(cfg, 'prior')] ?? PRIORS.flat;
    const truth = num(cfg, 'truth');
    const n = num(cfg, 'n');
    const G = CELLS.includes(str(cfg, 'cells')) ? num(cfg, 'cells') : 400;
    const ci = CREDIBLE[str(cfg, 'credible')] ?? CREDIBLE['0.9'];
    const grid = Array.from({ length: G }, (_, i) => (i + 0.5) / G);
    const prior = normalise(grid.map((_, i) => betaCdf((i + 1) / G, a, b) - betaCdf(i / G, a, b)));
    let post = prior.slice();
    let succ = 0;
    const every = Math.max(1, Math.ceil(n / FRAMES));
    // drawn as a density: mass over cell width
    const curve = (m: number[]) => grid.map((t, i) => [t, m[i] * G] as [number, number]);
    const priorCurve = curve(prior);
    const show = (k: number, last: string) => {
      const sm = summary(grid, post, ci);
      ops.point('posterior mean', k, sm.mean);
      ops.point(`${ci.lower} bound`, k, sm.lo);
      ops.point(`${ci.upper} bound`, k, sm.hi);
      ops.point('true rate', k, truth);
      const top = Math.max(...post, ...prior) * G * 1.05;
      const cm = (a + succ) / (a + b + k);
      // the conjugate posterior's own ends, which the grid's must match to a cell
      const [ca, cb] = [a + succ, b + k - succ];
      ops.frame([{
        kind: 'plot', title: 'Prior (faint) and posterior density of the rate', x: [0, 1], y: [0, top],
        band: { pts: grid.flatMap((t, i) => (t >= sm.lo - 1 / G && t <= sm.hi ? [[t, 0, post[i] * G] as [number, number, number]] : [])), tone: 0.45 },
        lines: [{ pts: priorCurve, tone: -1, alpha: 0.35, weight: 1 }, { pts: curve(post), tone: 0.6, weight: 2 }],
        marks: [{ x: truth, label: 'true rate', tone: -1, dash: true }],
      }], [
        { label: 'Observations', value: `${fmt(k)}: ${fmt(succ)} events, ${fmt(k - succ)} none` },
        { label: 'Posterior mean', value: pm(sm.mean, sm.sd) },
        { label: `${ci.name} credible interval`, value: `${fmt(sm.lo, 4)} – ${fmt(sm.hi, 4)} (to the cell width ${fmt(1 / G, 4)})` },
        { label: 'Last observation', value: last },
        { label: 'Closed form Beta mean', value: `${fmt(cm, 3)} for Beta(${fmt(a + succ, 1)}, ${fmt(b + k - succ, 1)})` },
        { label: 'Closed form lower end', value: `${fmt(betaQuantile(ci.lo, ca, cb), 4)}, the ${ci.lower} quantile` },
        { label: 'Closed form upper end', value: `${fmt(betaQuantile(ci.hi, ca, cb), 4)}, the ${ci.upper} quantile` },
      ]);
    };
    show(0, '—');
    for (let k = 1; k <= n; k++) {
      const event = s.bernoulli(truth);
      if (event) succ++;
      post = normalise(post.map((d, i) => d * (event ? grid[i] : 1 - grid[i])));
      ops.count(G);
      if (k % every === 0 || k === n) {
        show(k, event ? 'event' : 'no event');
        yield;
      }
    }
    return { grid, posterior: post, prior: [a, b], successes: succ, failures: n - succ, truth, mean: summary(grid, post, ci).mean };
  },
};

/**
 * The update on a reader's outcomes, in their order: a value x in [0, 1] counts x of an event and
 * 1 − x of none, its likelihood θ^x (1 − θ)^(1 − x) at each cell's midpoint, so 0 and 1 are the
 * ordinary trials and the closed form Beta(a + Σx, b + Σ(1 − x)) still checks the grid. There is
 * no true rate: none is marked, and no frame compares with one.
 */
function* onOutcomes(ops: StochasticOps, xs: number[], cfg: Params): Generator<void, BayesResult, void> {
  const [a, b] = PRIORS[str(cfg, 'prior')] ?? PRIORS.flat;
  const n = xs.length;
  const G = CELLS.includes(str(cfg, 'cells')) ? num(cfg, 'cells') : 400;
  const ci = CREDIBLE[str(cfg, 'credible')] ?? CREDIBLE['0.9'];
  const grid = Array.from({ length: G }, (_, i) => (i + 0.5) / G);
  const prior = normalise(grid.map((_, i) => betaCdf((i + 1) / G, a, b) - betaCdf(i / G, a, b)));
  const whole = xs.every((x) => x === 0 || x === 1);
  const input = readerInput(`${fmt(n)} outcomes${whole ? '' : ', fractional ones counted as part events'}`);
  let post = prior.slice();
  let succ = 0;
  const every = Math.max(1, Math.ceil(n / FRAMES));
  const curve = (m: number[]) => grid.map((t, i) => [t, m[i] * G] as [number, number]);
  const priorCurve = curve(prior);
  const digits = whole ? 0 : 2;
  const show = (k: number, last: string) => {
    const sm = summary(grid, post, ci);
    ops.point('posterior mean', k, sm.mean);
    ops.point(`${ci.lower} bound`, k, sm.lo);
    ops.point(`${ci.upper} bound`, k, sm.hi);
    const top = Math.max(...post, ...prior) * G * 1.05;
    const [ca, cb] = [a + succ, b + k - succ];
    ops.frame([{
      kind: 'plot', title: 'Prior (faint) and posterior density of the rate, on your outcomes', x: [0, 1], y: [0, top],
      band: { pts: grid.flatMap((t, i) => (t >= sm.lo - 1 / G && t <= sm.hi ? [[t, 0, post[i] * G] as [number, number, number]] : [])), tone: 0.45 },
      lines: [{ pts: priorCurve, tone: -1, alpha: 0.35, weight: 1 }, { pts: curve(post), tone: 0.6, weight: 2 }],
    }], [
      input,
      { label: 'Observations', value: `${fmt(k)}: ${fmt(succ, digits)} events, ${fmt(k - succ, digits)} none` },
      { label: 'Posterior mean', value: pm(sm.mean, sm.sd) },
      { label: `${ci.name} credible interval`, value: `${fmt(sm.lo, 4)} – ${fmt(sm.hi, 4)} (to the cell width ${fmt(1 / G, 4)})` },
      { label: 'Last observation', value: last },
      { label: 'Closed form Beta mean', value: `${fmt(ca / (ca + cb), 3)} for Beta(${fmt(ca, 1)}, ${fmt(cb, 1)})` },
      { label: 'Closed form lower end', value: `${fmt(betaQuantile(ci.lo, ca, cb), 4)}, the ${ci.lower} quantile` },
      { label: 'Closed form upper end', value: `${fmt(betaQuantile(ci.hi, ca, cb), 4)}, the ${ci.upper} quantile` },
      { label: 'True rate', value: 'none: your outcomes have no known rate behind them' },
    ]);
  };
  show(0, '—');
  yield;
  for (let k = 1; k <= n; k++) {
    const x = xs[k - 1];
    succ += x;
    post = normalise(post.map((d, i) => d * (x === 1 ? grid[i] : x === 0 ? 1 - grid[i] : grid[i] ** x * (1 - grid[i]) ** (1 - x))));
    ops.count(G);
    if (k % every === 0 || k === n) {
      show(k, x === 1 ? 'event' : x === 0 ? 'no event' : `${fmt(x, 3)} of an event`);
      yield;
    }
  }
  return { grid, posterior: post, prior: [a, b], successes: succ, failures: n - succ, truth: NaN, mean: summary(grid, post, ci).mean };
}
