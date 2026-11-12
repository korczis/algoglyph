// Bozosort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/bozosort.rs) through the tracer mirror. Both positions are drawn independently, so
// a swap of a position with itself is possible and counted, as the kernel counts it. The plate
// also offers the one-line repair the catalogue entry describes: swap the pair only when it is
// an inversion. The expected swaps of the kernel's walk are computed exactly from its Markov
// chain on cycle types (bozoChain), never from a run, and so is their variance (swapsVariance).
import { cycleType, partitions, solve } from '../_shared/theory/combinatorics';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';
import { isSorted } from '../_shared/sort-input/input';

/** The kernel's limit (bozosort.rs MAX_ATTEMPTS). */
export const KERNEL_ATTEMPTS = 100_000;

export type Rule = 'any' | 'inversion';

export interface BozoState {
  swaps: number;
  /** Random pairs drawn. */
  picks: number;
  /** Inversions of the array now, and how the swaps changed them. */
  inversions: number;
  better: number;
  worse: number;
  idle: number;
  /** Inversions after every `every`-th swap of this run (halved when it outgrows WALK_MAX). */
  walk: number[];
  every: number;
}

/** Inversions of a[0..n): pairs i < j with a[i] > a[j] (n is small: brute force is exact). */
export function countInversions(a: ArrayLike<number>): number {
  let inv = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++;
  return inv;
}

/** The change in inversions a swap of positions i < j would make (O(j - i)). */
function swapDelta(a: number[], i: number, j: number): number {
  if (i === j) return 0;
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const x = a[lo];
  const y = a[hi];
  let d = x > y ? -1 : x < y ? 1 : 0;
  for (let k = lo + 1; k < hi; k++) {
    const v = a[k];
    d += (v < x ? -1 : 0) + (v > x ? 1 : 0) + (v > y ? -1 : 0) + (v < y ? 1 : 0);
  }
  return d;
}

const WALK_MAX = 4096;

export function* bozosort(t: Tracer, a: Items, st: BozoState, rule: Rule = 'any',
  maxAttempts = Infinity): Algorithm {
  const n = a.key.length;
  for (let k = 0; k < maxAttempts; k++) {
    if (!t.ok()) return 'truncated';
    // the sortedness test, inlined: a generator per attempt would cost more than the attempt
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
    const i = t.rng.range(0, n);
    const j = t.rng.range(0, n);
    st.picks++;
    if (rule === 'inversion') {
      if (i === j) continue;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      const c = t.cmp(a, lo, hi);
      yield;
      if (c <= 0) continue;
      record(st, a, lo, hi);
      t.swap(a, lo, hi);
    } else {
      record(st, a, i, j);
      t.swap(a, i, j);
    }
    yield;
  }
  let sorted = true;
  for (let i = 1; i < n && sorted; i++) {
    sorted = t.cmp(a, i - 1, i) <= 0;
    yield;
  }
  if (sorted) return 'sorted';
  t.phase('gave up after 100 000 random swaps');
  return 'truncated';
}

function record(st: BozoState, a: Items, i: number, j: number): void {
  const d = swapDelta(a.key, i, j);
  st.swaps++;
  st.inversions += d;
  if (d < 0) st.better++;
  else if (d > 0) st.worse++;
  else st.idle++;
  if (st.swaps % st.every === 0) {
    st.walk.push(st.inversions);
    if (st.walk.length > WALK_MAX) {
      st.walk = st.walk.filter((_, k) => k % 2 === 0);
      st.every *= 2;
    }
  }
}

export function newState(keys: readonly number[]): BozoState {
  const inv = countInversions(keys);
  return { swaps: 0, picks: 0, inversions: inv, better: 0, worse: 0, idle: 0, walk: [inv], every: 1 };
}

const chains = new Map<number, Map<string, number>>();
const seconds = new Map<number, Map<string, number>>();

/**
 * The walk's linear system over the partitions of n: row r of A is I − P at state r (the
 * identity row is the identity, its hitting time 0), and the right-hand side is rhs(state)
 * elsewhere. Each step swaps positions i, j drawn independently and uniformly, so with
 * probability 1/n nothing moves, a cycle of length L splits into d and L − d with probability
 * L/n² for each d, and two cycles of lengths a and b merge with probability 2ab/n².
 */
function walkSystem(n: number, rhs: (state: string) => number): Map<string, number> {
  const states = partitions(n).map((p) => p.join(','));
  const index = new Map(states.map((s, i) => [s, i]));
  const key = (parts: number[]) => [...parts].sort((x, y) => y - x).join(',');
  const N = states.length;
  const A = states.map(() => new Array<number>(N).fill(0));
  const b = new Array<number>(N).fill(0);
  const identity = index.get(key(new Array<number>(n).fill(1)))!;
  const n2 = n * n;
  states.forEach((s, r) => {
    A[r][r] = 1;
    if (r === identity) return;
    b[r] = rhs(s);
    const parts = s.split(',').map(Number);
    const add = (to: number[], pr: number) => { A[r][index.get(key(to))!] -= pr; };
    add(parts, 1 / n);
    parts.forEach((L, c) => {
      for (let d = 1; d < L; d++) add([...parts.slice(0, c), ...parts.slice(c + 1), d, L - d], L / n2);
      for (let e = c + 1; e < parts.length; e++) {
        const rest = parts.filter((_, x) => x !== c && x !== e);
        add([...rest, L + parts[e]], (2 * L * parts[e]) / n2);
      }
    });
  });
  const h = solve(A, b);
  return new Map(states.map((s, i) => [s, h[i]]));
}

/**
 * Expected swaps until sorted, by cycle type of the sorting permutation, for the kernel's walk
 * on n distinct keys: the hitting times of the identity solve h = 1 + P h (walkSystem).
 */
export function bozoChain(n: number): Map<string, number> {
  const cached = chains.get(n);
  if (cached) return cached;
  const out = walkSystem(n, () => 1);
  chains.set(n, out);
  return out;
}

/**
 * The second moment of those hitting times: T = 1 + T' after one step, so E[T²] = 1 + 2E[T'] +
 * E[T'²], and with E[T'] = h − 1 the second moments solve m = 2h − 1 + P m (walkSystem).
 */
export function bozoSecondMoment(n: number): Map<string, number> {
  const cached = seconds.get(n);
  if (cached) return cached;
  const h = bozoChain(n);
  const out = walkSystem(n, (s) => 2 * h.get(s)! - 1);
  seconds.set(n, out);
  return out;
}

/** Expected swaps of the kernel's walk from this input of distinct keys. */
export function expectedSwaps(keys: readonly number[]): number {
  if (isSorted(keys)) return 0;
  return bozoChain(keys.length).get(cycleType(keys).join(','))!;
}

/** The variance of the walk's swaps from this input of distinct keys: E[T²] − E[T]². */
export function swapsVariance(keys: readonly number[]): number {
  if (isSorted(keys)) return 0;
  const type = cycleType(keys).join(',');
  return bozoSecondMoment(keys.length).get(type)! - bozoChain(keys.length).get(type)! ** 2;
}

export interface BozoRun {
  keys: number[];
  stepper: Stepper;
  state: BozoState;
}

export function bozoRun(keys: readonly number[], seed: number, rule: Rule = 'any',
  maxAttempts = Infinity, maxSteps = Infinity): BozoRun {
  const a = items(keys);
  const t = new Tracer(seed, maxSteps);
  const state = newState(keys);
  return { keys: a.key, stepper: new Stepper(bozosort(t, a, state, rule, maxAttempts), t), state };
}
