// Bogobogosort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/bogobogosort.rs) through the tracer mirror. To sort a prefix of m keys it sorts the
// first m − 1 the same way, then checks the m-th; if that is smaller, it shuffles all m and
// starts again. Like the kernel it sorts the array itself and omits Morgan-Mar's final
// comparison with a copy of the original. The kernel gives up after KERNEL_SHUFFLES shuffles
// in all; the plate passes Infinity.
import { factorial } from '../_shared/theory/combinatorics';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

/** The kernel's limit (bogobogosort.rs MAX_SHUFFLES). */
export const KERNEL_SHUFFLES = 2_000;

export interface BbsState {
  shuffles: number;
  /** Shuffles of a prefix of length m, by m (index 0 and 1 stay 0). */
  level: number[];
  /** The prefix length whose last key was checked most recently. */
  prefix: number;
}

function* bbs(t: Tracer, a: Items, m: number, st: BbsState, max: number): Generator<void, boolean, void> {
  if (m <= 1) return true;
  for (;;) {
    if (!t.ok() || st.shuffles >= max) return false;
    if (!(yield* bbs(t, a, m - 1, st, max))) return false;
    st.prefix = m;
    const c = t.cmp(a, m - 2, m - 1);
    yield;
    if (c <= 0) return true;
    st.shuffles++;
    st.level[m]++;
    t.phase(`prefix of ${m}: last element too small, shuffle ${st.shuffles}`);
    for (let i = m - 1; i >= 1; i--) {
      t.swap(a, i, t.rng.range(0, i + 1));
      yield;
    }
  }
}

export function* bogobogosort(t: Tracer, a: Items, st: BbsState, max = Infinity): Algorithm {
  if (yield* bbs(t, a, a.key.length, st, max)) return 'sorted';
  t.phase('gave up: shuffle or step limit reached');
  return 'truncated';
}

/**
 * Expected shuffles from this input of distinct keys. A call on a prefix of m keys first sorts
 * the m − 1 before it, which never moves the m-th key, so it fails exactly when the m-th key is
 * smaller than one before it; after a failure the prefix is a uniform shuffle, the m-th key is
 * the largest with probability 1/m, and the expected cost T_m of a call on a uniform prefix
 * satisfies T_m = T_{m−1} + (1 − 1/m)(1 + T_m), so 1 + T_m = m!. Hence the sum over m of m! for
 * every prefix whose last key is not its largest: n! − 1 on average over random inputs, the same
 * shuffle count as bogosort.
 */
export function expectedShuffles(keys: readonly number[]): number {
  let e = 0;
  let max = -Infinity;
  for (let m = 1; m <= keys.length; m++) {
    if (m >= 2 && keys[m - 1] < max) e += factorial(m);
    max = Math.max(max, keys[m - 1]);
  }
  return e;
}

/**
 * The variance V_m of the shuffles of a call on a uniform prefix of m keys. The call costs
 * X_m = Y + B·(1 + X_m′): Y, the cost of sorting its first m − 1 keys, is X_{m−1}; B, a failed
 * check, is 1 with probability q = 1 − 1/m and independent of Y; X_m′ is a fresh call. With
 * E[1 + X_m] = m!, V_m = V_{m−1} + q(V_m + m!²) − q²·m!², so V_m = m·V_{m−1} + q·m!², V_1 = 0.
 */
export function callVariance(m: number): number {
  let v = 0;
  for (let j = 2; j <= m; j++) v = j * v + (1 - 1 / j) * factorial(j) ** 2;
  return v;
}

/**
 * The variance of the shuffles from this input of distinct keys: every prefix whose last key is
 * not its largest fails once, deterministically, and then costs a fresh call on a uniform prefix
 * (expectedShuffles), independently of the others; so the variances V_m of those prefixes add.
 */
export function shufflesVariance(keys: readonly number[]): number {
  let v = 0;
  let max = -Infinity;
  for (let m = 1; m <= keys.length; m++) {
    if (m >= 2 && keys[m - 1] < max) v += callVariance(m);
    max = Math.max(max, keys[m - 1]);
  }
  return v;
}

export interface BbsRun {
  keys: number[];
  stepper: Stepper;
  state: BbsState;
}

export function bbsRun(keys: readonly number[], seed: number, max = Infinity, maxSteps = Infinity): BbsRun {
  const a = items(keys);
  const t = new Tracer(seed, maxSteps);
  const state: BbsState = { shuffles: 0, level: new Array<number>(keys.length + 1).fill(0), prefix: 0 };
  return { keys: a.key, stepper: new Stepper(bogobogosort(t, a, state, max), t), state };
}
