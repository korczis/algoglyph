// Slowsort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/slowsort.rs) through the tracer mirror, its recursion on an explicit stack of two
// kinds of task, a call on [i, j] and the compare-and-swap of a call's two maxima, pushed in
// reverse so that they run in the kernel's order.
import type { CallState, ScalingRun } from '../_shared/scaling-plate/scaling-plate';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

/** A compare-and-swap task carries depth −1 − d, so it is never drawn as a waiting call. */
export function* slowsort(t: Tracer, a: Items, c: CallState): Algorithm {
  const n = a.key.length;
  if (n < 2) return 'sorted';
  const stack = c.pending;
  stack.push(0, n - 1, 0);
  while (stack.length) {
    const d = stack.pop()!;
    const j = stack.pop()!;
    const i = stack.pop()!;
    if (d < 0) {
      // the larger of the two halves' maxima goes to the end: positions j and m = i here
      const r = t.cmp(a, j, i);
      yield;
      if (r < 0) {
        t.swap(a, j, i);
        yield;
      }
      continue;
    }
    if (i >= j) continue;
    if (!t.ok()) return 'truncated';
    c.i = i;
    c.j = j;
    c.depth = d;
    if (d > c.maxDepth) c.maxDepth = d;
    const m = i + Math.floor((j - i) / 2);
    // slow(i, m), slow(m + 1, j), compare-and-swap (j, m), slow(i, j − 1): pushed in reverse
    stack.push(i, j - 1, d + 1, m, j, -1 - d, m + 1, j, d + 1, i, m, d + 1);
  }
  c.i = 0;
  c.j = -1;
  return 'sorted';
}

const memo = [0, 0];

/**
 * Exact comparisons on n keys: C(n) = C(⌈n/2⌉) + C(⌊n/2⌋) + 1 + C(n − 1), C(0) = C(1) = 0
 * (Broder and Stolfi's T(n) = 2T(n/2) + T(n − 1) + 1 with the kernel's rounding of the halves).
 */
export function slowComparisons(n: number): number {
  for (let k = memo.length; k <= n; k++) {
    memo.push(memo[Math.ceil(k / 2)] + memo[Math.floor(k / 2)] + 1 + memo[k - 1]);
  }
  return memo[Math.max(0, n)];
}

export function slowRun(keys: readonly number[], seed = 0, maxSteps = Infinity): ScalingRun {
  const a = items(keys);
  const t = new Tracer(seed, maxSteps);
  const calls: CallState = { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] };
  return { keys: a.key, stepper: new Stepper(slowsort(t, a, calls), t), calls };
}
