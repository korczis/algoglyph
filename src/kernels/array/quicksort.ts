import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { partition } from './_partition';

// Partition around the rightmost key, then sort both sides; the smaller side first keeps the
// stack logarithmic.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const stack: [number, number][] = [[0, a.n - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop() as [number, number];
      if (hi <= lo) continue;
      a.range(lo, hi);
      const i = partition(a, lo, hi);
      const left: [number, number] = [lo, i - 1];
      const right: [number, number] = [i + 1, hi];
      if (i - lo > hi - i) stack.push(left, right);
      else stack.push(right, left);
    }
  },
};
