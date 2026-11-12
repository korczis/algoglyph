// Worstsort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/worstsort.rs) through the tracer mirror. badsort(L, 0) is bubble sort; badsort(L, k)
// lists every permutation of L (in lexicographic order of positions, the identity first), sorts
// that list with badsort(., k − 1), comparing lists lexicographically down to single keys, and
// returns its first element. The kernel uses f(n) = 2 levels for n ≤ 2 and 1 for 3 ≤ n ≤ 5 and
// refuses n > 5; the plate may also ask for another number of levels where it stays feasible.
import { factorial } from '../_shared/theory/combinatorics';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

export interface Leaf {
  key: number;
  tag: number;
}
export type Val = Leaf | Val[];

/** The kernel's limit (worstsort.rs MAX_N). */
export const KERNEL_MAX_N = 5;
/** The longest list the plate will bubble-sort (n = 3 at two levels: 6! = 720). */
export const MAX_ITEMS = 720;

export interface WorstState {
  /** Levels in use, the list being bubble-sorted and where the bubble stands. */
  levels: number;
  list: Val[] | null;
  /** The list as the bubble sort received it (the list itself is sorted in place). */
  initial: Val[] | null;
  pass: number;
  at: number;
  lex: number;
  swaps: number;
  /** Lexicographic comparisons and swaps when each pass began, and once more at the end. */
  passLex: number[];
  passSwaps: number[];
}

/** The kernel's choice of levels for n keys. */
export function kernelLevels(n: number): number {
  return n <= 2 ? 2 : 1;
}

/** Items the bubble sort at level 0 handles: n, then n!, (n!)!, … one factorial per level. */
export function bubbleItems(n: number, levels: number): number {
  let m = n;
  for (let k = 0; k < levels; k++) m = m > 18 ? Infinity : factorial(m);
  return m;
}

function* lex(t: Tracer, a: Val, b: Val): Generator<void, number, void> {
  const la = Array.isArray(a);
  const lb = Array.isArray(b);
  if (!la && !lb) {
    const c = t.cmpKeys((a as Leaf).key, (b as Leaf).key);
    yield;
    return c;
  }
  if (la && lb) {
    const x = a as Val[];
    const y = b as Val[];
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const o = yield* lex(t, x[i], y[i]);
      if (o !== 0) return o;
    }
    return Math.sign(x.length - y.length);
  }
  return la ? 1 : -1;
}

function* bubble(t: Tracer, a: Val[], st: WorstState): Generator<void, Val[] | null, void> {
  const n = a.length;
  st.list = a;
  st.initial = a.slice();
  for (let pass = 0; pass < n; pass++) {
    if (!t.ok()) return null;
    st.pass = pass;
    st.passLex.push(st.lex);
    st.passSwaps.push(st.swaps);
    let swapped = false;
    for (let i = 0; i < Math.max(0, n - 1 - pass); i++) {
      st.at = i;
      st.lex++;
      if ((yield* lex(t, a[i], a[i + 1])) > 0) {
        const x = a[i];
        a[i] = a[i + 1];
        a[i + 1] = x;
        st.swaps++;
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  st.passLex.push(st.lex);
  st.passSwaps.push(st.swaps);
  st.at = -1;
  return a;
}

/** All permutations of `list`, in lexicographic order of positions (the identity first). */
export function permutations<T>(list: readonly T[]): T[][] {
  const n = list.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const out: T[][] = [];
  for (;;) {
    out.push(idx.map((i) => list[i]));
    let i = n - 1;
    while (i > 0 && idx[i - 1] >= idx[i]) i--;
    if (i <= 0) break;
    let j = n - 1;
    while (idx[j] <= idx[i - 1]) j--;
    [idx[i - 1], idx[j]] = [idx[j], idx[i - 1]];
    for (let l = i, r = n - 1; l < r; l++, r--) [idx[l], idx[r]] = [idx[r], idx[l]];
  }
  return out;
}

function* badsort(t: Tracer, list: Val[], k: number, st: WorstState): Generator<void, Val[] | null, void> {
  if (k === 0) return yield* bubble(t, list, st);
  t.phase(`badsort level ${k}: all ${factorial(list.length)} permutations`);
  const sorted = yield* badsort(t, permutations(list), k - 1, st);
  if (!sorted) return null;
  const first = sorted[0];
  return Array.isArray(first) ? first : [];
}

/** `levels` undefined: the kernel's f(n) and its refusal past n = 5. */
export function* worstsort(t: Tracer, a: Items, st: WorstState, levels?: number): Algorithm {
  const n = a.key.length;
  if (n < 2) return 'sorted';
  if (levels === undefined && n > KERNEL_MAX_N) {
    t.phase('worstsort beyond n = 5 is infeasible: not started');
    return 'truncated';
  }
  const k = levels ?? kernelLevels(n);
  st.levels = k;
  const list: Val[] = [];
  for (let i = 0; i < n; i++) {
    t.read(i);
    list.push({ key: a.key[i], tag: a.tag[i] });
    yield;
  }
  t.phase(`worstsort = badsort(L, f(n) = ${k})`);
  const sorted = yield* badsort(t, list, k, st);
  if (!sorted) return 'truncated';
  for (let i = 0; i < sorted.length; i++) {
    const x = sorted[i] as Leaf;
    t.set(a, i, x.key, x.tag);
    yield;
  }
  return 'sorted';
}

/** The keys of an item of the bubbled list, in reading order. */
export function leaves(v: Val, out: number[] = []): number[] {
  if (Array.isArray(v)) for (const x of v) leaves(x, out);
  else out.push(v.key);
  return out;
}

/**
 * What the bubble sort of `list` must do, from the list alone: its swaps are the list's
 * inversions, and it runs one pass more than the most larger items standing before any item
 * (each pass moves an item at most one place forward), so its lexicographic comparisons are
 * (N − 1) + (N − 2) + … over those passes. Lists compare as their flattened keys (every item has
 * the same shape).
 */
export function bubbleCost(list: readonly Val[]): { inversions: number; passes: number; lex: number[] } {
  const flat = list.map((v) => leaves(v));
  const cmp = (x: number[], y: number[]) => {
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const N = flat.length;
  let inversions = 0;
  let most = 0;
  for (let j = 0; j < N; j++) {
    let before = 0;
    for (let i = 0; i < j; i++) if (cmp(flat[i], flat[j]) > 0) before++;
    inversions += before;
    most = Math.max(most, before);
  }
  const passes = Math.min(N, most + 1);
  const lex = [0];
  for (let p = 0; p < passes; p++) lex.push(lex[p] + Math.max(0, N - 1 - p));
  return { inversions, passes, lex };
}

export interface WorstRun {
  keys: number[];
  stepper: Stepper;
  state: WorstState;
}

export function worstRun(keys: readonly number[], levels?: number, maxSteps = Infinity): WorstRun {
  const a = items(keys);
  const t = new Tracer(0, maxSteps);
  const state: WorstState = { levels: levels ?? kernelLevels(keys.length), list: null, initial: null, pass: 0, at: -1, lex: 0, swaps: 0,
    passLex: [], passSwaps: [] };
  return { keys: a.key, stepper: new Stepper(worstsort(t, a, state, levels), t), state };
}
