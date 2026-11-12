// Every exact count and every hard inequality the mergesort shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a shift or a copy one), Auxiliary writes and the Phase readout. Each kernel runs as its
// plate plays it: its TypeScript kernel (the top-down, bottom-up and natural mergesorts), or the
// wasm kernel its sidecar record maps (src/kernels/sorting-wasm), replayed through the same
// engine. The TypeScript and Rust top-down and natural mergesorts count differently (the DIVERGES
// notes of test/kernels-sorting-wasm.test.ts): every bound here is the TypeScript kernel's,
// since that is the one their plates play.
// The run-length entropy bounds are the cited merge-cost theorems turned into comparisons: a run
// search costs at most one comparison per neighbouring pair, and a merge of a and b keys at most
// a + b − 1, so comparisons ≤ (the search) + (the merge cost). H is computed from the runs the
// kernel itself finds, and each inequality is checked on every case below.
// Asymptotic bounds (O, ~, the authors' stated guarantees) are not checked here; that every kernel
// sorts every shape and size is test/kernels-array.test.ts ("leaves every input shape and size in
// the order its goal promises") and test/kernels-sorting-wasm.test.ts ("leaves every input shape
// and size sorted, as an independent reference does").
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { input, inversions, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const files = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = async (id: string): Promise<ArrayKernel> => files[`../src/kernels/array/${id}.ts`] ?? sidecarKernel(id);
const K = Object.fromEntries(await Promise.all([
  'mergesort-top-down', 'mergesort-bottom-up', 'mergesort-natural', 'timsort', 'powersort', 'peeksort', 'shiverssort',
  'adaptiveshiverssort', 'strand-sort', 'k-way-merge-sort', 'in-place-merge-sort', 'symmerge-based-sort',
  'block-merge-sort', 'grailsort', 'wikisort', 'quadsort', 'glidesort', 'driftsort',
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
/**
 * Inputs made of sorted runs: a random permutation sorted piecewise, each piece at least `min`
 * keys and up to four times that. The run-adaptive bounds are about these.
 */
function runsOf(n: number, seed: number, min: number): number[] {
  const rnd = mulberry32(seed);
  const a = input('random', n, seed);
  for (let lo = 0; lo < n;) {
    const len = Math.min(n - lo, min + Math.floor(rnd() * 3 * min));
    a.splice(lo, len, ...a.slice(lo, lo + len).sort((x, y) => x - y));
    lo += len;
  }
  return a;
}
const RUNS: number[][] = [64, 128, 256, 512, 1000].flatMap((n) => [1, 2, 3, 4, 5, 6, 7, 8]
  .flatMap((s) => [runsOf(n, s, 2), runsOf(n, s, 8), runsOf(n, s, 64)]));
/** Sizes an every-n formula is checked at. */
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
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;
const equal = (n: number) => new Array<number>(n).fill(7);
const lg = (n: number) => Math.log2(n);
const ceilLg = (n: number) => (n < 2 ? 0 : Math.ceil(Math.log2(n)));
const half = (n: number) => 2 * Math.floor(n / 2);
/** Σ_{k<n} ν(k): the 1-bits in the binary forms of 0, 1, …, n − 1. */
const bits = (n: number) => {
  let s = 0;
  for (let k = 1; k < n; k++) for (let x = k; x; x >>= 1) s += x & 1;
  return s;
};
/** Ascending runs: one more than the descents. */
const ascendingRuns = (a: number[]) => (a.length ? 1 + a.filter((x, i) => i > 0 && x < a[i - 1]).length : 0);
/** The runs kit::ascending_run finds: maximal non-descending, or strictly descending (reversed). */
function kitRuns(a: number[]): number[] {
  const out: number[] = [];
  for (let lo = 0; lo < a.length;) {
    let end = lo + 1;
    if (end < a.length) {
      const down = a[end] < a[lo];
      while (end + 1 < a.length && (down ? a[end + 1] < a[end] : a[end + 1] >= a[end])) end++;
      end++;
    }
    out.push(end - lo);
    lo = end;
  }
  return out;
}
/** Weakly ascending runs, the only runs peeksort finds. */
function weakRuns(a: number[]): number[] {
  const out: number[] = [];
  let lo = 0;
  for (let i = 1; i <= a.length; i++) if (i === a.length || a[i] < a[i - 1]) { out.push(i - lo); lo = i; }
  return out;
}
/** The entropy of run lengths r_i: Σ (r_i/n) lg(n/r_i). */
const entropy = (runs: number[]) => {
  const n = runs.reduce((s, r) => s + r, 0);
  return runs.reduce((s, r) => s + (r / n) * lg(n / r), 0);
};
/** Keys merged by bottom-up mergesort's passes, and the shorter run of each of its merges. */
function bottomUp(n: number): { keys: number; shorter: number } {
  let [keys, shorter] = [0, 0];
  for (let w = 1; w < n; w *= 2) {
    for (let lo = 0; lo < n - w; lo += 2 * w) {
      const hi = Math.min(lo + 2 * w, n);
      keys += hi - lo;
      shorter += Math.min(w, hi - lo - w);
    }
  }
  return { keys, shorter };
}
/** Array writes of the four-way split: every subarray of two or more keys is written back once. */
const fourWay = (n: number): number => {
  if (n < 2) return 0;
  const p = Math.min(4, n);
  let s = n;
  for (let i = 0; i < p; i++) s += fourWay(Math.floor(((i + 1) * n) / p) - Math.floor((i * n) / p));
  return s;
};
/** The phases a run entered, by name, in order. */
const phases = (t: Trace) => {
  const out: string[] = [];
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.phase) out.push(t.labels[t.events[3 * e + 1]]);
  return out;
};
/** Insertion by exchanges: array writes = 2 × inversions, inversions ≤ comparisons ≤ inversions + n − 1. */
function insertionAlone(id: string, upTo: number) {
  const small = [...CASES.filter((a) => a.length <= upTo),
    ...SHAPES.flatMap((shape) => [7, 8, Math.max(9, upTo - 1), upTo].flatMap((n) => [1, 2].map((s) => input(shape, n, s))))];
  for (const a of small) {
    const t = run(id, a);
    const inv = inversions(a);
    expect(t.counts.writes, `${id} ${at(a)}`).toBe(2 * inv);
    expect(t.counts.compares, `${id} ${at(a)}`).toBeGreaterThanOrEqual(inv);
    expect(t.counts.compares, `${id} ${at(a)}`).toBeLessThanOrEqual(inv + Math.max(0, a.length - 1));
  }
}

describe('sorting/mergesort: exact bounds against counted runs', () => {
  it('mergesort-top-down: on every input array writes = auxiliary writes = n⌈lg n⌉ − 2^⌈lg n⌉ + n', () => {
    const keys = (n: number) => (n < 2 ? 0 : n * ceilLg(n) - 2 ** ceilLg(n) + n);
    for (const a of CASES) {
      const c = run('mergesort-top-down', a).counts;
      expect([c.writes, c.auxWrites], at(a)).toEqual([keys(a.length), keys(a.length)]);
    }
    for (const n of ALL) {
      const c = run('mergesort-top-down', input('random', n, n)).counts;
      expect([c.writes, c.auxWrites], `n=${n}`).toEqual([keys(n), keys(n)]);
    }
    for (const n of POW2) expect(run('mergesort-top-down', input('random', n, 3)).counts.writes, `n=${n}`).toBe(n * lg(n));
  });

  it('mergesort-top-down: comparisons between the 1-bits of 0..n − 1 (Reversed) and n⌈lg n⌉ − 2^⌈lg n⌉ + 1, both reached', () => {
    const worst = (n: number) => (n < 2 ? 0 : n * ceilLg(n) - 2 ** ceilLg(n) + 1);
    for (const a of CASES) {
      const c = run('mergesort-top-down', a).counts;
      expect(c.compares, at(a)).toBeGreaterThanOrEqual(bits(a.length));
      expect(c.compares, at(a)).toBeLessThanOrEqual(worst(a.length));
      // one comparison fewer than the keys of each of the n − 1 merges, at most
      expect(c.compares, at(a)).toBeLessThanOrEqual(c.writes - Math.max(0, a.length - 1));
    }
    for (let n = 0; n <= 8; n++) {
      const most = permutations(n).reduce((m, p) => Math.max(m, run('mergesort-top-down', p).counts.compares), 0);
      expect(most, `n=${n}`).toBe(worst(n));
    }
    for (const n of ALL) {
      const reversed = run('mergesort-top-down', input('reversed', n, 1)).counts.compares;
      expect(reversed, `reversed n=${n}`).toBe(bits(n));
    }
    for (const n of POW2) {
      expect(counts('mergesort-top-down', input('sorted', n, 1))[0], `sorted n=${n}`).toBe((n * lg(n)) / 2);
      expect(counts('mergesort-top-down', input('reversed', n, 1))[0], `reversed n=${n}`).toBe((n * lg(n)) / 2);
    }
    // neither ½ n⌈lg n⌉ nor ½ n⌊lg n⌋ is a lower bound: Reversed makes 2 comparisons at 3 keys
    // (not 3) and 13 at 9 keys (not 13.5)
    expect(counts('mergesort-top-down', [3, 2, 1])[0]).toBe(2);
    expect(counts('mergesort-top-down', input('reversed', 9, 1))[0]).toBe(13);
  });

  it('mergesort-bottom-up: array writes = auxiliary writes, the keys of every merge: n lg n at powers of two, at most n⌈lg n⌉', () => {
    for (const a of [...CASES, ...ALL.map((n) => input('random', n, n))]) {
      const c = run('mergesort-bottom-up', a).counts;
      const n = a.length;
      expect([c.writes, c.auxWrites], at(a)).toEqual([bottomUp(n).keys, bottomUp(n).keys]);
      expect(c.writes, at(a)).toBeLessThanOrEqual(n * ceilLg(n));
    }
    for (const n of POW2) expect(run('mergesort-bottom-up', input('random', n, 5)).counts.writes, `n=${n}`).toBe(n * lg(n));
    // not top-down's count off the powers of two
    expect(counts('mergesort-bottom-up', [5, 4, 3, 2, 1])[1]).toBe(13);
    expect(counts('mergesort-top-down', [5, 4, 3, 2, 1])[1]).toBe(12);
    for (const n of ALL) {
      expect(bottomUp(n).keys, `n=${n}`).toBeGreaterThanOrEqual(counts('mergesort-top-down', input('random', n, 1))[1]);
    }
    for (const n of [40, 72, 136, 264]) {
      expect(counts('mergesort-bottom-up', input('random', n, 1))[1], `n=${n}`)
        .toBeGreaterThan(counts('mergesort-top-down', input('random', n, 1))[1]);
    }
    expect(counts('mergesort-bottom-up', input('random', 264, 1))[1]).toBe(2336);
    expect(counts('mergesort-top-down', input('random', 264, 1))[1]).toBe(2128);
  });

  it('mergesort-bottom-up: comparisons between the shorter run of every merge (Reversed) and array writes − (n − 1), both reached', () => {
    for (const a of CASES) {
      const c = run('mergesort-bottom-up', a).counts;
      expect(c.compares, at(a)).toBeGreaterThanOrEqual(bottomUp(a.length).shorter);
      expect(c.compares, at(a)).toBeLessThanOrEqual(c.writes - Math.max(0, a.length - 1));
    }
    for (let n = 0; n <= 8; n++) {
      const most = permutations(n).reduce((m, p) => Math.max(m, run('mergesort-bottom-up', p).counts.compares), 0);
      expect(most, `n=${n}`).toBe(n < 2 ? 0 : bottomUp(n).keys - (n - 1));
    }
    for (const n of ALL) expect(counts('mergesort-bottom-up', input('reversed', n, 1))[0], `n=${n}`).toBe(bottomUp(n).shorter);
    for (const n of POW2) expect(counts('mergesort-bottom-up', input('sorted', n, 1))[0], `n=${n}`).toBe((n * lg(n)) / 2);
  });

  it('mergesort-natural: Already sorted is one run, n − 1 comparisons and no write; writes = auxiliary writes ≤ n⌈lg r⌉ for r runs', () => {
    for (const n of ALL) {
      expect(counts('mergesort-natural', input('sorted', n, 1)), `sorted n=${n}`).toEqual([Math.max(0, n - 1), 0, 0]);
      expect(counts('mergesort-natural', equal(n)), `equal n=${n}`).toEqual([Math.max(0, n - 1), 0, 0]);
    }
    for (const a of [...CASES, ...RUNS]) {
      const c = run('mergesort-natural', a).counts;
      expect(c.writes, at(a)).toBe(c.auxWrites);
      expect(c.writes, at(a)).toBeLessThanOrEqual(a.length * ceilLg(ascendingRuns(a)));
    }
  });

  it('mergesort-natural: on Reversed the merges and writes of bottom-up mergesort, plus n − 1 comparisons per scan', () => {
    for (const n of ALL) {
      const [nat, bu] = [counts('mergesort-natural', input('reversed', n, 1)), counts('mergesort-bottom-up', input('reversed', n, 1))];
      expect(nat.slice(1), `n=${n}`).toEqual(bu.slice(1));
    }
    for (const n of POW2) {
      expect(counts('mergesort-natural', input('reversed', n, 1))[0], `n=${n}`).toBe((n - 1) * (lg(n) + 1) + (n * lg(n)) / 2);
    }
  });

  it('mergesort-natural: on Random permutation at 512 keys its rescans cost 1.8 to 2.4 times the comparisons of top-down mergesort', () => {
    for (let s = 1; s <= 20; s++) {
      const a = input('random', 512, s);
      const ratio = counts('mergesort-natural', a)[0] / counts('mergesort-top-down', a)[0];
      expect(ratio, `seed ${s}`).toBeGreaterThan(1.8);
      expect(ratio, `seed ${s}`).toBeLessThan(2.4);
    }
  });

  for (const id of ['timsort', 'powersort', 'shiverssort', 'adaptiveshiverssort']) {
    it(`${id}: n − 1 comparisons on Already sorted and keys all equal, with no write; Reversed adds 2⌊n/2⌋ writes; no auxiliary write`, () => {
      for (const n of ALL) {
        const one = [Math.max(0, n - 1), 0, 0];
        expect(counts(id, input('sorted', n, 1)), `sorted n=${n}`).toEqual(one);
        expect(counts(id, equal(n)), `equal n=${n}`).toEqual(one);
        expect(counts(id, input('reversed', n, 1)), `reversed n=${n}`).toEqual([Math.max(0, n - 1), half(n), 0]);
      }
    });

    const from = id === 'timsort' || id === 'powersort' ? 64 : 3;
    it(`${id}: Organ pipe from ${from} keys on is two runs, 2(n − 1) comparisons and ⌊(n − 1)/2⌋ auxiliary writes`, () => {
      for (const n of ALL.filter((x) => x >= from)) {
        const c = run(id, input('organ-pipe', n, 1)).counts;
        expect([c.compares, c.auxWrites], `n=${n}`).toEqual([2 * (n - 1), Math.floor((n - 1) / 2)]);
      }
    });
  }

  for (const id of ['shiverssort', 'adaptiveshiverssort']) {
    it(`${id}: comparisons ≥ n − 1 + auxiliary writes: the run search, and at least the shorter run of every merge, the run the buffer holds`, () => {
      for (const a of [...CASES, ...RUNS]) {
        const c = run(id, a).counts;
        expect(c.compares, at(a)).toBeGreaterThanOrEqual(Math.max(0, a.length - 1) + c.auxWrites);
      }
    });
  }

  it('adaptiveshiverssort: comparisons ≤ n − 1 + n(H + 2.478), H the entropy of its run lengths (Jugé\'s merge cost nH + Δn)', () => {
    for (const a of [...CASES, ...RUNS].filter((x) => x.length > 0)) {
      const n = a.length;
      expect(run('adaptiveshiverssort', a).counts.compares, at(a)).toBeLessThanOrEqual(n - 1 + n * (entropy(kitRuns(a)) + 2.478));
    }
  });

  it('powersort: with every run at least minrun long, comparisons ≤ n − 1 + n(H + 2) (Munro and Wild\'s merge cost)', () => {
    const long = [64, 128, 256, 512, 1000, 2000].flatMap((n) => Array.from({ length: 20 }, (_, s) => runsOf(n, s + 1, 64)));
    for (const a of [...long, ...[128, 256, 512].flatMap((n) => [input('organ-pipe', n, 1), input('sorted', n, 1)])]) {
      // from 64 keys on minrun is at most 64, so no run but the last is extended by insertion
      expect(Math.min(...kitRuns(a).slice(0, -1), 64), at(a)).toBe(64);
      const n = a.length;
      expect(run('powersort', a).counts.compares, at(a)).toBeLessThanOrEqual(n - 1 + n * (entropy(kitRuns(a)) + 2));
    }
  });

  it('timsort: on Random permutation at 512 keys within 10% of top-down mergesort\'s comparisons; Few distinct keys gallops', () => {
    for (let s = 1; s <= 20; s++) {
      const a = input('random', 512, s);
      expect(Math.abs(counts('timsort', a)[0] / counts('mergesort-top-down', a)[0] - 1), `seed ${s}`).toBeLessThan(0.1);
    }
    for (const s of [4242, 1, 2, 3]) expect(phases(run('timsort', input('few-unique', 512, s))), `seed ${s}`).toContain('galloping');
  });

  it('peeksort: 2(n − 1) comparisons and no write on Already sorted; Reversed ½ n lg n + n, n lg n writes, ½ n lg n auxiliary writes', () => {
    for (const n of ALL) {
      expect(counts('peeksort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([2 * Math.max(0, n - 1), 0, 0]);
      expect(counts('peeksort', equal(n)), `equal n=${n}`).toEqual([2 * Math.max(0, n - 1), 0, 0]);
    }
    for (const n of POW2.filter((x) => x > 1)) {
      expect(counts('peeksort', input('reversed', n, 1)), `n=${n}`).toEqual([(n * lg(n)) / 2 + n, n * lg(n), (n * lg(n)) / 2]);
    }
  });

  it('peeksort: comparisons ≤ 2(n − 1) + n(H + 2), H the entropy of its weakly ascending run lengths', () => {
    for (const a of [...CASES, ...RUNS].filter((x) => x.length > 0)) {
      const n = a.length;
      expect(run('peeksort', a).counts.compares, at(a)).toBeLessThanOrEqual(2 * (n - 1) + n * (entropy(weakRuns(a)) + 2));
    }
  });

  it('strand-sort: n array writes on every input; one strand on Already sorted; Reversed (n − 1)(n + 2)/2 comparisons, the most of any permutation', () => {
    for (const a of CASES.filter((x) => x.length >= 2)) expect(run('strand-sort', a).counts.writes, at(a)).toBe(a.length);
    for (const n of ALL.filter((x) => x >= 2 && x <= 512)) {
      expect(counts('strand-sort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([n - 1, n, 3 * n]);
      expect(counts('strand-sort', equal(n)), `equal n=${n}`).toEqual([n - 1, n, 3 * n]);
      expect(counts('strand-sort', input('reversed', n, 1)), `reversed n=${n}`).toEqual([((n - 1) * (n + 2)) / 2, n, n * (n + 2)]);
    }
    for (let n = 2; n <= 8; n++) {
      const most = permutations(n).reduce((m, p) => Math.max(m, run('strand-sort', p).counts.compares), 0);
      expect(most, `n=${n}`).toBe(((n - 1) * (n + 2)) / 2);
    }
  });

  it('k-way-merge-sort: the same array writes on every input of n keys, n per level of the four-way split: n⌈(lg n)/2⌉ at powers of two', () => {
    for (const a of [...CASES, ...SHAPES.flatMap((shape) => [100, 257, 512].map((n) => input(shape, n, 4)))]) {
      expect(run('k-way-merge-sort', a).counts.writes, at(a)).toBe(fourWay(a.length));
    }
    for (const n of POW2) expect(run('k-way-merge-sort', input('random', n, 9)).counts.writes, `n=${n}`).toBe(n * Math.ceil(lg(n) / 2));
  });

  for (const id of ['in-place-merge-sort', 'symmerge-based-sort', 'block-merge-sort', 'grailsort']) {
    it(`${id}: no auxiliary write on any input; every array write is half of an exchange`, () => {
      for (const a of [...CASES, ...SHAPES.flatMap((shape) => [200, 256, 512].map((n) => input(shape, n, 5)))]) {
        const c = run(id, a).counts;
        expect([c.auxWrites, c.writes], at(a)).toEqual([0, 2 * c.swaps]);
      }
    });
  }

  it('in-place-merge-sort: reorders two equal keys (not stable); Already sorted costs more comparisons than Reversed from 3 keys on', () => {
    const r = S.run('in-place-merge-sort', [1, 1], { seed: seedOf([1, 1]) });
    expect([...r.tags]).toEqual([1, 0]);
    for (const n of ALL.filter((x) => x >= 3)) {
      expect(counts('in-place-merge-sort', input('sorted', n, 1))[0], `n=${n}`)
        .toBeGreaterThan(counts('in-place-merge-sort', input('reversed', n, 1))[0]);
    }
  });

  it('symmerge-based-sort: insertion alone up to 20 keys; Already sorted no write and fewer than 4n/3 comparisons up to 1,024 keys', () => {
    insertionAlone('symmerge-based-sort', 20);
    for (const n of ALL.filter((x) => x >= 1)) {
      const [c, w] = counts('symmerge-based-sort', input('sorted', n, 1));
      expect(w, `n=${n}`).toBe(0);
      expect(c, `n=${n}`).toBeLessThan((4 * n) / 3);
    }
    expect(counts('symmerge-based-sort', input('sorted', 512, 1))[0]).toBe(637);
  });

  it('block-merge-sort: insertion alone up to 16 keys; Already sorted no write; Few distinct keys merges by rotations', () => {
    insertionAlone('block-merge-sort', 16);
    for (const n of ALL) expect(counts('block-merge-sort', input('sorted', n, 1))[1], `n=${n}`).toBe(0);
    for (let n = 17; n <= 512; n++) {
      expect(phases(run('block-merge-sort', input('few-unique', n, 4242))), `n=${n}`).toContain('not enough distinct values: rotation merges');
    }
  });

  it('grailsort: insertion alone up to 16 keys; keys all equal no write; Few distinct keys two phases, ending in the lazy stable sort', () => {
    insertionAlone('grailsort', 16);
    for (const n of ALL) expect(counts('grailsort', equal(n))[1], `n=${n}`).toBe(0);
    for (let n = 17; n <= 512; n++) {
      const p = phases(run('grailsort', input('few-unique', n, 4242)));
      expect([p.length, p[1]], `n=${n}`).toEqual([2, 'not enough distinct keys: lazy stable sort']);
    }
  });

  it('wikisort: insertion alone up to 16 keys; n − 1 comparisons and no write on Already sorted to 1,025 keys; Reversed no auxiliary write', () => {
    insertionAlone('wikisort', 16);
    for (const n of [...ALL, 1025]) {
      const one = [Math.max(0, n - 1), 0, 0];
      expect(counts('wikisort', input('sorted', n, 1)), `sorted n=${n}`).toEqual(one);
      expect(counts('wikisort', equal(n)), `equal n=${n}`).toEqual(one);
      expect(counts('wikisort', input('reversed', n, 1))[2], `reversed n=${n}`).toBe(0);
    }
  });

  it('quadsort: insertion alone below 32 keys; at multiples of 32 Already sorted 5n/4 − 1 comparisons, Reversed 5n/4 − 2 and n writes', () => {
    insertionAlone('quadsort', 31);
    for (let n = 32; n <= 1024; n += 32) {
      expect(counts('quadsort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([(5 * n) / 4 - 1, 0, 0]);
      expect(counts('quadsort', input('reversed', n, 1)), `reversed n=${n}`).toEqual([(5 * n) / 4 - 2, n, 0]);
    }
  });

  for (const [id, from] of [['glidesort', 33], ['driftsort', 21]] as const) {
    it(`${id}: from ${from} keys on n − 1 comparisons and no write on Already sorted, Reversed adds 2⌊n/2⌋ writes`, () => {
      for (const n of ALL.filter((x) => x >= from)) {
        expect(counts(id, input('sorted', n, 1)), `sorted n=${n}`).toEqual([n - 1, 0, 0]);
        expect(counts(id, equal(n)), `equal n=${n}`).toEqual([n - 1, 0, 0]);
        expect(counts(id, input('reversed', n, 1)), `reversed n=${n}`).toEqual([n - 1, half(n), 0]);
      }
    });
  }

  it('driftsort: insertion alone up to 20 keys', () => insertionAlone('driftsort', 20));
});
