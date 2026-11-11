import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Exchange adjacent keys out of order, pass after pass; stop after a pass with no exchange.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    for (let end = a.n - 1; end > 0; end--) {
      a.range(0, end);
      let swapped = false;
      for (let j = 0; j < end; j++) {
        if (a.lessAt(j + 1, j)) { a.swap(j, j + 1); swapped = true; }
      }
      if (!swapped) break;
    }
  },
};
