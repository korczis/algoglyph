// Seeded, synthetic and generic scenarios the stochastic kernels run on: objective landscapes,
// streams with a change point, score and label sets, task networks, evidence sets and agent
// populations. Each is drawn through a Sampler on the engine's counted generator, so the
// picture is a function of the seed.
import type { SelectParam } from '../../core/plate';
import type { Sampler } from './sample';

export interface Landscape {
  id: string;
  label: string;
  x: [number, number];
  y: [number, number];
  f(x: number, y: number): number;
  /** The function's known global minimum value. */
  min: number;
}

export const LANDSCAPES: Landscape[] = [
  {
    id: 'rastrigin', label: 'Rastrigin (many local minima)', x: [-5.12, 5.12], y: [-5.12, 5.12], min: 0,
    f: (x, y) => 20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y),
  },
  {
    id: 'ackley', label: 'Ackley (a funnel with ripples)', x: [-5, 5], y: [-5, 5], min: 0,
    f: (x, y) => -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y)))
      - Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y))) + Math.E + 20,
  },
  {
    id: 'himmelblau', label: 'Himmelblau (four equal minima)', x: [-5, 5], y: [-5, 5], min: 0,
    f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
  },
];

export function landscape(id: string): Landscape {
  return LANDSCAPES.find((l) => l.id === id) ?? LANDSCAPES[0];
}

export function landscapeParam(): SelectParam {
  return {
    kind: 'select', key: 'landscape', label: 'Landscape', value: 'rastrigin', rebuild: true,
    options: LANDSCAPES.map((l) => ({ value: l.id, label: l.label })),
  };
}

/** The landscape sampled on a w × h grid for drawing, on a log scale in [0, 1]. Drawing only:
 * these samples are not the algorithm's evaluations. */
export function landscapeField(l: Landscape, w = 64, h = 64): { w: number; h: number; values: Float32Array } {
  const raw = new Float32Array(w * h);
  let hi = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = l.x[0] + ((i + 0.5) / w) * (l.x[1] - l.x[0]);
      const y = l.y[0] + ((j + 0.5) / h) * (l.y[1] - l.y[0]);
      const v = Math.log1p(Math.max(0, l.f(x, y) - l.min));
      raw[j * w + i] = v;
      if (v > hi) hi = v;
    }
  }
  for (let k = 0; k < raw.length; k++) raw[k] = 1 - raw[k] / (hi || 1);
  return { w, h, values: raw };
}

/** A Gaussian stream whose mean moves by `shift` (in units of sd) at index `at`. */
export function stream(s: Sampler, n: number, at: number, shift: number, sd = 1): number[] {
  return Array.from({ length: n }, (_, i) => s.normal(i >= at ? shift * sd : 0, sd));
}

/** How steeply the true probability rises with an overconfident score, unless the kernel's own
 * control sets it: below 1, so the scores are more extreme than the truth. */
export const OVER_SLOPE = 0.55;

/** Scores of a miscalibrated classifier: the true probability is a monotone distortion of the
 * score, and each label is drawn from it. Yields as it goes, so a large set spreads over frames.
 * `slope` sets the overconfident truth only; the draws are the same at every value. */
export function* scoredSet(s: Sampler, n: number, distortion: string, slope = OVER_SLOPE): Generator<void, { score: number[]; label: number[]; truth: (x: number) => number }, void> {
  // over: scores more extreme than the truth; under: less extreme; skewed: scores too high
  const truth = distortion === 'under'
    ? (x: number) => 1 / (1 + Math.exp(-8 * (x - 0.5)))
    : distortion === 'skewed'
      ? (x: number) => x ** 2.2
      : (x: number) => 0.5 + slope * (x - 0.5);
  const score: number[] = [];
  const label: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = s.beta(1.3, 1.3);
    score.push(x);
    label.push(s.bernoulli(truth(x)) ? 1 : 0);
    if (i % 1000 === 999) yield;
  }
  return { score, label, truth };
}

export interface Task {
  name: string;
  /** Optimistic, most likely and pessimistic durations. */
  a: number;
  m: number;
  b: number;
  after: number[];
  /** Layer, for drawing. */
  layer: number;
}

/** A layered task network: every task after the first layer waits for one or two tasks of the
 * layer before it; tasks are listed in a topological order. */
export function taskNetwork(s: Sampler, layers = [2, 3, 3, 2]): Task[] {
  const tasks: Task[] = [];
  let prev: number[] = [];
  layers.forEach((width, layer) => {
    const here: number[] = [];
    for (let k = 0; k < width; k++) {
      const a = 2 + s.int(5);
      const m = a + 1 + s.int(5);
      const b = m + 2 + s.int(9);
      const after: number[] = [];
      if (prev.length) {
        after.push(prev[s.int(prev.length)]);
        if (prev.length > 1 && s.bernoulli(0.55)) {
          const other = prev[s.int(prev.length)];
          if (!after.includes(other)) after.push(other);
        }
      }
      here.push(tasks.length);
      tasks.push({ name: `T${tasks.length + 1}`, a, m, b, after, layer });
    }
    // every task of the previous layer feeds at least one task of this one
    for (const q of prev) if (!tasks.some((t) => t.after.includes(q))) tasks[here[s.int(here.length)]].after.push(q);
    prev = here;
  });
  return tasks;
}

export interface EvidenceItem {
  label: string;
  /** Log-likelihood ratio for the hypothesis (positive supports it). */
  llr: number;
  /** Standard deviation of the item's log-likelihood ratio. */
  sd: number;
  /** Probability the item holds up. */
  reliability: number;
}

/** The least reliability an evidence item may have, unless the kernel's own control sets it. */
export const MIN_RELIABILITY = 0.55;

/** k evidence items; each reliability is min(1, minRel + 0.4 · u), the same draw at every
 * minRel (at the default it never reaches 1, so the cap leaves the old set as it was). */
export function evidenceSet(s: Sampler, k: number, minRel = MIN_RELIABILITY): EvidenceItem[] {
  return Array.from({ length: k }, (_, i) => {
    const sign = s.bernoulli(0.7) ? 1 : -1;
    return {
      label: `E${i + 1}`,
      llr: sign * (0.2 + 1.3 * s.uniform()),
      sd: 0.15 + 0.6 * s.uniform(),
      reliability: Math.min(1, minRel + 0.4 * s.uniform()),
    };
  });
}

/** n agents with opinions uniform on [0, 1]. */
export function population(s: Sampler, n: number): number[] {
  return Array.from({ length: n }, () => s.uniform());
}
