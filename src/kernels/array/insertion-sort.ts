import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Insert each key into the sorted prefix, moving larger keys one place right (no sentinel).
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    for (let i = 1; i < a.n; i++) {
      a.range(0, i);
      const v = a.get(i);
      let j = i;
      while (j > 0) {
        const u = a.get(j - 1);
        if (!a.less(v, u)) break;
        a.set(j, u);
        j--;
      }
      if (j !== i) a.set(j, v);
    }
  },
};
