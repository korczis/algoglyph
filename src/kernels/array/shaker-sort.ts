import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Bubble sort in both directions, so small keys near the end ("turtles") travel fast too.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    let lo = 0;
    let hi = a.n - 1;
    while (lo < hi) {
      a.range(lo, hi);
      let last = lo;
      for (let j = lo; j < hi; j++) if (a.lessAt(j + 1, j)) { a.swap(j, j + 1); last = j; }
      hi = last;
      a.range(lo, hi);
      last = hi;
      for (let j = hi; j > lo; j--) if (a.lessAt(j, j - 1)) { a.swap(j - 1, j); last = j; }
      lo = last;
    }
  },
};
