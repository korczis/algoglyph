import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { merge } from './_merge';

// Merge the ascending runs the input already has: linear on sorted input, n lg n at worst.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    for (;;) {
      let merged = false;
      let lo = 0;
      while (lo < a.n) {
        let mid = lo;
        while (mid + 1 < a.n && !a.lessAt(mid + 1, mid)) mid++;
        if (mid + 1 >= a.n) break;
        let hi = mid + 1;
        while (hi + 1 < a.n && !a.lessAt(hi + 1, hi)) hi++;
        merge(a, lo, mid, hi);
        merged = true;
        lo = hi + 1;
      }
      if (!merged) return;
    }
  },
};
