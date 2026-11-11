import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { partition } from './_partition';

// Partition, then continue only in the side that holds rank k: linear on average.
export const kernel: ArrayKernel = {
  goal: 'select',
  run(a: ArrayOps, k: number) {
    let lo = 0;
    let hi = a.n - 1;
    while (hi > lo) {
      a.range(lo, hi);
      const i = partition(a, lo, hi);
      if (i === k) return;
      if (i < k) lo = i + 1;
      else hi = i - 1;
    }
  },
};
