// Every live stochastic kernel of the catalogue, checked by one harness: the generic contract
// (frames, counted draws, determinism by seed) for each, and a check against an independent
// reference with a statistical tolerance and a fixed seed for each id (ADR 0004 §4). A live
// entry without a reference check fails the harness.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type p5 from 'p5';
import type { Params, PlateContext } from '../src/core/plate';
import { GROUNDS, palette } from '../src/core/palette';
import { drawPanels, layout } from '../src/engines/stochastic/draw';
import { engine, Replay, STEP_MS } from '../src/engines/stochastic/index';
import { config, Runner, trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import type { BayesResult } from '../src/kernels/stochastic/bayes-update';
import type { BoxMullerResult } from '../src/kernels/stochastic/box-muller';
import type { BootstrapResult } from '../src/kernels/stochastic/bootstrap-ci';
import { PREDICTIONS, type ConformalResult } from '../src/kernels/stochastic/conformal-intervals';
import { combine, belief, plausibility, type DempsterResult } from '../src/kernels/stochastic/dempster-shafer';
import type { DriftResult } from '../src/kernels/stochastic/drift-divergence';
import { hkStep, type OpinionResult } from '../src/kernels/stochastic/hegselmann-krause';
import { pav, type IsotonicResult } from '../src/kernels/stochastic/isotonic-calibration';
import type { VerdictResult } from '../src/kernels/stochastic/mc-verdict-stability';
import type { NoisyOrResult } from '../src/kernels/stochastic/noisy-or';
import { pageHinkley, type PageHinkleyResult } from '../src/kernels/stochastic/page-hinkley';
import { longestPath, pertShape, type PertResult } from '../src/kernels/stochastic/pert-monte-carlo';
import type { RocResult } from '../src/kernels/stochastic/base-rate-roc';
import type { SearchResult } from '../src/kernels/stochastic/_search';
import type { ShapleyResult } from '../src/kernels/stochastic/shapley-values';
import type { SobolResult } from '../src/kernels/stochastic/sobol-indices';
import { model as tornadoModel, triangular, type TornadoResult } from '../src/kernels/stochastic/tornado-sensitivity';
import type { RiskResult } from '../src/kernels/stochastic/var-cvar';
import { betaCdf, Sampler } from '../src/engines/stochastic/sample';
import { mulberry32 } from '../src/core/random';

const modules = import.meta.glob<StochasticKernel>('../src/kernels/stochastic/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'stochastic' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/stochastic/${id}.ts`];
const run = <R>(id: string, params: Params = {}, seed = 12345) => trace(kernelOf(id) as StochasticKernel<R>, params, seed).result;

// --- independent references ---------------------------------------------------------------

/** Normal distribution function by Simpson's rule on the density (not the kernels' erf). */
function phi(x: number): number {
  const a = Math.min(0, x);
  const b = Math.max(0, x);
  const m = 2000;
  const h = (b - a) / m;
  const f = (t: number) => Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI);
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  const area = (s * h) / 3;
  return x >= 0 ? 0.5 + area : 0.5 - area;
}

const lgamma = (z: number): number => {
  // Stirling series with shift, accurate well beyond what the tests need
  let shift = 0;
  while (z < 8) { shift += Math.log(z); z += 1; }
  const s = 1 / z;
  return (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI)
    + s / 12 - s ** 3 / 360 + s ** 5 / 1260 - shift;
};
const betaPdf = (x: number, a: number, b: number) =>
  Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (lgamma(a) + lgamma(b) - lgamma(a + b)));

const meanOf = (xs: ArrayLike<number>) => Array.from(xs).reduce((s, v) => s + v, 0) / xs.length;
const varOf = (xs: ArrayLike<number>) => {
  const m = meanOf(xs);
  return Array.from(xs).reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
};
const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const CHECKS: Record<string, () => void> = {
  'box-muller'() {
    const r = run<BoxMullerResult>('box-muller', { n: 40000 });
    const n = r.z.length;
    expect(Math.abs(r.mean)).toBeLessThan(4 / Math.sqrt(n));
    expect(Math.abs(r.variance - 1)).toBeLessThan(4 * Math.sqrt(2 / n));
    // KS distance recomputed against an independent normal distribution function
    const s = Array.from(r.z).sort((a, b) => a - b);
    let d = 0;
    for (let i = 0; i < n; i += 1) {
      if (i % 7) continue;
      const f = phi(s[i]);
      d = Math.max(d, (i + 1) / n - f, f - i / n);
    }
    expect(d).toBeLessThan(1.63 / Math.sqrt(n) + 7 / n); // 1% critical value
    expect(Math.abs(r.ks - d)).toBeLessThan(7 / n + 1e-4);
    expect(Math.abs(r.pairCorrelation)).toBeLessThan(4 / Math.sqrt(n / 2));
  },

  'simulated-annealing'() {
    const best: number[] = [];
    const rand: number[] = [];
    for (let seed = 1; seed <= 9; seed++) {
      const t = trace(kernelOf('simulated-annealing') as StochasticKernel<SearchResult>, { landscape: 'rastrigin', budget: 2400 }, seed);
      const r = t.result;
      // the Evaluations readout is the algorithm's own: the random baseline's are not in it
      expect(t.evals).toBe(r.evals);
      expect(r.evals).toBe(2400);
      const [x, y] = r.bestAt;
      // the reported best is the objective at the reported point (Rastrigin written out here)
      expect(r.best).toBeCloseTo(20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y), 9);
      best.push(r.best);
      rand.push(r.randomBest);
    }
    expect(median(best)).toBeLessThan(median(rand));
  },

  'particle-swarm'() {
    const best: number[] = [];
    const rand: number[] = [];
    for (let seed = 1; seed <= 9; seed++) {
      const t = trace(kernelOf('particle-swarm') as StochasticKernel<SearchResult>, { landscape: 'rastrigin', budget: 2400 }, seed);
      const r = t.result;
      expect(t.evals).toBe(r.evals);
      const [x, y] = r.bestAt;
      expect(r.best).toBeCloseTo(20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y), 9);
      best.push(r.best);
      rand.push(r.randomBest);
    }
    expect(median(best)).toBeLessThan(median(rand));
    // on Himmelblau the swarm finds one of the four zero minima
    const h = run<SearchResult>('particle-swarm', { landscape: 'himmelblau', budget: 3000 }, 3);
    expect(h.best).toBeLessThan(1e-3);
  },

  'page-hinkley'() {
    for (let seed = 1; seed <= 6; seed++) {
      const r = run<PageHinkleyResult>('page-hinkley', { n: 800, shift: 1.5, delta: 0.5, lambda: 15 }, seed);
      expect(r.alarm, `seed ${seed} detects`).toBeGreaterThanOrEqual(r.change);
      expect(r.alarm - r.change, `seed ${seed} delay`).toBeLessThan(80);
      const quiet = run<PageHinkleyResult>('page-hinkley', { n: 2000, shift: 0, delta: 0.5, lambda: 15 }, seed);
      expect(quiet.alarm, `seed ${seed} stationary`).toBe(-1);
    }
    // the test statistic recomputed directly from its definition
    const r = run<PageHinkleyResult>('page-hinkley', { n: 300, shift: 1 }, 9);
    let mT = 0;
    let minM = 0;
    let sum = 0;
    r.stream.forEach((x, t) => {
      sum += x;
      mT += x - sum / (t + 1) - r.delta;
      minM = Math.min(minM, mT);
      expect(r.statistic[t]).toBeCloseTo(mT - minM, 9);
    });
    expect(pageHinkley([0, 0, 0, 10, 10], 0, 5).alarm).toBe(3);
  },

  'drift-divergence'() {
    const r = run<DriftResult>('drift-divergence', { n: 20000, drift: 1.5, widen: 0 });
    for (const st of r.steps) {
      const klpq = st.p.reduce((s, p, i) => s + p * Math.log(p / st.q[i]), 0);
      const klqp = st.q.reduce((s, q, i) => s + q * Math.log(q / st.p[i]), 0);
      // PSI is the symmetrised KL divergence, exactly
      expect(st.psi).toBeCloseTo(klpq + klqp, 10);
      expect(st.kl).toBeCloseTo(klqp, 10);
      expect(st.js).toBeGreaterThanOrEqual(0);
      expect(st.js).toBeLessThanOrEqual(1);
    }
    // the binned KL of N(1.5, 1) from N(0, 1) stays near the analytic 1.5² / 2
    const last = r.steps[r.steps.length - 1];
    expect(last.kl).toBeGreaterThan(0.75 * (1.5 ** 2 / 2));
    expect(last.kl).toBeLessThan(1.1 * (1.5 ** 2 / 2));
    expect(r.steps[0].psi).toBeLessThan(0.02);
  },

  'bayes-update'() {
    for (const prior of ['flat', 'sceptical', 'hopeful', 'jeffreys']) {
      const r = run<BayesResult>('bayes-update', { prior, truth: 0.3, n: 200 });
      const [a, b] = r.prior;
      const A = a + r.successes;
      const B = b + r.failures;
      // cell probabilities, as densities, against the conjugate Beta(a + s, b + f) density
      const dens = r.posterior.map((m) => m * r.grid.length);
      const err = Math.max(...r.grid.map((t, i) => Math.abs(dens[i] - betaPdf(t, A, B))));
      expect(err, prior).toBeLessThan(0.02 * Math.max(...dens));
      expect(r.mean, prior).toBeCloseTo(A / (A + B), 3);
    }
    // Jeffreys with no events: the density is infinite at 0, the cells' masses are not
    let checked = 0;
    for (let seed = 1; seed <= 20 && checked < 3; seed++) {
      const r = run<BayesResult>('bayes-update', { prior: 'jeffreys', truth: 0.02, n: 10 }, seed);
      if (r.successes) continue;
      checked++;
      const want = 0.5 / (1 + r.failures);
      expect(Math.abs(r.mean - want), `seed ${seed}`).toBeLessThan(1e-3);
    }
    expect(checked).toBeGreaterThan(0);
    // the Beta distribution function against closed forms
    expect(betaCdf(0.3, 2, 3)).toBeCloseTo(6 * 0.09 - 8 * 0.027 + 3 * 0.0081, 12);
    expect(betaCdf(0.25, 0.5, 0.5)).toBeCloseTo((2 / Math.PI) * Math.asin(0.5), 12);
  },

  'noisy-or'() {
    for (let seed = 1; seed <= 5; seed++) {
      const r = run<NoisyOrResult>('noisy-or', { k: 7, leak: 0.05, n: 20000 }, seed);
      const fail = r.links.reduce((s, p, i) => s * (r.present[i] ? 1 - p : 1), 1 - r.leak);
      expect(r.exact).toBeCloseTo(1 - fail, 12);
      expect(Math.abs(r.estimate - r.exact)).toBeLessThan(4 * Math.sqrt(r.exact * (1 - r.exact) / r.samples) + 1e-9);
    }
  },

  'dempster-shafer'() {
    // a hand-computed combination: A = H1, B = H2, C = H3, masks A=1, B=2, C=4
    const m1 = [0, 0.6, 0, 0.3, 0, 0, 0, 0.1];
    const m2 = [0, 0, 0.5, 0, 0, 0.3, 0, 0.2];
    const { mass, conflict } = combine(m1, m2);
    expect(conflict).toBeCloseTo(0.3, 12);
    expect(mass![1]).toBeCloseTo(0.39 / 0.7, 12);
    expect(mass![2]).toBeCloseTo(0.2 / 0.7, 12);
    expect(mass![3]).toBeCloseTo(0.06 / 0.7, 12);
    expect(mass![5]).toBeCloseTo(0.03 / 0.7, 12);
    expect(mass![7]).toBeCloseTo(0.02 / 0.7, 12);
    expect(belief(mass!, 3)).toBeCloseTo((0.39 + 0.2 + 0.06) / 0.7, 12);
    expect(plausibility(mass!, 4)).toBeCloseTo((0.03 + 0.02) / 0.7, 12);
    // total conflict leaves the rule undefined
    expect(combine([0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0]).mass).toBeNull();
    // the kernel against an independent step-by-step combination of its own sources, written
    // on sets of hypothesis names, across seeds that include near-total and total conflict
    type SetMass = Map<string, number>;
    const toSets = (m: number[]): SetMass => new Map(m.flatMap((v, x) => (x && v ? [[['H1', 'H2', 'H3'].filter((_, i) => x & (1 << i)).join(','), v]] : [])) as [string, number][]);
    const meet = (a: string, b: string) => a.split(',').filter((h) => b.split(',').includes(h)).join(',');
    const dempster = (a: SetMass, b: SetMass): SetMass | null => {
      const out: SetMass = new Map();
      let k = 0;
      for (const [x, u] of a) for (const [y, v] of b) {
        const z = meet(x, y);
        if (z) out.set(z, (out.get(z) ?? 0) + u * v); else k += u * v;
      }
      if (k >= 1 - 1e-12) return null;
      for (const [z, v] of out) out.set(z, v / (1 - k));
      return out;
    };
    let undefinedSeen = 0;
    let highSeen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = run<DempsterResult>('dempster-shafer', { sources: 8, ignorance: 0 }, seed);
      let acc: SetMass | null = toSets(r.sources[0]);
      let at = -1;
      for (let j = 1; j < r.sources.length && acc; j++) {
        acc = dempster(acc, toSets(r.sources[j]));
        if (!acc) at = j;
      }
      expect(r.undefinedAt, `seed ${seed}`).toBe(at);
      if (!acc) { expect(r.combined).toBeNull(); undefinedSeen++; continue; }
      if (Math.max(...r.conflicts) > 0.9) highSeen++;
      const want = acc;
      for (const [z, v] of toSets(r.combined!)) expect(v, `seed ${seed} ${z}`).toBeCloseTo(want.get(z) ?? 0, 10);
      for (const [z, v] of want) expect(toSets(r.combined!).get(z) ?? 0).toBeCloseTo(v, 10);
      expect(r.combined!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      for (let x = 1; x < 8; x++) expect(belief(r.combined!, x)).toBeLessThanOrEqual(plausibility(r.combined!, x) + 1e-12);
    }
    expect(undefinedSeen + highSeen, 'the seeds reach high or total conflict').toBeGreaterThan(0);
  },

  'isotonic-calibration'() {
    // brute force: the best monotone fit is a set of block means over some contiguous partition
    const rnd = mulberry32(5);
    for (let t = 0; t < 25; t++) {
      const n = 1 + Math.floor(rnd() * 8);
      const y = Array.from({ length: n }, () => Math.round(rnd() * 10) / 10);
      let best = Infinity;
      for (let cut = 0; cut < 1 << (n - 1); cut++) {
        const fit: number[] = [];
        let start = 0;
        for (let i = 0; i < n; i++) {
          if (i === n - 1 || cut & (1 << i)) {
            const m = meanOf(y.slice(start, i + 1));
            for (let j = start; j <= i; j++) fit.push(m);
            start = i + 1;
          }
        }
        if (fit.every((v, i) => i === 0 || fit[i - 1] <= v + 1e-12)) best = Math.min(best, fit.reduce((s, v, i) => s + (v - y[i]) ** 2, 0));
      }
      const f = pav(y);
      for (let i = 1; i < n; i++) expect(f[i]).toBeGreaterThanOrEqual(f[i - 1] - 1e-12);
      expect(f.reduce((s, v, i) => s + (v - y[i]) ** 2, 0)).toBeCloseTo(best, 10);
    }
    const r = run<IsotonicResult>('isotonic-calibration', { distortion: 'over', n: 3000 });
    for (let i = 1; i < r.fitted.length; i++) expect(r.fitted[i]).toBeGreaterThanOrEqual(r.fitted[i - 1]);
    expect(r.brierAfter).toBeLessThan(r.brierBefore);
    expect(r.eceAfter).toBeLessThan(r.eceBefore);
  },

  'shapley-values'() {
    for (const d of [3, 5, 6]) {
      const r = run<ShapleyResult>('shapley-values', { d, m: 3000 }, d);
      // exact values by the subset formula, |S|! (d - |S| - 1)! / d!
      const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
      const bits = (m: number) => m.toString(2).split('').filter((c) => c === '1').length;
      const exact = Array.from({ length: d }, (_, i) => {
        let phiI = 0;
        for (let S = 0; S < 1 << d; S++) {
          if (S & (1 << i)) continue;
          phiI += (fact(bits(S)) * fact(d - bits(S) - 1) / fact(d)) * (r.values[S | (1 << i)] - r.values[S]);
        }
        return phiI;
      });
      exact.forEach((e, i) => expect(r.exact[i]).toBeCloseTo(e, 10));
      const full = r.values[(1 << d) - 1] - r.values[0];
      expect(r.estimate.reduce((a, b) => a + b, 0)).toBeCloseTo(full, 9);
      r.estimate.forEach((e, i) => expect(Math.abs(e - exact[i])).toBeLessThan(4.5 * r.se[i] + 1e-9));
    }
  },

  'sobol-indices'() {
    const add = run<SobolResult>('sobol-indices', { model: 'additive', n: 20000 });
    add.first.forEach((s, i) => expect(Math.abs(s - add.analyticFirst[i])).toBeLessThan(0.03));
    add.total.forEach((s, i) => expect(Math.abs(s - add.analyticTotal[i])).toBeLessThan(0.03));
    // Ishigami (a = 7, b = 0.1): first-order 0.3139, 0.4424, 0; total 0.5576, 0.4424, 0.2437
    const ish = run<SobolResult>('sobol-indices', { model: 'ishigami', n: 20000 });
    [0.3139, 0.4424, 0].forEach((v, i) => expect(Math.abs(ish.first[i] - v)).toBeLessThan(0.04));
    [0.5576, 0.4424, 0.2437].forEach((v, i) => expect(Math.abs(ish.total[i] - v)).toBeLessThan(0.04));
  },

  'tornado-sensitivity'() {
    const r = run<TornadoResult>('tornado-sensitivity', { n: 2000 });
    const base = r.inputs.map((x) => x.base);
    expect(r.base).toBeCloseTo(base[0] * (base[1] - base[2]) * (1 - base[3]) - base[4], 9);
    let prev = Infinity;
    for (const sw of r.swings) {
      const at = (v: number) => tornadoModel(base.map((b, j) => (j === sw.i ? v : b)));
      expect(sw.atLow).toBeCloseTo(at(r.inputs[sw.i].low), 9);
      expect(sw.atHigh).toBeCloseTo(at(r.inputs[sw.i].high), 9);
      const w = Math.abs(sw.atHigh - sw.atLow);
      expect(w).toBeLessThanOrEqual(prev);
      prev = w;
    }
    // the triangular sampler: mean (a + c + b) / 3, variance (a² + b² + c² − ab − ac − bc) / 18,
    // and the mode's share of the mass (c − a) / (b − a), over a uniform grid of u
    const [a, c, b] = [2, 3, 7];
    const us = Array.from({ length: 100000 }, (_, i) => (i + 0.5) / 100000);
    const tx = us.map((u) => triangular(u, a, c, b));
    expect(meanOf(tx)).toBeCloseTo((a + b + c) / 3, 4);
    expect(varOf(tx)).toBeCloseTo((a * a + b * b + c * c - a * b - a * c - b * c) / 18, 3);
    expect(tx.filter((x) => x <= c).length / tx.length).toBeCloseTo((c - a) / (b - a), 4);
    // fixed cost enters linearly: its swing is exactly its range
    const fixed = r.swings.find((sw) => r.inputs[sw.i].name === 'fixed cost')!;
    expect(Math.abs(fixed.atHigh - fixed.atLow)).toBeCloseTo(r.inputs[4].high - r.inputs[4].low, 9);
  },

  'base-rate-roc'() {
    const r = run<RocResult>('base-rate-roc', { rate: 0.2, dprime: 1.5, n: 3000, threshold: 1 });
    // AUC against the Mann–Whitney statistic counted pair by pair
    const pos = r.score.filter((_, i) => r.label[i]);
    const neg = r.score.filter((_, i) => !r.label[i]);
    let u = 0;
    for (const p of pos) for (const q of neg) u += p > q ? 1 : p === q ? 0.5 : 0;
    expect(r.auc).toBeCloseTo(u / (pos.length * neg.length), 10);
    expect(Math.abs(r.auc - phi(1.5 / Math.SQRT2))).toBeLessThan(0.03);
    // the confusion counts at the threshold, recounted
    expect(r.tp).toBe(pos.filter((s) => s >= 1).length);
    expect(r.fp).toBe(neg.filter((s) => s >= 1).length);
    expect(r.tp + r.fn).toBe(pos.length);
    // at a rare base rate most alarms are false even for a good detector
    const rare = run<RocResult>('base-rate-roc', { rate: 0.005, dprime: 2, n: 40000, threshold: 2 });
    expect(rare.tp / (rare.tp + rare.fp)).toBeLessThan(0.3);
  },

  'bootstrap-ci'() {
    const r = run<BootstrapResult>('bootstrap-ci', { population: 'normal', n: 40, b: 4000, reps: 20 });
    // the bootstrap standard error of a mean is the plug-in standard deviation over √n
    const plug = Math.sqrt(varOf(r.data) * (r.data.length - 1) / r.data.length / r.data.length);
    expect(Math.abs(r.se - plug) / plug).toBeLessThan(0.06);
    const s = Array.from(r.boots).sort((a, b) => a - b);
    expect(r.interval[0]).toBe(s[Math.ceil(0.05 * s.length) - 1]);
    expect(r.interval[1]).toBe(s[Math.ceil(0.95 * s.length) - 1]);
    const cov = run<BootstrapResult>('bootstrap-ci', { population: 'normal', n: 40, b: 600, reps: 300 }, 7);
    expect(Math.abs(cov.coverage[4] - 0.9)).toBeLessThan(0.06);
    expect(Math.abs(cov.coverage[0] - 0.5)).toBeLessThan(0.1);
  },

  'conformal-intervals'() {
    const t = trace(kernelOf('conformal-intervals') as StochasticKernel<ConformalResult>, { ncal: 60, reps: 200 }, 3);
    const r = t.result;
    // evaluations are the model's predictions: every calibration and every test case
    expect(t.evals).toBe(200 * PREDICTIONS(60));
    const levels = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
    // split conformal: at least the nominal level, at most nominal + 1 / (n + 1), on average
    levels.forEach((l, i) => {
      expect(r.coverage[i]).toBeGreaterThan(l - 0.025);
      expect(r.coverage[i]).toBeLessThan(l + 1 / 61 + 0.025);
    });
    const k = Math.ceil(61 * 0.9);
    expect(r.radius).toBe(Array.from(r.residuals).sort((a, b) => a - b)[k - 1]);
  },

  'mc-verdict-stability'() {
    // with no strength noise, the exact stability enumerates which items hold up
    for (let seed = 1; seed <= 4; seed++) {
      const r = run<VerdictResult>('mc-verdict-stability', { k: 8, prior: -1, noise: 0, n: 20000 }, seed);
      let exact = 0;
      for (let S = 0; S < 1 << r.items.length; S++) {
        let p = 1;
        let lo = r.prior;
        r.items.forEach((e, i) => {
          if (S & (1 << i)) { p *= e.reliability; lo += e.llr; } else p *= 1 - e.reliability;
        });
        if (lo > 0 === r.baseline) exact += p;
      }
      expect(Math.abs(r.stability - exact)).toBeLessThan(4 * Math.sqrt(exact * (1 - exact) / r.runs) + 1e-9);
    }
    // an influence is a difference of two rates: percentage points, not per cent
    const t = trace(kernelOf('mc-verdict-stability'), {}, 1);
    expect(t.frames[t.frames.length - 1].stats.find((q) => q.label.startsWith('Most influential'))?.value).toMatch(/percentage points/);
  },

  'pert-monte-carlo'() {
    // the PERT-Beta sampler's mean is (a + 4m + b) / 6, its variance the Beta variance
    const s = new Sampler(mulberry32(17));
    const t = { a: 2, m: 5, b: 14 };
    const [al, be] = pertShape(t);
    const xs = Array.from({ length: 40000 }, () => t.a + (t.b - t.a) * s.beta(al, be));
    expect(Math.abs(meanOf(xs) - (t.a + 4 * t.m + t.b) / 6)).toBeLessThan(0.04);
    const bv = (al * be) / ((al + be) ** 2 * (al + be + 1)) * (t.b - t.a) ** 2;
    expect(Math.abs(varOf(xs) - bv) / bv).toBeLessThan(0.04);
    // the longest path against every path enumerated
    const r = run<PertResult>('pert-monte-carlo', { n: 2000 });
    const rnd = mulberry32(4);
    for (let trial = 0; trial < 20; trial++) {
      const d = r.tasks.map((x) => x.a + rnd() * (x.b - x.a));
      const longest = (i: number): number => d[i] + Math.max(0, ...r.tasks[i].after.map(longest));
      const want = Math.max(...r.tasks.map((_, i) => longest(i)));
      expect(longestPath(r.tasks, d).finish).toBeCloseTo(want, 9);
    }
    // merge bias: the simulated mean is never below every-task-at-its-mean
    expect(meanOf(r.finishes)).toBeGreaterThanOrEqual(r.deterministic - 1e-9);
  },

  'var-cvar'() {
    const r = run<RiskResult>('var-cvar', { scenario: 'normal', level: '0.95', n: 100000 });
    const s = Array.from(r.losses).sort((a, b) => a - b);
    const k = Math.ceil(0.95 * s.length) - 1;
    expect(r.var).toBe(s[k]);
    expect(r.cvar).toBeCloseTo(meanOf(s.slice(k)), 9);
    // normal losses: VaR 1.645, expected shortfall φ(1.645) / 0.05 = 2.063
    expect(Math.abs(r.var - 1.6449)).toBeLessThan(0.03);
    expect(Math.abs(r.cvar - 2.0627)).toBeLessThan(0.03);
    expect(r.cvar).toBeGreaterThanOrEqual(r.var);
    // the readout's tail is the number of losses actually averaged
    expect(r.tail).toBe(s.length - k);
    expect(r.tail).toBe(s.filter((x) => x >= r.var).length);
    // too few runs per batch: the standard errors are withheld, and the readout says why
    const thin = trace(kernelOf('var-cvar'), { scenario: 'normal', level: '0.995', n: 1000 }, 3);
    const last = thin.frames[thin.frames.length - 1].stats;
    expect(last.find((q) => q.label === 'Standard errors')?.value).toMatch(/^not shown/);
    expect(last.find((q) => q.label.startsWith('Value at risk'))?.value).not.toMatch(/±/);
  },

  'hegselmann-krause'() {
    const r = run<OpinionResult>('hegselmann-krause', { n: 120, eps: 0.12 });
    expect(r.converged).toBe(true);
    // one step against the definition, agent by agent
    for (let t = 0; t + 1 < Math.min(r.history.length, 5); t++) {
      const x = r.history[t];
      const want = x.map((xi) => meanOf(x.filter((xj) => Math.abs(xj - xi) <= 0.12)));
      want.forEach((w, i) => expect(r.history[t + 1][i]).toBeCloseTo(w, 12));
    }
    // order is preserved, and the frozen groups lie more than eps apart
    const order = r.initial.map((_, i) => i).sort((a, b) => r.initial[a] - r.initial[b]);
    for (let k = 1; k < order.length; k++) expect(r.final[order[k]]).toBeGreaterThanOrEqual(r.final[order[k - 1]] - 1e-12);
    const groups = [...new Set(r.final.map((v) => v.toFixed(9)))].map(Number).sort((a, b) => a - b);
    for (let k = 1; k < groups.length; k++) expect(groups[k] - groups[k - 1]).toBeGreaterThan(0.12);
    // a bound wider than the opinions' range reaches consensus at the mean in one step
    const wide = hkStep([0.1, 0.4, 0.9], 1);
    wide.next.forEach((v) => expect(v).toBeCloseTo(0.4666666666666667, 12));
  },
};

describe('stochastic kernels', () => {
  it('every live stochastic entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    describe(e.id, () => {
      it('records frames with measured readouts, counting draws as it goes', () => {
        const t = trace(kernelOf(e.id), {}, 2024);
        expect(t.frames.length).toBeGreaterThan(1);
        expect(t.draws).toBeGreaterThan(0);
        let draws = 0;
        for (const f of t.frames) {
          expect(f.draws).toBeGreaterThanOrEqual(draws);
          draws = f.draws;
          expect(f.panels.length).toBeGreaterThan(0);
          expect(f.stats.length).toBeGreaterThan(0);
          for (const s of f.stats) expect(typeof s.value).toBe('string');
          for (const [, pts, len] of f.series) for (const [x, y] of pts.slice(0, len)) expect(Number.isFinite(x) && !Number.isNaN(y)).toBe(true);
        }
      });

      it('is a function of its seed', () => {
        const a = trace(kernelOf(e.id), {}, 77);
        const b = trace(kernelOf(e.id), {}, 77);
        const c = trace(kernelOf(e.id), {}, 78);
        expect(b.draws).toBe(a.draws);
        expect(JSON.stringify(b.frames[b.frames.length - 1].stats)).toBe(JSON.stringify(a.frames[a.frames.length - 1].stats));
        expect(JSON.stringify(c.frames[c.frames.length - 1].stats)).not.toBe(JSON.stringify(a.frames[a.frames.length - 1].stats));
      });

      it('matches its independent reference', () => {
        const check = CHECKS[e.id];
        expect(check, `no reference check for ${e.id}`).toBeTypeOf('function');
        check();
      });
    });
  }
});

describe('stochastic engine budgets', () => {
  /** A piece of a run between two yields (ms): far above what a desktop takes, far below a
   * blocked frame. */
  const PIECE_MS = 25;
  const maxParams = (k: StochasticKernel): Params => {
    const out: Params = {};
    for (const d of k.params ?? []) if (d.kind === 'range') out[d.key] = d.max;
    return out;
  };

  for (const e of live) {
    it(`${e.id} is created without work and runs in bounded pieces at its maximum settings`, () => {
      const k = kernelOf(e.id);
      // the same seed gives the same pieces, so each piece's time is taken as its fastest of
      // three runs: a garbage collection or a busy machine slows one run, not all three
      const times: number[][] = [];
      for (let rep = 0; rep < 3; rep++) {
        const t0 = performance.now();
        const r = new Runner(k, maxParams(k), 5);
        expect(performance.now() - t0).toBeLessThan(5);
        expect(r.counts.draws).toBe(0);
        const t: number[] = [];
        const stop = performance.now() + 4000;
        while (!r.done && performance.now() < stop) {
          const a = performance.now();
          r.step(0);
          t.push(performance.now() - a);
        }
        times.push(t);
      }
      const n = Math.min(...times.map((t) => t.length));
      let worst = 0;
      for (let i = 0; i < n; i++) worst = Math.max(worst, Math.min(...times.map((t) => t[i])));
      expect(worst, `${e.id}: longest piece`).toBeLessThan(PIECE_MS);
    }, 60000);
  }

  it('prepares the next seed’s run while the finished one is held, so no frame stalls', () => {
    const k = kernelOf('bootstrap-ci');
    const params: Params = { ...config(k), speed: 4, loop: true };
    const ctx = { params, seed: 11 } as unknown as PlateContext;
    const r = new Replay(k, ctx);
    const first = r.run;
    let worst = 0;
    let swapped = false;
    let preparing = 0;
    for (let i = 0; i < 20000 && !swapped; i++) {
      const a = performance.now();
      r.tick();
      worst = Math.max(worst, performance.now() - a);
      if (r.next) preparing++;
      if (r.run !== first) {
        swapped = true;
        expect(r.run.frames.length, 'the new run already has frames').toBeGreaterThan(0);
      }
    }
    expect(swapped).toBe(true);
    expect(preparing, 'ticks that advanced the next run during the hold').toBeGreaterThan(1);
    // a stalled frame would hold the whole run (about a tenth of a second on a desktop)
    expect(worst).toBeLessThan(STEP_MS + 2 * PIECE_MS);
  });

  it('draws a frame with no panels yet (a run that has recorded nothing) without failing', () => {
    expect(layout(0, { x: 0, y: 0, w: 100, h: 50 }, 4)).toEqual([]);
    const p = new Proxy({}, { get: () => () => 0 }) as unknown as p5;
    expect(() => drawPanels(p, {} as PlateContext, [], { x: 0, y: 0, w: 100, h: 50 })).not.toThrow();
  });

  it('draws a landscape field once into an image, not as a rectangle per cell', () => {
    const calls: Record<string, number> = {};
    const img = { pixels: new Uint8ClampedArray(64 * 64 * 4), loadPixels() {}, updatePixels() {} };
    const p = new Proxy({}, {
      get: (_, key: string) => {
        if (key === 'textWidth') return () => 40;
        if (key === 'createImage') return () => { calls.createImage = (calls.createImage ?? 0) + 1; return img; };
        if (key.toUpperCase() === key) return key;
        return () => { calls[key] = (calls[key] ?? 0) + 1; };
      },
    }) as unknown as p5;
    const plate = engine.plate({ id: 'simulated-annealing', title: 't', group: 'g' }, kernelOf('simulated-annealing'));
    const params: Params = {};
    for (const d of plate.params) params[d.key] = d.value;
    const ctx = {
      width: 1280, height: 720, params, seed: 3, rnd: mulberry32(3), theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg,
      palette: () => palette(String(params.palette)), stats() {}, chart() {}, thumbnail: false,
    } as unknown as PlateContext;
    const sim = plate.create(p, ctx);
    sim.setup();
    const frames = 12;
    for (let i = 0; i < frames; i++) sim.draw();
    expect(calls.createImage).toBe(1);
    expect(calls.image).toBeGreaterThanOrEqual(frames - 1);
    expect((calls.rect ?? 0) / frames).toBeLessThan(100);
  });
});
