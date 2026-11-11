import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { shellsort } from './_shell';

// Increments 1, 4, 13, 40, ... (h = 3h + 1), the sequence Knuth recommends.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const hs: number[] = [];
    for (let h = 1; h < a.n; h = 3 * h + 1) hs.unshift(h);
    shellsort(a, hs.length ? hs : [1]);
  },
};
