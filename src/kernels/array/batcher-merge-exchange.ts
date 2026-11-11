import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Batcher's merge exchange (Knuth's Algorithm M): a fixed schedule of compare-exchanges that
// sorts any input of size n, so every comparator could run in parallel within a round.
export const kernel: ArrayKernel = {
  run(a: ArrayOps) {
    const n = a.n;
    if (n < 2) return;
    const t = Math.ceil(Math.log2(n));
    for (let p = 1 << (t - 1); p > 0; p >>= 1) {
      let q = 1 << (t - 1);
      let r = 0;
      let d = p;
      for (;;) {
        a.range(0, n - 1);
        for (let i = 0; i < n - d; i++) if ((i & p) === r) a.exch(i, i + d);
        if (q === p) break;
        d = q - p;
        q >>= 1;
        r = p;
      }
    }
  },
};
