import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { merge } from './_merge';

// Merge runs of 1, then 2, 4, 8, ... across the whole array: no recursion at all.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    for (let w = 1; w < a.n; w *= 2) {
      for (let lo = 0; lo < a.n - w; lo += 2 * w) merge(a, lo, lo + w - 1, Math.min(lo + 2 * w - 1, a.n - 1));
    }
  },
};
