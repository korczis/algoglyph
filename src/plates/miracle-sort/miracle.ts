// Miracle sort's check, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/
// sorting/algorithms/miracle_sort.rs) through the tracer mirror. The kernel checks once; the
// plate repeats the same check after every wait, which is all miracle sort ever does.
import { Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

export interface CheckState {
  /** Position of the first descent the last check found (−1: none, sorted). */
  descent: number;
}

export function* miracleCheck(t: Tracer, a: Items, st: CheckState): Algorithm {
  t.phase('check whether a miracle has already happened');
  const n = a.key.length;
  st.descent = -1;
  for (let i = 1; i < n; i++) {
    const c = t.cmp(a, i - 1, i);
    yield;
    if (c > 0) {
      st.descent = i;
      t.phase('not sorted: waiting for a miracle');
      return 'not-a-sort';
    }
  }
  return 'sorted';
}
