import { num } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

export interface DriftStep {
  shift: number;
  scale: number;
  /** Smoothed bin proportions of the reference and of the current window. */
  p: number[];
  q: number[];
  psi: number;
  kl: number;
  /** KL(reference || current), the other direction: kl + klBack is the PSI. */
  klBack: number;
  js: number;
}

export interface DriftResult { steps: DriftStep[]; bins: number; lo: number; hi: number }

/** Proportions with half a count added to every bin, so that no bin is empty. */
export function proportions(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0) + 0.5 * counts.length;
  return counts.map((c) => (c + 0.5) / total);
}

/** Population stability index: sum of (q - p) ln(q / p). */
export function psi(p: number[], q: number[]): number {
  return p.reduce((s, pi, i) => s + (q[i] - pi) * Math.log(q[i] / pi), 0);
}

/** Kullback–Leibler divergence KL(q || p) in nats. */
export function kl(q: number[], p: number[]): number {
  return q.reduce((s, qi, i) => s + (qi > 0 ? qi * Math.log(qi / p[i]) : 0), 0);
}

/** Jensen–Shannon divergence in bits: in [0, 1], symmetric. */
export function js(p: number[], q: number[]): number {
  const m = p.map((pi, i) => (pi + q[i]) / 2);
  return (0.5 * kl(p, m) + 0.5 * kl(q, m)) / Math.LN2;
}

const STEPS = 80;
const LO = -4;
const HI = 7;
const BINS = 22;

// A reference window from N(0, 1) against windows from a distribution that moves and widens
// step by step; all three divergences are read from the same binned proportions.
export const kernel: StochasticKernel<DriftResult> = {
  palette: 'riso',
  params: [
    { kind: 'range', key: 'n', label: 'Samples per window', min: 200, max: 20000, step: 100, value: 2000, rebuild: true },
    { kind: 'range', key: 'drift', label: 'Final mean shift', min: 0, max: 3, step: 0.1, value: 1.5, rebuild: true },
    { kind: 'range', key: 'widen', label: 'Final extra spread', min: 0, max: 1.5, step: 0.1, value: 0.4, rebuild: true },
  ],
  chart: { title: 'Divergence as the distribution drifts', x: { label: 'mean shift' }, y: { label: 'divergence' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const n = num(cfg, 'n');
    const ref = Array.from({ length: n }, () => s.normal());
    yield;
    const pc = histogram(ref, LO, HI, BINS);
    const p = proportions(pc);
    const steps: DriftStep[] = [];
    for (let k = 0; k <= STEPS; k++) {
      const shift = (num(cfg, 'drift') * k) / STEPS;
      const scale = 1 + (num(cfg, 'widen') * k) / STEPS;
      const cur = Array.from({ length: n }, () => s.normal(shift, scale));
      const qc = histogram(cur, LO, HI, BINS);
      const q = proportions(qc);
      ops.count(3);
      const step = { shift, scale, p, q, psi: psi(p, q), kl: kl(q, p), klBack: kl(p, q), js: js(p, q) };
      steps.push(step);
      ops.point('PSI', shift, step.psi);
      ops.point('KL(current ‖ reference), nats', shift, step.kl);
      ops.point('Jensen–Shannon, bits', shift, step.js);
      ops.frame([
        {
          kind: 'hist', title: 'Reference (bars) and current window (outline), proportions', lo: LO, hi: HI,
          bins: pc, tone: 0.2, overlay: { bins: qc, tone: 0.0 }, normalise: true,
          marks: [{ x: 0, tone: 0.2, dash: true }, { x: shift, tone: 0.0, dash: true }],
        },
        {
          kind: 'bars', title: 'Divergences now', x: [0, Math.max(1, ...steps.map((q2) => Math.max(q2.psi, q2.kl)))],
          rows: [
            { label: 'PSI', lo: 0, hi: step.psi, tone: 0.1 },
            { label: 'KL', lo: 0, hi: step.kl, tone: 0.45 },
            { label: 'JS (bits)', lo: 0, hi: step.js, tone: 0.9 },
          ],
        },
      ], [
        { label: 'PSI', value: `${fmt(step.psi, 4)}${step.psi > 0.25 ? ' (above the customary 0.25 alarm)' : step.psi > 0.1 ? ' (above 0.1: watch)' : ''}` },
        { label: 'KL(current ‖ reference)', value: `${fmt(step.kl, 4)} nats` },
        { label: 'KL both ways', value: `${fmt(step.kl, 4)} + ${fmt(step.klBack, 4)} = ${fmt(step.kl + step.klBack, 4)} nats` },
        { label: 'Jensen–Shannon', value: `${fmt(step.js, 4)} bits` },
        { label: 'Window drawn from', value: `N(${fmt(shift, 2)}, ${fmt(scale, 2)}²), ${fmt(n)} samples` },
        { label: 'Step', value: `${fmt(k)} of ${fmt(STEPS)}` },
      ]);
      yield;
    }
    return { steps, bins: BINS, lo: LO, hi: HI };
  },
};
