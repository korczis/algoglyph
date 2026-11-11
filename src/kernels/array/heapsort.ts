import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

function sink(a: ArrayOps, k: number, n: number): void {
  // 1-based heap positions over a[0..n-1]
  while (2 * k <= n) {
    let j = 2 * k;
    if (j < n && a.lessAt(j - 1, j)) j++;
    if (!a.lessAt(k - 1, j - 1)) break;
    a.swap(k - 1, j - 1);
    k = j;
  }
}

// Build a max-heap bottom-up in linear time, then repeatedly move the maximum to the end and
// restore the heap below it: n lg n in the worst case, in place, not stable.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    let n = a.n;
    a.range(0, n - 1);
    for (let k = n >> 1; k >= 1; k--) sink(a, k, n);
    while (n > 1) {
      a.swap(0, n - 1);
      n--;
      a.range(0, n - 1);
      sink(a, 1, n);
    }
  },
};
