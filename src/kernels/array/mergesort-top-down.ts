import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';
import { merge } from './_merge';

function sort(a: ArrayOps, lo: number, hi: number): void {
  if (hi <= lo) return;
  const mid = (lo + hi) >> 1;
  sort(a, lo, mid);
  sort(a, mid + 1, hi);
  merge(a, lo, mid, hi);
}

// Sort each half recursively, then merge them: n lg n compares at most, stable.
export const kernel: ArrayKernel = { run(a: ArrayOps) { sort(a, 0, a.n - 1); } };
