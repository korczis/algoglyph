// Every exact count and every hard inequality the quicksort shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a shift or a copy one) and Auxiliary writes. Each kernel runs as its plate plays it: its
// TypeScript kernel, or the wasm kernel its sidecar record maps (src/kernels/sorting-wasm),
// replayed through the same engine. The random pivot is drawn from a seeded generator: what is
// stated for it holds for the plate's own seed and for every other seed run here, and its
// expectation is checked as a mean over many seeds.
// A quadratic worst case depends on the pivot rule, so each one is shown on the input that
// triggers it for that kernel: Already sorted for the rightmost pivot, keys all equal for the
// random pivot with Lomuto's partition, and otherwise an input built against the rule while the
// kernel runs (McIlroy's adversary, or one that makes the sampled pivots the smallest keys).
// The wasm kernels cannot be steered while they run, so the adversary plays a TypeScript replica
// of their comparisons (checked here to compare exactly as the kernel does) and the input it
// builds is then counted on the wasm kernel itself.
// Asymptotic bounds (~, O, expected orders) are not checked here; that every kernel sorts every
// shape and size is test/kernels-array.test.ts ("leaves every input shape and size in the order
// its goal promises") and test/kernels-sorting-wasm.test.ts ("leaves every input shape and size
// sorted, as an independent reference does").
import { describe, expect, it } from 'vitest';
import { EVENT_CAP, input, inversions, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { replay, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const files = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = async (id: string): Promise<ArrayKernel> => files[`../src/kernels/array/${id}.ts`] ?? sidecarKernel(id);
const K = Object.fromEntries(await Promise.all([
  'quicksort', 'quicksort-median-of-three', 'quicksort-three-way', 'randomized-quicksort', 'dual-pivot-quicksort',
  'multi-pivot-quicksort', 'blockquicksort', 'pdqsort', 'ipnsort', 'proportion-extend-sort',
].map(async (id) => [id, await kernelOf(id)] as const)));
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
/** Sizes an exact formula is checked at: every n to 64, then the plate's grid and its edges. */
const NS = [...Array.from({ length: 65 }, (_, n) => n), 72, 100, 127, 128, 129, 200, 255, 256, 257, 384, 511, 512];

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const tri = (n: number) => (n < 2 ? 0 : (n * (n - 1)) / 2);
const equal = (n: number) => new Array<number>(n).fill(7);
const distinct = (a: number[]) => new Set(a).size;
/** Keys with a larger key somewhere before them: the keys an insertion has to move. */
const moving = (a: number[]) => a.filter((x, i) => a.slice(0, i).some((y) => y > x)).length;
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;
const ids = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The random-pivot kernel with an explicit seed, replayed through the same engine. */
const seeded = (seed: number): ArrayKernel => ({
  run: (a) => {
    const keys = Int32Array.from({ length: a.n }, (_, i) => a.get(i));
    replay(a, S.run('randomized-quicksort', keys, { seed, maxSteps: EVENT_CAP }), a.n);
  },
});
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

/**
 * McIlroy's adversary ("A Killer Adversary for Quicksort", 1999): every key starts as gas, larger
 * than every solid key; a comparison of two gas keys freezes one of them at the next solid value,
 * keeping the one most recently compared (the likely pivot) gas. `pick` freezes keys outright, for
 * an adversary that knows where the pivots are sampled. The values at the end are an input on
 * which a deterministic kernel makes exactly the comparisons it made against the adversary.
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
  return { val, cmp, freeze };
}

/**
 * TypeScript replicas of three wasm kernels' comparisons and exchanges, line for line from
 * crates/algoglyph-kernels/src/sorting/algorithms/<id>.rs, so an adversary can answer them while
 * they run. They return the comparisons made; `pick` sees the positions a kernel samples its pivots
 * from, before it compares them.
 */
type Cmp = (x: number, y: number) => number;
type Replica = (v: number[], cmp: Cmp, pick?: (v: number[], ...at: number[]) => void) => number;
function ops(v: number[], cmp: Cmp) {
  let n = 0;
  const c = (i: number, j: number) => { n++; return Math.sign(cmp(v[i], v[j])); };
  const sw = (i: number, j: number) => { const t = v[i]; v[i] = v[j]; v[j] = t; };
  /** kit::insertion: exchanges a key leftwards while its left neighbour is larger. */
  const insertion = (lo: number, hi: number) => {
    for (let i = lo + 1; i < hi; i++) for (let j = i; j > lo && c(j - 1, j) > 0; j--) sw(j - 1, j);
  };
  /** kit::sort3. */
  const sort3 = (a: number, b: number, d: number) => {
    if (c(b, a) < 0) sw(a, b);
    if (c(d, b) < 0) { sw(b, d); if (c(b, a) < 0) sw(a, b); }
  };
  return { c, sw, insertion, sort3, count: () => n };
}
const REPLICA: Record<string, Replica> = {
  'dual-pivot-quicksort': (v, cmp, pick) => {
    const o = ops(v, cmp);
    const { c, sw } = o;
    const dual = (left: number, right: number): void => {
      const len = right - left + 1;
      if (len < 17) { o.insertion(left, right + 1); return; }
      const third = Math.floor(len / 3);
      pick?.(v, left + third, right - third);
      sw(left + third, left);
      sw(right - third, right);
      if (c(left, right) > 0) sw(left, right);
      let less = left + 1;
      let great = right - 1;
      for (let k = less; k <= great; k++) {
        if (c(k, left) < 0) { sw(k, less); less++; } else if (c(k, right) > 0) {
          while (k < great && c(great, right) > 0) great--;
          sw(k, great);
          great--;
          if (c(k, left) < 0) { sw(k, less); less++; }
        }
      }
      less--;
      great++;
      sw(left, less);
      sw(right, great);
      if (less > left + 1) dual(left, less - 1);
      if (great + 1 < right) dual(great + 1, right);
      if (great > less + 1 && c(less, great) < 0) dual(less + 1, great - 1);
    };
    if (v.length > 1) dual(0, v.length - 1);
    return o.count();
  },
  'multi-pivot-quicksort': (v, cmp, pick) => {
    const o = ops(v, cmp);
    const { c, sw } = o;
    const three = (left: number, right: number): void => {
      const len = right - left + 1;
      if (len < 4) { o.insertion(left, right + 1); return; }
      const [q1, q2, q3] = [left + Math.floor(len / 4), left + Math.floor(len / 2), left + Math.floor((3 * len) / 4)];
      pick?.(v, q1, q2, q3);
      o.sort3(q1, q2, q3);
      sw(q1, left);
      sw(q2, left + 1);
      sw(q3, right);
      const [p, q, r] = [left, left + 1, right];
      let [a, b, cc, d] = [left + 2, left + 2, right - 1, right - 1];
      while (b <= cc) {
        while (b <= cc && c(b, q) < 0) { if (c(b, p) < 0) { sw(a, b); a++; } b++; }
        while (b <= cc && c(cc, q) > 0) { if (c(cc, r) > 0) { sw(cc, d); d--; } cc--; }
        if (b <= cc) {
          const far = c(b, r) > 0;
          if (c(cc, p) < 0) { sw(b, a); sw(a, cc); a++; } else sw(b, cc);
          if (far) { sw(cc, d); d--; }
          b++;
          cc--;
        }
      }
      a--;
      b--;
      d++;
      sw(left + 1, a);
      sw(a, b);
      a--;
      sw(left, a);
      sw(right, d);
      if (a > left + 1) three(left, a - 1);
      if (b > a + 2) three(a + 1, b - 1);
      if (d > b + 2) three(b + 1, d - 1);
      if (right > d + 1) three(d + 1, right);
    };
    if (v.length > 1) three(0, v.length - 1);
    return o.count();
  },
  blockquicksort: (v, cmp) => {
    const o = ops(v, cmp);
    const { c, sw } = o;
    const B = 128;
    const partition = (lo: number, hi: number): number => {
      o.sort3(lo, lo + Math.floor((hi - lo) / 2), hi - 1);
      sw(lo, lo + Math.floor((hi - lo) / 2));
      let [l, r] = [lo + 1, hi - 1];
      let [offL, offR] = [[] as number[], [] as number[]];
      let [sl, sr] = [0, 0];
      while (r + 1 - l > 2 * B) {
        if (offL.length === sl) { offL = []; sl = 0; for (let i = 0; i < B; i++) if (c(l + i, lo) >= 0) offL.push(i); }
        if (offR.length === sr) { offR = []; sr = 0; for (let i = 0; i < B; i++) if (c(r - i, lo) <= 0) offR.push(i); }
        const num = Math.min(offL.length - sl, offR.length - sr);
        for (let k = 0; k < num; k++) sw(l + offL[sl + k], r - offR[sr + k]);
        sl += num;
        sr += num;
        if (sl === offL.length) l += B;
        if (sr === offR.length) r -= B;
      }
      let [i, j] = [l, r];
      for (;;) {
        while (i <= j && c(i, lo) < 0) i++;
        while (i <= j && c(j, lo) > 0) j--;
        if (i >= j) break;
        sw(i, j);
        i++;
        j--;
      }
      sw(lo, i - 1);
      return i - 1;
    };
    const rec = (lo: number, hi: number): void => {
      while (hi - lo > 16) {
        const p = partition(lo, hi);
        if (p - lo < hi - p) { rec(lo, p); lo = p + 1; } else { rec(p + 1, hi); hi = p; }
      }
      o.insertion(lo, hi);
    };
    rec(0, v.length);
    return o.count();
  },
};

/** The input McIlroy's adversary builds against a TypeScript kernel, by its own comparisons. */
function killTs(id: string, n: number): number[] {
  const adv = adversary(n);
  trace(K[id], ids(n), 0, EVENT_CAP, (x, y) => adv.cmp(x, y) < 0);
  return adv.val;
}
/** The input an adversary builds against a wasm kernel's replica; `pivots` freezes the sampled pivots first. */
function killReplica(id: string, n: number, pivots: boolean): { keys: number[]; compares: number } {
  const adv = adversary(n);
  const pick = pivots ? (v: number[], ...at: number[]) => at.forEach((i) => adv.freeze(v[i])) : undefined;
  const compares = REPLICA[id](ids(n), adv.cmp, pick);
  return { keys: adv.val, compares };
}
/** The plate's grid of sizes from n0 on, with every n up to 128. */
const from = (n0: number) => [...Array.from({ length: 129 - n0 }, (_, i) => n0 + i), ...[136, 192, 256, 320, 384, 448, 504, 512]];

/** Stable means equal keys leave in their input order: keys carry their position as a tag. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const items = keys.map((k, i) => 1000 * k + i);
  const t = trace(K[id], items, 0, EVENT_CAP, (x, y) => Math.floor(x / 1000) < Math.floor(y / 1000));
  return t.output.some((x, i) => i > 0 && Math.floor(x / 1000) === Math.floor(t.output[i - 1] / 1000) && x < t.output[i - 1]);
}

describe('sorting/quicksort: exact bounds against counted runs', () => {
  it('quicksort: Already sorted costs (n − 1)(n + 4)/2 comparisons and 2(n − 1) writes, the most of any permutation', () => {
    const worst = (n: number) => (n < 2 ? 0 : ((n - 1) * (n + 4)) / 2);
    for (const n of NS) {
      const sorted = run('quicksort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([worst(n), 2 * Math.max(0, n - 1)]);
      const reversed = run('quicksort', input('reversed', n, 1));
      expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`)
        .toEqual([worst(n) - Math.floor(n / 2), 2 * Math.max(0, n - 1)]);
    }
    for (let n = 0; n <= 8; n++) {
      for (const p of permutations(n)) expect(run('quicksort', p).counts.compares, at(p)).toBeLessThanOrEqual(worst(n));
    }
    for (const a of CASES) expect(run('quicksort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('quicksort-median-of-three: up to 11 keys only the insertion pass runs; never an auxiliary write', () => {
    const small = [...CASES.filter((a) => a.length <= 11),
      ...SHAPES.flatMap((shape) => [7, 8, 9, 10, 11].flatMap((n) => [1, 2, 3].map((s) => input(shape, n, s))))];
    for (const a of small) {
      const t = run('quicksort-median-of-three', a);
      const inv = inversions(a);
      expect(t.counts.writes, at(a)).toBe(inv + moving(a));
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(inv);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(inv + Math.max(0, a.length - 1));
    }
    for (const a of CASES) expect(run('quicksort-median-of-three', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('quicksort-median-of-three: on Already sorted m + 2 comparisons and 4 writes per subfile of m > 11 keys, n − 1 for the pass', () => {
    // every pivot is the middle key, and both sides stay sorted: the subfiles split at the middle
    const parts = (m: number): [number, number] => {
      if (m <= 11) return [0, 0];
      const [lc, lp] = parts(Math.floor((m - 1) / 2));
      const [rc, rp] = parts(m - 1 - Math.floor((m - 1) / 2));
      return [m + 2 + lc + rc, 1 + lp + rp];
    };
    for (const n of NS) {
      const [c, p] = parts(n);
      const sorted = run('quicksort-median-of-three', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([c + Math.max(0, n - 1), 4 * p]);
    }
    expect(run('quicksort-median-of-three', input('sorted', 512, 1)).counts.compares).toBe(3652);
    expect(run('quicksort', input('sorted', 512, 1)).counts.compares).toBe(131838);
  });

  it('quicksort-median-of-three: the insertion pass meets blocks of at most eleven keys, and eleven occur', () => {
    let largest = 0;
    for (const n of [64, 100, 128, 256, 512]) {
      for (let s = 1; s <= 40; s++) {
        const t = run('quicksort-median-of-three', input('random', n, s));
        // the array as the partitions left it: replayed up to the pass's own range mark
        let pass = 0;
        for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.range) pass = e;
        const a = t.input.slice();
        for (let e = 0; e < pass; e++) {
          const [op, i, j] = [t.events[3 * e], t.events[3 * e + 1], t.events[3 * e + 2]];
          if (op === OP.write) a[i] = j;
          else if (op === OP.swap) [a[i], a[j]] = [a[j], a[i]];
        }
        // a block ends where the keys so far are exactly 1..k+1 (the keys are 1..n)
        let start = 0;
        let max = 0;
        for (let k = 0; k < n; k++) {
          max = Math.max(max, a[k]);
          if (max === k + 1) { largest = Math.max(largest, k + 1 - start); start = k + 1; }
        }
      }
    }
    expect(largest).toBe(11);
  });

  it('quicksort-median-of-three: an adversary\'s input costs more than n²/4 comparisons from 22 keys on', () => {
    for (const n of from(22)) {
      expect(run('quicksort-median-of-three', killTs('quicksort-median-of-three', n)).counts.compares, `n=${n}`)
        .toBeGreaterThan((n * n) / 4);
    }
  });

  it('quicksort-median-of-three and quicksort-three-way reorder equal keys: neither is stable', () => {
    for (const id of ['quicksort-median-of-three', 'quicksort-three-way']) {
      const witness = [1, 2, 3, 4, 5].map((s) => input('few-unique', 64, s)).find((a) => reordersEqualKeys(id, a));
      expect(witness, id).toBeDefined();
    }
  });

  it('quicksort-three-way: with d distinct keys at most 2d(n − 1) comparisons and 2d(n − 1) writes; all equal 2(n − 1) and none', () => {
    for (const a of CASES) {
      const t = run('quicksort-three-way', a);
      const bound = 2 * distinct(a) * Math.max(0, a.length - 1);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(bound);
      expect(t.counts.writes, at(a)).toBeLessThanOrEqual(bound);
      expect(t.counts.auxWrites, at(a)).toBe(0);
    }
    for (const n of NS) {
      const same = run('quicksort-three-way', equal(n));
      expect([same.counts.compares, same.counts.writes], `equal n=${n}`).toEqual([2 * Math.max(0, n - 1), 0]);
    }
  });

  it('quicksort-three-way: at most n(n − 1) comparisons and writes, both reached; n(n − 1)/2 and n(n − 1) on Reversed', () => {
    for (const a of CASES) {
      const t = run('quicksort-three-way', a);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(2 * tri(a.length));
      expect(t.counts.writes, at(a)).toBeLessThanOrEqual(2 * tri(a.length));
    }
    for (const n of NS) {
      const reversed = run('quicksort-three-way', input('reversed', n, 1));
      expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`).toEqual([tri(n), 2 * tri(n)]);
    }
    for (const n of from(2)) {
      const worst = run('quicksort-three-way', killTs('quicksort-three-way', n));
      expect([worst.counts.compares, worst.counts.writes], `adversary n=${n}`).toEqual([2 * tri(n), 2 * tri(n)]);
    }
  });

  it('three-way partitioning stays under 2d(n − 1) on Few distinct keys, where two-way quicksort does not', () => {
    // the plate's own input for the claim: Few distinct keys (d = 4), 512 keys, seed 4242
    const a = input('few-unique', 512, 4242);
    expect(distinct(a)).toBe(4);
    expect(run('quicksort-three-way', a).counts.compares).toBeLessThan(2 * 4 * 511);
    expect(run('quicksort', a).counts.compares).toBeGreaterThan(2 * 4 * 511);
  });

  it('randomized-quicksort: for every seed, best(n) ≤ comparisons ≤ n(n − 1)/2 and writes ≤ (n − 1)(n + 4)', () => {
    // each partition of m keys costs m − 1 comparisons: least when every split is even
    const best = (n: number) => {
      const L = Math.floor(Math.log2(n + 1));
      return (n + 1) * L - 2 ** (L + 1) + 2;
    };
    const rec: number[] = [0, 0];
    for (let n = 2; n <= 1024; n++) {
      let m = Infinity;
      for (let k = 0; k < n; k++) m = Math.min(m, rec[k] + rec[n - 1 - k]);
      rec.push(n - 1 + m);
    }
    expect(rec.map((_, n) => best(n))).toEqual(rec);
    for (const a of CASES) {
      const n = a.length;
      for (const k of [K['randomized-quicksort'], ...SEEDS.map(seeded)]) {
        const t = trace(k, a);
        expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(best(n));
        expect(t.counts.compares, at(a)).toBeLessThanOrEqual(tri(n));
        expect(t.counts.writes, at(a)).toBeLessThanOrEqual(n < 2 ? 0 : (n - 1) * (n + 4));
        expect(t.counts.auxWrites, at(a)).toBe(0);
      }
    }
  });

  it('randomized-quicksort: keys all equal cost n(n − 1)/2 comparisons and (n − 1)(n + 4) writes whatever the seed', () => {
    for (const n of NS) {
      for (const k of [K['randomized-quicksort'], ...SEEDS.map(seeded)]) {
        const t = trace(k, equal(n));
        expect([t.counts.compares, t.counts.writes], `equal n=${n}`).toEqual([tri(n), n < 2 ? 0 : (n - 1) * (n + 4)]);
      }
    }
  });

  it('randomized-quicksort: over 300 seeds the mean is within four standard errors of 2(n + 1)H_n − 4n', () => {
    for (const n of [64, 128, 512]) {
      let h = 0;
      for (let i = 1; i <= n; i++) h += 1 / i;
      const expected = 2 * (n + 1) * h - 4 * n;
      for (const shape of ['sorted', 'reversed', 'random'] as const) {
        const a = input(shape, n, 4242);
        const xs = Array.from({ length: 300 }, (_, s) => trace(seeded(1000 + s), a).counts.compares);
        const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
        const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
        expect(Math.abs(mean - expected), `${shape} n=${n}: mean ${mean}, sd ${sd}`).toBeLessThan((4 * sd) / Math.sqrt(xs.length));
      }
    }
  });

  for (const [id, cutoff] of [['dual-pivot-quicksort', 16], ['blockquicksort', 16], ['ipnsort', 20], ['multi-pivot-quicksort', 3]] as const) {
    it(`${id}: up to ${cutoff} keys insertion by exchanges, writes = 2 × inversions, inversions ≤ comparisons ≤ inversions + n − 1`, () => {
      const small = [...CASES.filter((a) => a.length <= cutoff),
        ...SHAPES.flatMap((shape) => Array.from({ length: cutoff }, (_, i) => i + 1).flatMap((n) => [1, 2].map((s) => input(shape, n, s))))];
      for (const a of small) {
        const t = run(id, a);
        const inv = inversions(a);
        expect(t.counts.writes, at(a)).toBe(2 * inv);
        expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(inv);
        expect(t.counts.compares, at(a)).toBeLessThanOrEqual(inv + Math.max(0, a.length - 1));
      }
    });
  }

  it('the adversaries\' replicas compare exactly as the wasm kernels do', () => {
    for (const id of Object.keys(REPLICA)) {
      for (const shape of SHAPES) {
        for (const n of [0, 1, 2, 5, 16, 17, 40, 100, 257, 300, 512]) {
          const a = input(shape, n, 7 + n);
          expect(REPLICA[id](a.slice(), (x, y) => x - y), `${id} ${shape} n=${n}`).toBe(run(id, a).counts.compares);
        }
      }
    }
  });

  it('dual-pivot-quicksort: keys all equal cost 2(n − 1) comparisons and 8 writes from 17 keys on; never an auxiliary write', () => {
    for (const n of NS.filter((x) => x >= 17)) {
      const t = run('dual-pivot-quicksort', equal(n));
      expect([t.counts.compares, t.counts.writes], `equal n=${n}`).toEqual([2 * (n - 1), 8]);
    }
    for (const a of CASES) expect(run('dual-pivot-quicksort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('dual-pivot-quicksort: with both pivots the smallest keys of every subarray, more than n²/4 comparisons from 65 keys on', () => {
    for (const n of from(65)) {
      const kill = killReplica('dual-pivot-quicksort', n, true);
      const t = run('dual-pivot-quicksort', kill.keys);
      expect(t.counts.compares, `n=${n}`).toBe(kill.compares);
      expect(t.counts.compares, `n=${n}`).toBeGreaterThan((n * n) / 4);
    }
  });

  it('multi-pivot-quicksort: with the three pivots the smallest keys of every subarray, ⌊(n² − 1)/3⌋ comparisons', () => {
    for (const n of from(4)) {
      const kill = killReplica('multi-pivot-quicksort', n, true);
      const t = run('multi-pivot-quicksort', kill.keys);
      expect(t.counts.compares, `n=${n}`).toBe(kill.compares);
      expect(t.counts.compares, `n=${n}`).toBe(Math.floor((n * n - 1) / 3));
    }
    for (const a of CASES) expect(run('multi-pivot-quicksort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('blockquicksort: no auxiliary write up to 257 keys, offsets recorded beyond; an adversary\'s input costs more than n²/4 from 49 keys on', () => {
    for (const a of [...CASES, ...SHAPES.flatMap((shape) => [200, 256, 257].map((n) => input(shape, n, 3)))]) {
      expect(run('blockquicksort', a).counts.auxWrites, at(a)).toBe(0);
    }
    for (const n of [258, 264, 384, 512]) expect(run('blockquicksort', input('random', n, 3)).counts.auxWrites, `n=${n}`).toBeGreaterThan(0);
    for (const n of from(49)) {
      const kill = killReplica('blockquicksort', n, false);
      const t = run('blockquicksort', kill.keys);
      expect(t.counts.compares, `n=${n}`).toBe(kill.compares);
      expect(t.counts.compares, `n=${n}`).toBeGreaterThan((n * n) / 4);
    }
  });

  it('blockquicksort: on random keys its comparisons stay within 10% of quicksort\'s, its writes over 1.5 times theirs', () => {
    let [bc, bw, qc, qw] = [0, 0, 0, 0];
    for (let s = 1; s <= 30; s++) {
      const a = input('random', 512, s);
      const [b, q] = [run('blockquicksort', a).counts, run('quicksort', a).counts];
      bc += b.compares; bw += b.writes; qc += q.compares; qw += q.writes;
    }
    expect(Math.abs(bc / qc - 1)).toBeLessThan(0.1);
    expect(bw / qw).toBeGreaterThan(1.5);
  });

  it('pdqsort: insertion by shifts below 24 keys; on Already sorted n − 1, then 2n to 128 keys, 2n + 6 above, and 4 writes', () => {
    const small = [...CASES.filter((a) => a.length < 24),
      ...SHAPES.flatMap((shape) => [7, 12, 16, 20, 23].flatMap((n) => [1, 2].map((s) => input(shape, n, s))))];
    for (const a of small) {
      const t = run('pdqsort', a);
      const inv = inversions(a);
      expect(t.counts.writes, at(a)).toBe(inv + moving(a));
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(inv);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(inv + Math.max(0, a.length - 1));
    }
    for (let n = 0; n <= 1024; n++) {
      const sorted = run('pdqsort', input('sorted', n, 1));
      const want = n < 24 ? [Math.max(0, n - 1), 0] : [2 * n + (n > 128 ? 6 : 0), 4];
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual(want);
    }
    for (const a of CASES) expect(run('pdqsort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('ipnsort: n − 1 comparisons on Already sorted (and all keys equal), and on Reversed above 20 keys with 2⌊n/2⌋ writes', () => {
    for (let n = 1; n <= 1024; n++) {
      const sorted = run('ipnsort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([n - 1, 0]);
      const same = run('ipnsort', equal(n));
      expect([same.counts.compares, same.counts.writes], `equal n=${n}`).toEqual([n - 1, 0]);
      if (n > 20) {
        const reversed = run('ipnsort', input('reversed', n, 1));
        expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`).toEqual([n - 1, 2 * Math.floor(n / 2)]);
        // one phase, the run search, for an input that is one run; the quicksort follows otherwise
        expect([sorted.marks.phases, reversed.marks.phases], `n=${n}`).toEqual([1, 1]);
        expect(run('ipnsort', input('random', n, n)).marks.phases, `random n=${n}`).toBeGreaterThanOrEqual(2);
      }
    }
    for (const a of CASES) expect(run('ipnsort', a).counts.auxWrites, at(a)).toBe(0);
  });

  it('proportion-extend-sort: no writes on Already sorted, n(n − 1)/2 comparisons there up to 17 keys; never an auxiliary write', () => {
    for (const n of NS) {
      const sorted = run('proportion-extend-sort', input('sorted', n, 1));
      expect(sorted.counts.writes, `sorted n=${n}`).toBe(0);
      if (n <= 17) expect(sorted.counts.compares, `sorted n=${n}`).toBe(tri(n));
    }
    for (const a of CASES) expect(run('proportion-extend-sort', a).counts.auxWrites, at(a)).toBe(0);
  });
});
