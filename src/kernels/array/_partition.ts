import type { ArrayOps } from '../../engines/array/trace';

/** Partition a[lo..hi] around a[hi]; returns the pivot's final index. */
export function partition(a: ArrayOps, lo: number, hi: number): number {
  const v = a.get(hi);
  let i = lo - 1;
  let j = hi;
  for (;;) {
    while (a.less(a.get(++i), v));
    while (a.less(v, a.get(--j))) if (j === lo) break;
    if (i >= j) break;
    a.swap(i, j);
  }
  a.swap(i, hi);
  return i;
}

export function insertion(a: ArrayOps, lo: number, hi: number): void {
  for (let i = lo + 1; i <= hi; i++) {
    const v = a.get(i);
    let j = i;
    while (j > lo) {
      const u = a.get(j - 1);
      if (!a.less(v, u)) break;
      a.set(j, u);
      j--;
    }
    if (j !== i) a.set(j, v);
  }
}
