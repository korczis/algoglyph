import type { ArrayOps } from '../../engines/array/trace';

/** h-sorting by insertion for each increment of the sequence, largest first. */
export function shellsort(a: ArrayOps, increments: number[]): void {
  for (const h of increments) {
    if (h >= a.n) continue;
    a.range(0, a.n - 1);
    for (let i = h; i < a.n; i++) {
      const v = a.get(i);
      let j = i;
      while (j >= h) {
        const u = a.get(j - h);
        if (!a.less(v, u)) break;
        a.set(j, u);
        j -= h;
      }
      if (j !== i) a.set(j, v);
    }
  }
}
