import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { shellsort } from './_shell';

// Increments 1, 8, 23, 77, 281, ... = 4^k + 3·2^(k-1) + 1, with O(n^(4/3)) worst case.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const hs = [1];
    for (let k = 1; ; k++) {
      const h = 4 ** k + 3 * 2 ** (k - 1) + 1;
      if (h >= a.n) break;
      hs.unshift(h);
    }
    shellsort(a, hs);
  },
};
