import { num } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import { population } from '../../engines/stochastic/scenarios';
import type { Panel, StochasticKernel } from '../../engines/stochastic/trace';

/** One synchronous step: every agent moves to the mean opinion of the agents within eps of it
 * (itself included). Returns the new opinions and the pair comparisons made. */
export function hkStep(x: number[], eps: number): { next: number[]; compares: number } {
  const n = x.length;
  // with the opinions sorted, each agent's neighbours are a contiguous window
  const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const sorted = order.map((i) => x[i]);
  const prefix = [0];
  for (const v of sorted) prefix.push(prefix[prefix.length - 1] + v);
  const next = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  let compares = 0;
  for (let k = 0; k < n; k++) {
    while (sorted[k] - sorted[lo] > eps) { lo++; compares++; }
    if (hi < k) hi = k;
    while (hi + 1 < n && sorted[hi + 1] - sorted[k] <= eps) { hi++; compares++; }
    compares += 2;
    next[order[k]] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
  }
  return { next, compares };
}

/** Groups of opinions separated by gaps wider than tol. */
export function clusters(x: number[], tol: number): number[][] {
  const s = x.slice().sort((a, b) => a - b);
  const out: number[][] = [];
  for (const v of s) {
    const last = out[out.length - 1];
    if (last && v - last[last.length - 1] <= tol) last.push(v);
    else out.push([v]);
  }
  return out;
}

export interface OpinionResult {
  initial: number[];
  final: number[];
  steps: number;
  converged: boolean;
  history: number[][];
}

const MAX_STEPS = 60;
const HOLD = 6;

// Bounded confidence: an agent listens only to those whose opinion lies within eps of its own,
// and takes their average. The update preserves the order of opinions, and the agents freeze
// into clusters more than eps apart after finitely many steps: one consensus for a wide eps,
// several camps for a narrow one.
export const kernel: StochasticKernel<OpinionResult> = {
  palette: 'spectral',
  params: [
    { kind: 'range', key: 'n', label: 'Agents', min: 20, max: 400, step: 10, value: 120, rebuild: true },
    { kind: 'range', key: 'eps', label: 'Confidence bound ε', min: 0.02, max: 0.5, step: 0.01, value: 0.12, rebuild: true },
  ],
  chart: { title: 'Opinion groups over time', x: { label: 'step' }, y: { label: 'groups (gaps above 0.001)' } },
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const n = num(cfg, 'n');
    const eps = num(cfg, 'eps');
    const initial = population(s, n);
    const history: number[][] = [initial];
    let x = initial;
    let steps = 0;
    let converged = false;
    let move = 1;
    const tones = initial.map((v) => v);
    const frame = (times: number) => {
      const groups = clusters(x, 1e-3);
      ops.point('groups', steps, groups.length);
      const lines = initial.map((_, i) => ({ pts: history.map((h, t) => [t, h[i]] as [number, number]), tone: tones[i], weight: 1, alpha: 0.55 }));
      const panels: Panel[] = [{
        kind: 'plot', title: `Opinions over time, ε = ${fmt(eps, 2)}`, x: [0, MAX_STEPS], y: [0, 1], lines,
        dots: [{ pts: x.map((v) => [steps, v] as [number, number]), tones, size: 2 }],
      }];
      const stats = [
        { label: 'Step', value: `${fmt(steps)}${converged ? ' (frozen)' : ''}` },
        { label: 'Groups', value: `${fmt(groups.length)}; largest holds ${fmt(Math.max(...groups.map((g) => g.length)))} agents` },
        { label: 'Largest move this step', value: fmt(move, 6) },
        { label: 'Opinion range', value: `${fmt(Math.min(...x), 3)} – ${fmt(Math.max(...x), 3)}` },
      ];
      for (let h = 0; h < times; h++) ops.frame(panels, stats);
    };
    frame(HOLD);
    while (steps < MAX_STEPS && !converged) {
      const r = hkStep(x, eps);
      ops.count(r.compares);
      move = Math.max(...r.next.map((v, i) => Math.abs(v - x[i])));
      x = r.next;
      steps++;
      history.push(x);
      converged = move < 1e-12;
      frame(HOLD);
    }
    frame(40);
    return { initial, final: x, steps, converged, history };
  },
};
