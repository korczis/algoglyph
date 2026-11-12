// Stalin sort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/sorting/
// algorithms/stalin_sort.rs) through the tracer mirror. One pass keeps every key that is not
// smaller than the last one kept, compacting the survivors to the front with a read and a write;
// the rest are eliminated. The output is the kept prefix: sorted, and in general shorter.
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

export interface StalinState {
  /** Survivors so far (the length of the compacted front). */
  kept: number;
  /** The input position being judged next. */
  at: number;
  /** For each input position: 1 kept, −1 eliminated, 0 not judged yet. */
  fate: Int8Array;
}

export function* stalinSort(t: Tracer, a: Items, st: StalinState): Algorithm {
  const n = a.key.length;
  if (n < 2) {
    st.kept = n;
    st.at = n;
    st.fate.fill(1);
    return 'sorted';
  }
  t.phase('keep each element that is not smaller than the last one kept');
  st.kept = 1;
  st.fate[0] = 1;
  for (let i = 1; i < n; i++) {
    st.at = i;
    const c = t.cmp(a, i, st.kept - 1);
    yield;
    if (c >= 0) {
      if (i !== st.kept) {
        t.read(i);
        t.set(a, st.kept, a.key[i], a.tag[i]);
        yield;
      }
      st.kept++;
      st.fate[i] = 1;
    } else {
      t.mark(i, i + 1, 'eliminated');
      st.fate[i] = -1;
    }
  }
  st.at = n;
  if (st.kept === n) return 'sorted';
  t.phase(`${n - st.kept} of ${n} elements eliminated`);
  return 'not-a-sort';
}

export interface StalinRun {
  input: number[];
  a: Items;
  stepper: Stepper;
  state: StalinState;
}

export function stalinRun(keys: readonly number[], seed = 0, maxSteps = Infinity): StalinRun {
  const a = items(keys);
  const t = new Tracer(seed, maxSteps);
  const state: StalinState = { kept: 0, at: 0, fate: new Int8Array(keys.length) };
  return { input: keys.slice(), a, stepper: new Stepper(stalinSort(t, a, state), t), state };
}

/** The survivors: the kept prefix of the array once the run has ended. */
export function survivors(r: StalinRun): number[] {
  return r.a.key.slice(0, r.state.kept);
}

/** Whether s occurs in order inside a (each element used once). */
export function isSubsequence(s: readonly number[], a: readonly number[]): boolean {
  let j = 0;
  for (let i = 0; i < a.length && j < s.length; i++) if (a[i] === s[j]) j++;
  return j === s.length;
}
