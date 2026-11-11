import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Dijkstra's three-way partition: keys less than, equal to and greater than the pivot. Equal
// keys are never touched again, so many duplicates make it linear.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const stack: [number, number][] = [[0, a.n - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop() as [number, number];
      if (hi <= lo) continue;
      a.range(lo, hi);
      const v = a.get(lo);
      let lt = lo;
      let gt = hi;
      let i = lo + 1;
      while (i <= gt) {
        const x = a.get(i);
        if (a.less(x, v)) a.swap(lt++, i++);
        else if (a.less(v, x)) a.swap(i, gt--);
        else i++;
      }
      stack.push([lo, lt - 1], [gt + 1, hi]);
    }
  },
};
