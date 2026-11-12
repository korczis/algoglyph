import type { ArrayKernel, ArrayOps } from '../../engines/array/trace';

// Batcher's odd-even merge written with perfect shuffles: unshuffle a block (even positions to
// its first half, odd to its second), merge both halves recursively, shuffle them back together
// and compare-exchange the neighbours (1,2), (3,4), ... A mergesort over this merge sorts.
//
// The network needs a power-of-two size N, so n keys are padded virtually to N with keys larger
// than any other. Padding is bookkeeping only: the array holds the n real keys in the order of
// their logical positions, a shuffle rewrites that order through the auxiliary array, and a
// compare-exchange that involves a pad needs no comparison (the pad is the larger key).
export const kernel: ArrayKernel = {
  // its trace grows as n lg² n words: 786k at n = 512 (3 MB), whose rebuild frame measured
  // 36.5 ms in the budget gate, against 197k words at n = 256
  maxN: 256,
  run(a: ArrayOps) {
    const n = a.n;
    if (n < 2) return;
    let N = 1;
    while (N < n) N *= 2;
    /** real[i]: logical position i holds a key (not a pad). Positions >= n start as pads. */
    const real = Array.from({ length: N }, (_, i) => i < n);
    /** The physical index of logical position i: the number of real keys before it. */
    const phys = (i: number) => {
      let c = 0;
      for (let j = 0; j < i; j++) if (real[j]) c++;
      return c;
    };

    /** Reorder logical [lo, lo + len) so that new position k takes old position from(k). */
    const permute = (lo: number, len: number, from: (k: number) => number) => {
      const p0 = phys(lo);
      const oldReal = real.slice(lo, lo + len);
      // the physical index, relative to p0, of each real key in the block
      const rank: number[] = [];
      let c = 0;
      for (let k = 0; k < len; k++) rank.push(oldReal[k] ? c++ : -1);
      if (c === 0) return;
      a.range(p0, p0 + c - 1);
      for (let k = 0; k < c; k++) a.setAux(p0 + k, a.get(p0 + k));
      let w = 0;
      for (let k = 0; k < len; k++) {
        const src = from(k);
        real[lo + k] = oldReal[src];
        if (oldReal[src]) a.set(p0 + w++, a.aux(p0 + rank[src]));
      }
    };
    const unshuffle = (lo: number, len: number) => {
      const h = len / 2;
      permute(lo, len, (k) => (k < h ? 2 * k : 2 * (k - h) + 1));
    };
    const shuffle = (lo: number, len: number) => {
      const h = len / 2;
      permute(lo, len, (k) => (k % 2 === 0 ? k / 2 : h + (k - 1) / 2));
    };
    /** Compare-exchange logical neighbours i and i + 1. */
    const cx = (i: number) => {
      if (real[i] && real[i + 1]) {
        const p = phys(i);
        a.exch(p, p + 1);
      } else if (!real[i] && real[i + 1]) {
        // a pad below a key: they trade places, and the array's order of keys is unchanged
        real[i] = true;
        real[i + 1] = false;
      }
    };

    /** Merge the sorted halves of logical [lo, lo + len), len a power of two. */
    const merge = (lo: number, len: number) => {
      if (len === 2) { cx(lo); return; }
      unshuffle(lo, len);
      merge(lo, len / 2);
      merge(lo + len / 2, len / 2);
      shuffle(lo, len);
      for (let i = lo + 1; i < lo + len - 1; i += 2) cx(i);
    };
    const sort = (lo: number, len: number) => {
      if (len < 2) return;
      sort(lo, len / 2);
      sort(lo + len / 2, len / 2);
      merge(lo, len);
    };
    sort(0, N);
  },
};
