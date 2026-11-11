import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

const BITS = 2;
const R = 1 << BITS;

// Least-significant-digit first: one stable key-indexed counting pass per base-4 digit.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    let max = 0;
    for (let i = 0; i < a.n; i++) max = Math.max(max, a.get(i));
    for (let shift = 0; max >> shift > 0; shift += BITS) {
      a.range(0, a.n - 1);
      const count = new Array<number>(R + 1).fill(0);
      const keys: number[] = [];
      for (let i = 0; i < a.n; i++) { keys.push(a.get(i)); count[((keys[i] >> shift) & (R - 1)) + 1]++; }
      for (let r = 0; r < R; r++) count[r + 1] += count[r];
      for (const k of keys) a.setAux(count[(k >> shift) & (R - 1)]++, k);
      for (let i = 0; i < a.n; i++) a.set(i, a.aux(i));
    }
  },
};
