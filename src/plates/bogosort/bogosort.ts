// Bogosort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/bogosort.rs) through the tracer mirror, with the same seeded Fisher-Yates shuffle,
// so for one seed and input it ends with the kernel's output, outcome and counts
// (test/plate-bogosort.test.ts). The kernel gives up after KERNEL_ATTEMPTS shuffles; the plate
// passes Infinity, so each of its runs ends sorted.
import { arrangements } from '../_shared/theory/combinatorics';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';
import { isSorted } from '../_shared/sort-input/input';

/** The kernel's limit (bogosort.rs MAX_ATTEMPTS). */
export const KERNEL_ATTEMPTS = 10_000;

export interface BogoState {
  shuffles: number;
}

export function* bogosort(t: Tracer, a: Items, st: BogoState, maxAttempts = Infinity): Algorithm {
  const n = a.key.length;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    if (!t.ok()) return 'truncated';
    let sorted = true;
    for (let i = 1; i < n; i++) {
      const c = t.cmp(a, i - 1, i);
      yield;
      if (c > 0) {
        sorted = false;
        break;
      }
    }
    if (sorted) return 'sorted';
    if (attempt === maxAttempts) break;
    t.phase(`shuffle ${attempt + 1}`);
    st.shuffles++;
    for (let i = n - 1; i >= 1; i--) {
      t.swap(a, i, t.rng.range(0, i + 1));
      yield;
    }
  }
  t.phase('gave up after 10 000 shuffles');
  return 'truncated';
}

/**
 * Expected shuffles on this input: none when it is sorted, otherwise the mean of a geometric
 * distribution whose success probability is the share of arrangements that are sorted,
 * Π m_i! / n! for key multiplicities m_i (1/n! for distinct keys).
 */
export function expectedShuffles(keys: readonly number[]): number {
  return isSorted(keys) ? 0 : arrangements(keys);
}

/** The variance of that geometric count: (1 − p)/p² with p = 1/arrangements, 0 when sorted. */
export function shufflesVariance(keys: readonly number[]): number {
  if (isSorted(keys)) return 0;
  const m = arrangements(keys);
  return m * (m - 1);
}

export interface BogoRun {
  keys: number[];
  stepper: Stepper;
  state: BogoState;
}

export function bogoRun(keys: readonly number[], seed: number, maxAttempts = Infinity, maxSteps = Infinity): BogoRun {
  const a = items(keys);
  const t = new Tracer(seed, maxSteps);
  const state: BogoState = { shuffles: 0 };
  return { keys: a.key, stepper: new Stepper(bogosort(t, a, state, maxAttempts), t), state };
}
