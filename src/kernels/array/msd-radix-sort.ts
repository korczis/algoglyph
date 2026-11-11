import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

const BITS = 2;
const R = 1 << BITS;

function sort(a: ArrayOps, lo: number, hi: number, shift: number): void {
  if (hi <= lo || shift < 0) return;
  a.range(lo, hi);
  const count = new Array<number>(R + 1).fill(0);
  const keys: number[] = [];
  for (let i = lo; i <= hi; i++) { const k = a.get(i); keys.push(k); count[((k >> shift) & (R - 1)) + 1]++; }
  for (let r = 0; r < R; r++) count[r + 1] += count[r];
  const start = count.slice();
  for (const k of keys) a.setAux(lo + count[(k >> shift) & (R - 1)]++, k);
  for (let i = lo; i <= hi; i++) a.set(i, a.aux(i));
  for (let r = 0; r < R; r++) sort(a, lo + start[r], lo + start[r + 1] - 1, shift - BITS);
}

// Most-significant-digit first: distribute by the leading base-4 digit, then sort each bin
// on the next digit, recursively.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    let max = 0;
    for (let i = 0; i < a.n; i++) max = Math.max(max, a.get(i));
    let top = 0;
    while (max >> (top + BITS) > 0) top += BITS;
    sort(a, 0, a.n - 1, top);
  },
};
