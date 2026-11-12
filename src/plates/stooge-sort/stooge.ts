// Stooge sort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/stooge_sort.rs) through the tracer mirror, with its recursion on an explicit stack
// so that a frame can stop after any comparison. The calls run in the kernel's order, so the
// operations, the step clock and the outcome at a step limit are the kernel's.
import type { CallState, ScalingRun } from '../_shared/scaling-plate/scaling-plate';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

export function* stoogeSort(t: Tracer, a: Items, c: CallState): Algorithm {
  const n = a.key.length;
  if (n < 2) return 'sorted';
  const stack = c.pending;
  stack.push(0, n - 1, 0);
  while (stack.length) {
    const d = stack.pop()!;
    const j = stack.pop()!;
    const i = stack.pop()!;
    if (!t.ok()) return 'truncated';
    c.i = i;
    c.j = j;
    c.depth = d;
    if (d > c.maxDepth) c.maxDepth = d;
    const r = t.cmp(a, i, j);
    yield;
    if (r > 0) {
      t.swap(a, i, j);
      yield;
    }
    if (j - i + 1 >= 3) {
      const third = Math.floor((j - i + 1) / 3);
      t.mark(i, j + 1, 'stooge');
      // first two thirds, last two thirds, first two thirds again: pushed in reverse
      stack.push(i, j - third, d + 1, i + third, j, d + 1, i, j - third, d + 1);
    }
  }
  c.i = 0;
  c.j = -1;
  return 'sorted';
}

/** Exact comparisons on n ≥ 2 keys: one per call, and three calls on n − ⌊n/3⌋ keys from 3 up. */
export function stoogeComparisons(n: number): number {
  if (n < 2) return 0;
  if (n < 3) return 1;
  return 1 + 3 * stoogeComparisons(n - Math.floor(n / 3));
}

/** The master theorem's exponent of T(n) = 3T(2n/3) + Θ(1). */
export const STOOGE_EXPONENT = Math.log(3) / Math.log(1.5);

export function stoogeRun(keys: readonly number[], seed = 0, maxSteps = Infinity): ScalingRun {
  const a = items(keys);
  const t = new Tracer(seed, maxSteps);
  const calls: CallState = { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] };
  return { keys: a.key, stepper: new Stepper(stoogeSort(t, a, calls), t), calls };
}
