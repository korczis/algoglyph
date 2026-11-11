import type { ArrayOps } from '../../engines/array/trace';

/** Merge sorted a[lo..mid] and a[mid+1..hi] through the auxiliary array (stable). */
export function merge(a: ArrayOps, lo: number, mid: number, hi: number): void {
  a.range(lo, hi);
  for (let k = lo; k <= hi; k++) a.setAux(k, a.get(k));
  let i = lo;
  let j = mid + 1;
  for (let k = lo; k <= hi; k++) {
    if (i > mid) a.set(k, a.aux(j++));
    else if (j > hi) a.set(k, a.aux(i++));
    else {
      const x = a.aux(i);
      const y = a.aux(j);
      if (a.less(y, x)) { a.set(k, y); j++; } else { a.set(k, x); i++; }
    }
  }
}
