import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Insertion sort that finds the insertion point by binary search: n log n compares, the same
// quadratic number of moves.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    for (let i = 1; i < a.n; i++) {
      a.range(0, i);
      const v = a.get(i);
      let lo = 0;
      let hi = i;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (a.less(v, a.get(mid))) hi = mid;
        else lo = mid + 1;
      }
      for (let j = i; j > lo; j--) a.set(j, a.get(j - 1));
      if (lo !== i) a.set(lo, v);
    }
  },
};
