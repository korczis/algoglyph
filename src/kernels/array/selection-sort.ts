import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Find the smallest remaining key and exchange it into place: n²/2 compares, n exchanges.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    for (let i = 0; i < a.n - 1; i++) {
      a.range(i, a.n - 1);
      let min = i;
      for (let j = i + 1; j < a.n; j++) if (a.lessAt(j, min)) min = j;
      if (min !== i) a.swap(i, min);
    }
  },
};
