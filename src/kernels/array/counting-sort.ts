import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Key-indexed counting: count each key, turn counts into start positions, distribute into the
// auxiliary array, copy back. No comparisons; stable. The count table is not drawn.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const keys: number[] = [];
    let max = 0;
    for (let i = 0; i < a.n; i++) { keys.push(a.get(i)); max = Math.max(max, keys[i]); }
    const count = new Array<number>(max + 2).fill(0);
    for (const k of keys) count[k + 1]++;
    for (let r = 0; r <= max; r++) count[r + 1] += count[r];
    for (let i = 0; i < a.n; i++) a.setAux(count[keys[i]]++, keys[i]);
    for (let i = 0; i < a.n; i++) a.set(i, a.aux(i));
  },
};
