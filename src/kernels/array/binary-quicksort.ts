import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

function sort(a: ArrayOps, lo: number, hi: number, bit: number): void {
  if (hi <= lo || bit < 0) return;
  a.range(lo, hi);
  let i = lo;
  let j = hi;
  while (i <= j) {
    while (i <= j && ((a.get(i) >> bit) & 1) === 0) i++;
    while (i <= j && ((a.get(j) >> bit) & 1) === 1) j--;
    if (i < j) a.swap(i++, j--);
  }
  sort(a, lo, j, bit - 1);
  sort(a, i, hi, bit - 1);
}

// Radix exchange: partition on the leading bit like quicksort partitions on a pivot, then
// recurse on the next bit. No key comparisons at all.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    let max = 0;
    for (let i = 0; i < a.n; i++) max = Math.max(max, a.get(i));
    sort(a, 0, a.n - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, max)))));
  },
};
