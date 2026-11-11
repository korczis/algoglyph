import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { insertion, partition } from './_partition';

const CUTOFF = 10;

// The pivot is the median of the first, middle and last keys, which also places sentinels at
// both ends; subfiles below the cutoff are left for one final insertion sort.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const stack: [number, number][] = [[0, a.n - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop() as [number, number];
      if (hi - lo <= CUTOFF) continue;
      a.range(lo, hi);
      const mid = (lo + hi) >> 1;
      a.swap(mid, hi - 1);
      a.exch(lo, hi - 1);
      a.exch(lo, hi);
      a.exch(hi - 1, hi);
      const i = partition(a, lo + 1, hi - 1);
      stack.push([lo, i - 1], [i + 1, hi]);
    }
    a.range(0, a.n - 1);
    insertion(a, 0, a.n - 1);
  },
};
