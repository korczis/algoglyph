// Every exact count and every hard inequality the hybrid shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a shift or a copy one), Auxiliary writes (every cell of the drawn strip that changes)
// and the Phase readout. Every kernel of the shelf is a wasm kernel, played as its sidecar
// record maps it (src/kernels/sorting-wasm) and replayed through the same engine.
// A switch point is shown where it is measured: the size below which a kernel only runs its
// insertion sort, the depth at which introsort hands a subarray to heapsort (counted by the phase
// it enters), the bucket count at which wolfsort distributes. A worst case that depends on the
// pivot rule is shown on an input built against the rule while the kernel runs (McIlroy's
// adversary). The wasm kernels cannot be steered while they run, so the adversary plays a
// TypeScript replica of their comparisons (checked here to compare exactly as the kernel does)
// and the input it builds is then counted on the wasm kernel itself.
// Asymptotic bounds (~, O, the cited averages) are not checked here; that every kernel sorts
// every shape and size is test/kernels-sorting-wasm.test.ts ("leaves every input shape and size
// sorted, as an independent reference does").
import { describe, expect, it } from 'vitest';
import { input, inversions, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const IDS = ['introsort', 'quickxsort', 'ford-johnson', 'fluxsort', 'crumsort', 'wolfsort', 'weavesort', 'blitsort', 'octosort'];
const K: Record<string, ArrayKernel> = Object.fromEntries(await Promise.all(IDS.map(async (id) => [id, await sidecarKernel(id)] as const)));
const S = await loadSorting();

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) => p.map((_, i) => i).concat(p.length)
    .map((i) => [...p.slice(0, i), n, ...p.slice(i)]));
}
/** Every word of length n over the keys 1..3: ties in every arrangement. */
function words(n: number): number[][] {
  return Array.from({ length: 3 ** n }, (_, x) => Array.from({ length: n }, (_, i) => 1 + (Math.floor(x / 3 ** i) % 3)));
}
/**
 * The inputs every inequality is checked on: all permutations and all three-key words up to six
 * keys, and every plate input shape at four sizes and two seeds.
 */
const CASES: number[][] = [
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
  ...SHAPES.flatMap((shape) => [16, 33, 64, 128].flatMap((n) => [1, 2].map((s) => input(shape, n, 97 * s + n)))),
];
/** Every plate shape at every size up to `max`, two seeds each: the inputs below a switch point. */
const below = (max: number) => [...CASES.filter((a) => a.length <= max),
  ...SHAPES.flatMap((shape) => Array.from({ length: max }, (_, i) => i + 1).flatMap((n) => [1, 2].map((s) => input(shape, n, s))))];
/** Sizes an exact formula is checked at: every n to 64, then the plate's grid and its edges. */
const NS = [...Array.from({ length: 65 }, (_, n) => n), 72, 100, 127, 128, 129, 200, 255, 256, 257, 384, 511, 512];
const ALL = Array.from({ length: 1025 }, (_, n) => n);
const POW2 = Array.from({ length: 11 }, (_, k) => 2 ** k);

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const counts = (id: string, a: number[]) => {
  const c = run(id, a).counts;
  return [c.compares, c.writes, c.auxWrites];
};
/** The phases a run entered, by name, in order. */
const phases = (t: Trace) => {
  const out: string[] = [];
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === 8) out.push(t.labels[t.events[3 * e + 1]]);
  return out;
};
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;
const equal = (n: number) => new Array<number>(n).fill(7);
const ids = (n: number) => Array.from({ length: n }, (_, i) => i);
const lg = (n: number) => Math.log2(n);
/** ⌊lg(L + 1)⌋: what a binary search over L keys costs for a key not below any of them. */
const rightmost = (L: number) => Math.floor(Math.log2(L + 1));
/** The comparisons of the kernels' binary insertion sort on keys already in order. */
const binaryInsertionSorted = (m: number) => { let s = 0; for (let L = 1; L < m; L++) s += rightmost(L); return s; };
/** The comparisons and writes of the kernels' stable binary insertion sort of `seq`. */
function binaryInsertion(seq: number[]): [number, number] {
  const v = seq.slice();
  let [c, w] = [0, 0];
  for (let i = 1; i < v.length; i++) {
    const x = v[i];
    let [a, b] = [0, i];
    while (a < b) {
      const mid = a + Math.floor((b - a) / 2);
      c++;
      if (x < v[mid]) b = mid; else a = mid + 1;
    }
    for (let j = i; j > a; j--) { v[j] = v[j - 1]; w++; }
    if (a !== i) { v[a] = x; w++; }
  }
  return [c, w];
}
/** The input's element identities at the end of a wasm run: whether two equal keys crossed. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const r = S.run(id, keys, { seed: seedOf(keys) });
  const tags = [...r.tags];
  return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
}

/**
 * McIlroy's adversary ("A Killer Adversary for Quicksort", 1999): every key starts as gas, larger
 * than every solid key; a comparison of two gas keys freezes one of them at the next solid value,
 * keeping the one most recently compared (the likely pivot) gas. The values at the end are an
 * input on which a deterministic kernel makes exactly the comparisons it made against it.
 */
function adversary(n: number) {
  const gas = n - 1;
  const val = new Array<number>(n).fill(gas);
  let solid = 0;
  let candidate = 0;
  const freeze = (x: number) => { if (val[x] === gas) val[x] = solid++; };
  const cmp = (x: number, y: number): number => {
    if (val[x] === gas && val[y] === gas) freeze(x === candidate ? x : y);
    if (val[x] === gas) candidate = x;
    else if (val[y] === gas) candidate = y;
    return val[x] - val[y];
  };
  return { val, cmp };
}

/**
 * TypeScript replicas of two wasm kernels' comparisons and exchanges, line for line from
 * crates/algoglyph-kernels/src/sorting/algorithms/<id>.rs, so an adversary can answer them while
 * they run. They hold element identities and return the comparisons made and, for introsort, how
 * often it reached its depth limit.
 */
type Cmp = (x: number, y: number) => number;
function ops(v: number[], cmp: Cmp) {
  let n = 0;
  /** t.cmp_items: two keys the kernel holds. */
  const cv = (x: number, y: number) => { n++; return Math.sign(cmp(x, y)); };
  /** t.cmp: two positions. */
  const c = (i: number, j: number) => cv(v[i], v[j]);
  const sw = (i: number, j: number) => { const t = v[i]; v[i] = v[j]; v[j] = t; };
  const insertion = (lo: number, hi: number) => {
    for (let i = lo + 1; i < hi; i++) for (let j = i; j > lo && c(j - 1, j) > 0; j--) sw(j - 1, j);
  };
  return { c, cv, sw, insertion, count: () => n };
}
const REPLICA: Record<string, (v: number[], cmp: Cmp) => { compares: number; heapsorts: number }> = {
  introsort: (v, cmp) => {
    const o = ops(v, cmp);
    const { c, cv, sw } = o;
    let heapsorts = 0;
    const sift = (lo: number, root: number, n: number) => {
      for (;;) {
        let child = 2 * root + 1;
        if (child >= n) return;
        if (child + 1 < n && c(lo + child, lo + child + 1) < 0) child++;
        if (c(lo + root, lo + child) >= 0) return;
        sw(lo + root, lo + child);
        root = child;
      }
    };
    const heapsort = (lo: number, hi: number) => {
      heapsorts++;
      const n = hi - lo;
      for (let s = Math.floor(n / 2) - 1; s >= 0; s--) sift(lo, s, n);
      for (let end = n - 1; end >= 1; end--) { sw(lo, lo + end); sift(lo, 0, end); }
    };
    const median = (a: number, b: number, d: number) => {
      const [x, y, z] = [v[a], v[b], v[d]];
      if (cv(x, y) < 0) {
        if (cv(y, z) < 0) return y;
        return cv(x, z) < 0 ? z : x;
      }
      if (cv(x, z) < 0) return x;
      return cv(y, z) < 0 ? z : y;
    };
    const partition = (lo: number, hi: number, pivot: number) => {
      let [i, j] = [lo, hi];
      for (;;) {
        while (cv(v[i], pivot) < 0) i++;
        j--;
        while (cv(pivot, v[j]) < 0) j--;
        if (i >= j) return i;
        sw(i, j);
        i++;
      }
    };
    const loop = (lo: number, hi: number, depth: number): void => {
      while (hi - lo > 16) {
        if (depth === 0) { heapsort(lo, hi); return; }
        depth--;
        const pivot = median(lo, lo + Math.floor((hi - lo) / 2), hi - 1);
        const cut = partition(lo, hi, pivot);
        if (cut <= lo || cut >= hi) { heapsort(lo, hi); return; }
        loop(cut, hi, depth);
        hi = cut;
      }
    };
    const n = v.length;
    if (n >= 2) {
      loop(0, n, 2 * Math.floor(Math.log2(n)));
      o.insertion(0, n);
    }
    return { compares: o.count(), heapsorts };
  },
  quickxsort: (v, cmp) => {
    const o = ops(v, cmp);
    const { c, sw } = o;
    const partition = (lo: number, hi: number) => {
      const mid = lo + Math.floor((hi - lo) / 2);
      const last = hi - 1;
      if (c(mid, lo) < 0) sw(mid, lo);
      if (c(last, lo) < 0) sw(last, lo);
      if (c(last, mid) < 0) sw(last, mid);
      sw(lo, mid);
      let [i, j] = [lo, hi];
      for (;;) {
        i++;
        while (i < last && c(i, lo) < 0) i++;
        j--;
        while (j > lo && c(lo, j) < 0) j--;
        if (i >= j) break;
        sw(i, j);
      }
      sw(lo, j);
      return j;
    };
    const msort = (lo: number, hi: number, buf: number): void => {
      const n = hi - lo;
      if (n < 2) return;
      const m = Math.floor(n / 2);
      msort(lo, lo + m, buf);
      msort(lo + m, hi, buf);
      for (let k = 0; k < m; k++) sw(lo + k, buf + k);
      let [i, j, out] = [buf, lo + m, lo];
      while (i < buf + m && j < hi) {
        if (c(j, i) < 0) { sw(out, j); j++; } else { sw(out, i); i++; }
        out++;
      }
      while (i < buf + m) { sw(out, i); i++; out++; }
    };
    let [lo, hi] = [0, v.length];
    while (hi - lo > 16) {
      const p = partition(lo, hi);
      const [left, right]: [number, number][] = [[lo, p], [p + 1, hi]];
      const [big, small] = p - lo >= hi - p - 1 ? [left, right] : [right, left];
      if (small[1] - small[0] >= Math.floor((big[1] - big[0]) / 2)) {
        msort(big[0], big[1], small[0]);
        [lo, hi] = small;
      } else {
        msort(small[0], small[1], big[0]);
        [lo, hi] = big;
      }
    }
    o.insertion(lo, hi);
    return { compares: o.count(), heapsorts: 0 };
  },
};
/** The input McIlroy's adversary builds against a kernel's replica, and the replica's run on it. */
function kill(id: string, n: number) {
  const adv = adversary(n);
  const r = REPLICA[id](ids(n), adv.cmp);
  return { keys: adv.val, ...r };
}
/** The plate's grid of sizes from n0 on, with every n up to 128. */
const from = (n0: number) => [...Array.from({ length: 129 - n0 }, (_, i) => n0 + i), ...[136, 192, 256, 320, 384, 448, 504, 512]];

/** ⌈lg(3k/4)⌉ summed for k = 1..n: Ford and Johnson's worst case (Knuth 5.3.1, eq. (3)). */
const fordJohnson = (n: number) => {
  let s = 0;
  for (let k = 1; k <= n; k++) { let j = 0; while (2 ** (j + 2) < 3 * k) j++; s += j; }
  return s;
};
/** ⌈lg n!⌉, the information-theoretic lower bound. */
const lgFactorial = (n: number) => {
  // exact for the sizes used: the sum of logs is far from an integer except where it is one
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log2(k);
  return Math.ceil(s - 1e-9) + 0;
};

/** Insertion by exchanges alone up to `max` keys: writes = 2 × inversions, inversions ≤ comparisons ≤ inversions + n − 1. */
function exchangeInsertionAlone(id: string, max: number) {
  for (const a of below(max)) {
    const [c, w, x] = counts(id, a);
    const inv = inversions(a);
    expect([w, x], `${id} ${at(a)}`).toEqual([2 * inv, 0]);
    expect(c, `${id} ${at(a)}`).toBeGreaterThanOrEqual(inv);
    expect(c, `${id} ${at(a)}`).toBeLessThanOrEqual(inv + Math.max(0, a.length - 1));
  }
}
/** Binary insertion alone up to `max` keys, after `pre` comparisons: counts exactly as the reference does. */
function binaryInsertionAlone(id: string, max: number, pre: (a: number[]) => number = () => 0) {
  for (const a of below(max)) {
    const [c, w] = binaryInsertion(a);
    expect(counts(id, a), `${id} ${at(a)}`).toEqual([pre(a) + c, w, 0]);
  }
}
/** The comparisons an "is it sorted?" scan makes: up to and including the first descent. */
const firstDescent = (a: number[]) => {
  for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return i;
  return Math.max(0, a.length - 1);
};
/** Introsort's partitions on keys in order: m + 3 comparisons each (median 2, scans m + 1), split at the middle. */
const introSorted = (m: number): number => (m <= 16 ? 0 : m + 3 + introSorted(Math.floor(m / 2)) + introSorted(m - Math.floor(m / 2)));

describe('sorting/hybrid: exact bounds against counted runs', () => {
  it('introsort: up to 16 keys only the final insertion pass runs; never an auxiliary write', () => {
    exchangeInsertionAlone('introsort', 16);
    for (const a of CASES) expect(run('introsort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('introsort: on Already sorted no write, m + 3 comparisons per partition of m > 16 keys and n − 1 for the pass; Reversed 2 − (n mod 2) more and 2⌊n/2⌋ writes', () => {
    for (const n of ALL) {
      const want = introSorted(n) + Math.max(0, n - 1);
      expect(counts('introsort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([want, 0, 0]);
      // Reversed: the first partition exchanges every pair across the middle and leaves the keys in order
      if (n > 16) expect(counts('introsort', input('reversed', n, 1)), `reversed n=${n}`).toEqual([want + 2 - (n % 2), 2 * Math.floor(n / 2), 0]);
    }
    expect(counts('introsort', input('sorted', 512, 1))[0]).toBe(3164);
    // presorted input is cheap by accident of the middle pivot, not by a search for runs
    expect(counts('introsort', input('random', 512, 4242))).toEqual([5499, 3616, 0]);
  });

  it('the adversaries\' replicas compare exactly as the wasm kernels do', () => {
    for (const id of Object.keys(REPLICA)) {
      for (const shape of SHAPES) {
        for (const n of [0, 1, 2, 5, 16, 17, 40, 64, 100, 257, 300, 512]) {
          const a = input(shape, n, 7 + n);
          const ph = phases(run(id, a));
          const r = REPLICA[id](a.slice(), (x, y) => x - y);
          expect(r.compares, `${id} ${shape} n=${n}`).toBe(run(id, a).counts.compares);
          if (id === 'introsort') expect(r.heapsorts, `${id} ${shape} n=${n}`).toBe(ph.filter((p) => p.startsWith('depth limit')).length);
        }
      }
    }
  });

  it('introsort: McIlroy\'s adversary drives it to its depth limit from 64 keys on, and it stays below 4 n lg n comparisons', () => {
    let worst = 0;
    for (const n of from(17)) {
      const k = kill('introsort', n);
      const t = run('introsort', k.keys);
      expect(t.counts.compares, `n=${n}`).toBe(k.compares);
      const heapsorts = phases(t).filter((p) => p === 'depth limit reached: heapsort').length;
      if (n >= 64) expect(heapsorts, `n=${n}`).toBeGreaterThanOrEqual(1);
      expect(t.counts.compares, `n=${n}`).toBeLessThan(4 * n * lg(n));
      worst = Math.max(worst, t.counts.compares / (n * lg(n)));
    }
    // the same adversary drives median-of-three quickxsort past n²/4 (below): the depth limit is the difference
    expect(worst).toBeGreaterThan(3);
  });

  it('introsort: Organ pipe reaches the depth limit, four times at 512 keys: six phases', () => {
    const t = run('introsort', input('organ-pipe', 512, 4242));
    expect(phases(t)).toEqual(['introsort loop: median-of-3 quicksort with depth limit',
      ...new Array(4).fill('depth limit reached: heapsort'), 'final insertion sort']);
    for (const shape of ['random', 'sorted', 'reversed'] as const) expect(run('introsort', input(shape, 512, 4242)).marks.phases, shape).toBe(2);
  });

  it('quickxsort: up to 16 keys insertion by exchanges alone; never an auxiliary write', () => {
    exchangeInsertionAlone('quickxsort', 16);
    for (const a of CASES) expect(run('quickxsort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('quickxsort: McIlroy\'s adversary costs it more than n²/4 comparisons from 64 keys on', () => {
    for (const n of from(64)) {
      const k = kill('quickxsort', n);
      const t = run('quickxsort', k.keys);
      expect(t.counts.compares, `n=${n}`).toBe(k.compares);
      expect(t.counts.compares, `n=${n}`).toBeGreaterThan((n * n) / 4);
    }
  });

  it('quickxsort: over 100 random permutations of 512 keys the mean stays above n lg n − n, not near n lg n − 1.4n', () => {
    let s = 0;
    for (let seed = 1; seed <= 100; seed++) s += run('quickxsort', input('random', 512, seed)).counts.compares;
    expect(s / 100).toBeGreaterThan(512 * 9 - 512);
    expect(s / 100).toBeGreaterThan(512 * 9 - 1.26 * 512);
  });

  it('quickxsort: every mergesort move is an exchange, so on Random permutation at 512 keys the writes exceed twice the comparisons', () => {
    const [c, w] = counts('quickxsort', input('random', 512, 4242));
    expect([c, w]).toEqual([4234, 9772]);
    expect(w).toBeGreaterThan(2 * c);
    // each partition is followed by the mergesort of one side, the other side its buffer
    for (const n of [64, 100, 256, 512]) {
      const ph = phases(run('quickxsort', input('random', n, 4242)));
      expect(ph.at(-1), `n=${n}`).toBe('insertion sort of the last segment');
      const body = ph.slice(0, -1);
      expect(body.length % 2, `n=${n}`).toBe(0);
      body.forEach((p, i) => expect(i % 2 ? p.startsWith('mergesort the') : p === 'quicksort partition', `n=${n} ${p}`).toBe(true));
    }
  });

  it('ford-johnson: never more than Σ⌈lg(3k/4)⌉ comparisons; exactly n array writes and n auxiliary writes', () => {
    for (const a of [...CASES, ...SHAPES.flatMap((shape) => NS.map((n) => input(shape, n, 4242 + n)))]) {
      const [c, w, x] = counts('ford-johnson', a);
      expect(c, at(a)).toBeLessThanOrEqual(fordJohnson(a.length));
      expect([w, x], at(a)).toEqual(a.length < 2 ? [0, 0] : [a.length, a.length]);
    }
    expect([fordJohnson(512), lgFactorial(512)]).toEqual([3931, 3876]);
    // the sum equals the information-theoretic bound up to 11 keys and first exceeds it at 12 (Knuth 5.3.1)
    for (let n = 1; n <= 11; n++) expect(fordJohnson(n), `n=${n}`).toBe(lgFactorial(n));
    expect([fordJohnson(12), lgFactorial(12)]).toEqual([30, 29]);
    expect(counts('ford-johnson', input('random', 512, 4242))[0]).toBe(3892);
  });

  it('ford-johnson: some permutation of every size up to 9 needs Σ⌈lg(3k/4)⌉ = ⌈lg n!⌉ comparisons', () => {
    for (let n = 1; n <= 9; n++) {
      let most = 0;
      for (const p of permutations(n)) most = Math.max(most, S.run('ford-johnson', p, { trace: false }).counts.cmp);
      expect([most, fordJohnson(n)], `n=${n}`).toEqual([lgFactorial(n), lgFactorial(n)]);
    }
  });

  it('ford-johnson: two phases per recursion level, ⌊lg n⌋ levels, and the write-back', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      expect(run('ford-johnson', input('random', n, n)).marks.phases, `n=${n}`).toBe(2 * Math.floor(lg(n)) + 1);
    }
  });

  it('fluxsort: n − 1 comparisons and no write on Already sorted and on keys all equal', () => {
    for (const n of ALL) {
      expect(counts('fluxsort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([Math.max(0, n - 1), 0, 0]);
      expect(counts('fluxsort', equal(n)), `equal n=${n}`).toEqual([Math.max(0, n - 1), 0, 0]);
    }
  });

  it('fluxsort: up to 24 keys the scan to the first descent, then binary insertion alone', () => {
    for (const a of below(24)) {
      if (inversions(a) === 0) continue;
      const [c, w] = binaryInsertion(a);
      expect(counts('fluxsort', a), at(a)).toEqual([firstDescent(a) + c, w, 0]);
    }
  });

  it('fluxsort: Organ pipe at 512 keys costs more than twice the comparisons of Random permutation', () => {
    const [organ, random] = [counts('fluxsort', input('organ-pipe', 512, 4242))[0], counts('fluxsort', input('random', 512, 4242))[0]];
    expect([organ, random]).toEqual([11352, 4528]);
    expect(organ).toBeGreaterThan(2 * random);
    expect(run('fluxsort', input('organ-pipe', 512, 4242)).marks.phases).toBe(225);
    // the scan finishes only keys in order: Reversed is partitioned like any other input
    expect(counts('fluxsort', input('reversed', 512, 4242))[0]).toBe(4398);
  });

  it('crumsort: up to 64 keys insertion by exchanges alone; keys all equal 2n + 12 comparisons and 2n writes above', () => {
    exchangeInsertionAlone('crumsort', 64);
    for (const n of ALL.filter((x) => x > 64)) expect(counts('crumsort', equal(n)).slice(0, 2), `equal n=${n}`).toEqual([2 * n + 12, 2 * n]);
  });

  it('crumsort: no analyser, so Already sorted above 64 keys is partitioned; Few distinct keys under a third of Random', () => {
    for (const n of ALL.filter((x) => x > 64)) expect(counts('crumsort', input('sorted', n, 1))[1], `n=${n}`).toBeGreaterThan(0);
    expect(counts('crumsort', input('sorted', 512, 4242)).slice(0, 2)).toEqual([7858, 12888]);
    const [few, random] = [counts('crumsort', input('few-unique', 512, 4242))[0], counts('crumsort', input('random', 512, 4242))[0]];
    expect([few, random]).toEqual([2255, 8390]);
    expect(3 * few).toBeLessThan(random);
  });

  it('wolfsort: below 256 keys fluxsort without its analyser: the same writes, and the scan\'s comparisons fewer', () => {
    for (const a of [...below(24), ...SHAPES.flatMap((shape) => [25, 64, 100, 128, 200, 255].flatMap((n) => [1, 2].map((s) => input(shape, n, s))))]) {
      if (inversions(a) === 0) continue;
      const [fc, fw, fx] = counts('fluxsort', a);
      expect(counts('wolfsort', a), at(a)).toEqual([fc - firstDescent(a), fw, fx]);
    }
  });

  it('wolfsort: from 256 keys a permutation of 1..n fills ⌊n/16⌋ buckets, each finished by binary insertion; n writes and n auxiliary writes to distribute', () => {
    const PERMUTED = ['random', 'nearly-sorted', 'reversed', 'sorted'] as const;
    for (const shape of PERMUTED) {
      for (const n of [256, 257, 263, 271, 300, 384, 400, 500, 511, 512, 640, 1000, 1024]) {
        const a = input(shape, n, 4242 + n);
        const B = Math.min(256, Math.floor(n / 16));
        const buckets: number[][] = Array.from({ length: B }, () => []);
        for (const x of a) buckets[Math.floor(((x - 1) * B) / n)].push(x);
        expect(Math.max(...buckets.map((b) => b.length)), `${shape} n=${n}`).toBeLessThanOrEqual(24);
        let [c, w] = [0, n];
        for (const b of buckets) { const [bc, bw] = binaryInsertion(b); c += bc; w += bw; }
        expect(counts('wolfsort', a), `${shape} n=${n}`).toEqual([c, w, n]);
      }
    }
    // 32 buckets of 16 keys in order, ⌊lg 2⌋ + ⌊lg 3⌋ + … + ⌊lg 16⌋ = 38 comparisons each
    expect(binaryInsertionSorted(16)).toBe(38);
    expect(counts('wolfsort', input('sorted', 512, 4242))).toEqual([32 * 38, 512, 512]);
    expect([counts('wolfsort', input('random', 512, 4242))[0], counts('fluxsort', input('random', 512, 4242))[0]]).toEqual([1417, 4528]);
    expect(3 * 1417).toBeLessThan(4528);
  });

  it('weavesort: n − 1 comparisons and no write on Already sorted and on keys all equal', () => {
    for (const n of ALL) {
      expect(counts('weavesort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([Math.max(0, n - 1), 0, 0]);
      expect(counts('weavesort', equal(n)), `equal n=${n}`).toEqual([Math.max(0, n - 1), 0, 0]);
    }
  });

  it('weavesort: Reversed at n = 2^k ≥ 2 costs n²/4 + (5/4)n lg n − 5n/4 + 1 comparisons and n²/2 + (n/2) lg n (lg n − 1) writes', () => {
    for (const n of POW2.filter((x) => x >= 2)) {
      const k = lg(n);
      expect(counts('weavesort', input('reversed', n, 1)), `n=${n}`)
        .toEqual([(n * n) / 4 + (5 * n * k) / 4 - (5 * n) / 4 + 1, (n * n) / 2 + (n / 2) * k * (k - 1), 0]);
    }
    expect(counts('weavesort', input('reversed', 512, 4242))[0]).toBe(70657);
    for (const a of CASES) expect(run('weavesort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('blitsort: up to 32 keys binary insertion alone, counted exactly as the reference does', () => {
    binaryInsertionAlone('blitsort', 32);
  });

  it('blitsort: no analyser, so Already sorted is partitioned; on Random permutation its rotations more than double fluxsort\'s writes', () => {
    expect(counts('blitsort', input('sorted', 512, 4242)).slice(0, 2)).toEqual([3939, 2260]);
    const [b, f] = [counts('blitsort', input('random', 512, 4242)), counts('fluxsort', input('random', 512, 4242))];
    expect([b[1], f[1]]).toEqual([12361, 5435]);
    expect(b[1]).toBeGreaterThan(2 * f[1]);
  });

  it('octosort: up to 32 keys binary insertion alone, counted exactly as the reference does', () => {
    binaryInsertionAlone('octosort', 32);
  });

  it('octosort: on Already sorted and keys all equal no write, the runs\' binary insertions and one comparison per merge', () => {
    for (const n of ALL) {
      let c = Math.max(0, Math.ceil(n / 32) - 1);
      for (let lo = 0; lo < n; lo += 32) c += binaryInsertionSorted(Math.min(32, n - lo));
      expect(counts('octosort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([c, 0, 0]);
      expect(counts('octosort', equal(n)), `equal n=${n}`).toEqual([c, 0, 0]);
    }
    expect([binaryInsertionSorted(32), counts('octosort', input('sorted', 512, 4242))[0]]).toEqual([103, 16 * 103 + 15]);
    expect(phases(run('octosort', input('random', 512, 4242)))).toEqual(['build runs of 32 by binary insertion',
      'merge runs of 32', 'merge runs of 64', 'merge runs of 128', 'merge runs of 256']);
  });

  it('introsort, quickxsort, ford-johnson, crumsort and weavesort reorder equal keys: none is stable', () => {
    for (const id of ['introsort', 'quickxsort', 'ford-johnson', 'crumsort', 'weavesort']) {
      const witness = [...words(4), ...[1, 2, 3, 4, 5].map((s) => input('few-unique', 100, s))].find((a) => reordersEqualKeys(id, a));
      expect(witness, id).toBeDefined();
    }
  });
});
