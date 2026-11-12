// Every exact count and every hard inequality the priority-queue shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the engines count for the plate. The seven sorts are array-engine plates: Comparisons,
// Array writes (an exchange is two writes, a shift or a copy one), Auxiliary writes and the Phase
// readout. Heapsort plays its TypeScript kernel (src/kernels/array/heapsort.ts); the other six
// play the wasm kernel their sidecar record maps (src/kernels/sorting-wasm), replayed through the
// same engine. The two priority queues are tree-engine plates (src/engines/tree/trace.ts): Key
// comparisons, Links written, Array reads / writes and the Cost per operation readouts, each
// operation's counts taken between its begin() and the next one's.
// Where a statement compares bottom-up heapsort with classical heapsort's heaps, the classical
// side is the Rust heapsort, which counts exactly like the TypeScript kernel the heapsort plate
// plays (test/kernels-sorting-wasm.test.ts, "counts exactly like the Rust kernel heapsort").
// Asymptotic bounds (O, ~, about, Wegener's 1.5 n log n + O(n), d log_d n per removal) are not
// checked here; that every kernel sorts every shape and size is test/kernels-array.test.ts
// ("leaves every input shape and size in the order its goal promises") and
// test/kernels-sorting-wasm.test.ts ("leaves every input shape and size sorted, as an independent
// reference does"), and that the two queues keep their invariants is test/kernels-tree.test.ts.
import { describe, expect, it } from 'vitest';
import { apply, EVENT_CAP, input, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { sidecarKernel, wasmKernel } from '../src/kernels/sorting-wasm/_adapter';
import {
  costOf, SHAPES as TREE_SHAPES, trace as treeTrace, workload, type Counts as TreeCounts, type Trace as TreeTrace,
} from '../src/engines/tree/trace';
import { kernel as binaryHeap } from '../src/kernels/tree/binary-heap';
import { kernel as binomialQueue } from '../src/kernels/tree/binomial-queue';

const files = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = async (id: string): Promise<ArrayKernel> => files[`../src/kernels/array/${id}.ts`] ?? sidecarKernel(id);
const K = Object.fromEntries(await Promise.all([
  'heapsort', 'bottom-up-heapsort', 'weak-heapsort', 'd-ary-heapsort', 'smoothsort', 'poplar-sort', 'tournament-sort',
].map(async (id) => [id, await kernelOf(id)] as const)));
const S = await loadSorting();
/** The Rust heapsort, played through the same adapter: classical sift-down, step for step. */
const rustHeapsort = wasmKernel(S, 'heapsort');

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
/** Every plate shape at every size to 300 and at the plate's largest, seeded by the size. */
const SWEEP: number[][] = SHAPES.flatMap((shape) => [...Array.from({ length: 301 }, (_, n) => n), 511, 512]
  .map((n) => input(shape, n, n)));
/** Sizes an every-n formula is checked at. */
const ALL = Array.from({ length: 1025 }, (_, n) => n);
const POW2 = Array.from({ length: 11 }, (_, k) => 2 ** k);
const SEEDS = [4242, 1, 2, 3, 4, 5];

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
const floorLg = (n: number) => (n < 1 ? 0 : Math.floor(Math.log2(n)));
const ceilLg = (n: number) => (n < 2 ? 0 : Math.ceil(Math.log2(n)));
/** ν(n): the 1-bits of n. */
const nu = (n: number) => { let s = 0; for (let x = n; x; x >>= 1) s += x & 1; return s; };
/** e₂(n): the exponent of 2 in n (its trailing zero bits). */
const e2 = (n: number) => { let s = 0; for (let x = n; x && !(x & 1); x >>= 1) s++; return s; };
/** The trailing 1-bits of n. */
const ones = (n: number) => { let s = 0; for (let x = n; x & 1; x >>= 1) s++; return s; };
/** Σ_{k<n} ν(k): the 1-bits in the binary forms of 0, 1, …, n − 1. */
const bits = (n: number) => { let s = 0; for (let k = 1; k < n; k++) s += nu(k); return s; };
/** Σ_{m=from}^{to} ⌊lg m⌋. */
const lgSum = (from: number, to: number) => { let s = 0; for (let m = Math.max(1, from); m <= to; m++) s += floorLg(m); return s; };
/** The weak-heapsort kernel's worst case: (n − 1)⌈lg n⌉ − 2^⌈lg n⌉ + n comparisons. */
const weakWorst = (n: number) => (n < 2 ? 0 : (n - 1) * ceilLg(n) - 2 ** ceilLg(n) + n);
/** Comparisons and array writes before the k-th event of `op` (the whole run when there are fewer). */
function before(t: Trace, op: number, k: number): { compares: number; writes: number } {
  const c = { compares: 0, writes: 0 };
  let seen = 0;
  for (let e = 0; e < t.length; e++) {
    const o = t.events[3 * e];
    if (o === op && ++seen === k) break;
    if (o === OP.compare) c.compares++;
    else if (o === OP.swap) c.writes += 2;
    else if (o === OP.write) c.writes++;
  }
  return c;
}
const comparesBefore = (t: Trace, op: number, k: number) => before(t, op, k).compares;
/** The array after each extraction step: the state at every range [end, n − 1] it marks, by end. */
function heaps(t: Trace): Map<number, string> {
  const a = t.input.slice();
  const aux: number[] = [];
  const out = new Map<number, string>();
  for (let e = 0; e < t.length; e++) {
    apply(a, aux, t.events, e);
    const [op, i, j] = [t.events[3 * e], t.events[3 * e + 1], t.events[3 * e + 2]];
    if (op === OP.range && i > 0 && j === a.length - 1) out.set(i, a.join(','));
  }
  return out;
}
/** Stable means equal keys leave in their input order: keys carry their position as a tag. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const items = keys.map((k, i) => 1000 * k + i);
  const t = trace(K[id], items, 0, EVENT_CAP, (x, y) => Math.floor(x / 1000) < Math.floor(y / 1000));
  return t.output.some((x, i) => i > 0 && Math.floor(x / 1000) === Math.floor(t.output[i - 1] / 1000) && x < t.output[i - 1]);
}

// ---- the tree-engine queues ---------------------------------------------------------------------

/** The counts each operation of a kind spent, in order. */
function perOp(t: TreeTrace, kind: string): TreeCounts[] {
  const out: TreeCounts[] = [];
  t.ops.forEach((op, i) => {
    if (op.kind !== kind) return;
    const end = i + 1 < t.ops.length ? t.ops[i + 1].c : t.counts;
    const d = { ...end };
    for (const f of Object.keys(d) as (keyof TreeCounts)[]) d[f] = end[f] - op.c[f];
    out.push(d);
  });
  return out;
}
/** A workload of exactly these keys, inserted in this order. */
const keysOf = (keys: number[]) => ({ ...workload('keys', 'random', keys.length, 1), keys });
const TREE_SIZES = [1, 2, 3, 7, 8, 16, 31, 61, 128, 255];
/** Every key order up to six keys, and every plate input shape at the sizes above and two seeds. */
const QUEUE_CASES = [
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => permutations(n)).map(keysOf),
  ...TREE_SHAPES.keys.flatMap(({ value }) => TREE_SIZES.flatMap((n) => [1, 4242].map((s) => workload('keys', value, n, s + n)))),
];
const queueRun = (k: typeof binaryHeap, w: ReturnType<typeof workload>): TreeTrace => {
  const t = treeTrace(k, w);
  expect(t.truncated).toBe(false);
  return t;
};
const accesses = (c: TreeCounts) => c.reads + c.writes;

describe('sorting/priority-queues: exact bounds against counted runs', () => {
  it('heapsort: Floyd\'s construction makes at most 2n − 2ν(n) − e₂(n) comparisons, reached by a permutation of every size up to 8', () => {
    // the plate's heapsort marks the whole array before it builds and again after the first
    // exchange: the construction is everything before the second mark
    const floyd = (n: number) => (n < 1 ? 0 : 2 * n - 2 * nu(n) - e2(n));
    for (const a of [...CASES, ...SWEEP]) {
      const build = comparesBefore(run('heapsort', a), OP.range, 2);
      expect(build, at(a)).toBeLessThanOrEqual(floyd(a.length));
      expect(build, at(a)).toBeLessThan(2 * a.length || 1);
    }
    for (let n = 1; n <= 8; n++) {
      const most = permutations(n).reduce((m, p) => Math.max(m, comparesBefore(run('heapsort', p), OP.range, 2)), 0);
      expect(most, `n=${n}`).toBe(floyd(n));
    }
    // Reversed is already a max-heap: one or two comparisons per inner node, n − 1 in all, no write
    for (const n of ALL.filter((x) => x >= 1)) {
      expect(before(run('heapsort', input('reversed', n, 1)), OP.range, 2), `reversed n=${n}`)
        .toEqual({ compares: n - 1, writes: n < 2 ? 0 : 2 }); // 2: the first extraction's exchange
    }
  });

  it('heapsort: at most 2n⌊lg n⌋ comparisons; keys all equal 3n − 6 and 2(n − 1) writes; every write half of an exchange', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const c = run('heapsort', a).counts;
      expect(c.compares, at(a)).toBeLessThanOrEqual(2 * a.length * floorLg(a.length));
      expect([c.writes, c.auxWrites], at(a)).toEqual([2 * c.swaps, 0]);
    }
    for (const n of ALL.filter((x) => x >= 3)) {
      expect(counts('heapsort', equal(n)), `equal n=${n}`).toEqual([3 * n - 6, 2 * (n - 1), 0]);
    }
  });

  it('heapsort: reorders the two keys of [1, 1] (not stable); Already sorted costs more than Random permutation at 512 keys', () => {
    expect(reordersEqualKeys('heapsort', [1, 1])).toBe(true);
    const sorted = counts('heapsort', input('sorted', 512, 1))[0];
    expect([counts('heapsort', input('random', 512, 4242))[0], sorted]).toEqual([7604, 7958]);
    for (const s of SEEDS) expect(counts('heapsort', input('random', 512, s))[0], `seed ${s}`).toBeLessThan(sorted);
    expect(counts('heapsort', input('random', 512, 4242))[1]).toBe(8288);
  });

  it('bottom-up-heapsort: after every step its heap is classical heapsort\'s, on every input', () => {
    for (const a of CASES) {
      const mine = heaps(run('bottom-up-heapsort', a));
      const classical = heaps(trace(rustHeapsort, a));
      expect(mine.size, at(a)).toBe(Math.max(0, a.length - 1));
      expect([...mine.entries()], at(a)).toEqual([...mine.keys()].map((end) => [end, classical.get(end)]));
    }
  });

  it('bottom-up-heapsort: never fewer than Σ_{m=2}^{n−1} ⌊lg m⌋ comparisons; Random permutation at 512 keys below n lg n + n', () => {
    // each extraction walks to a leaf of the m-key heap (⌊lg m⌋ − 1 comparisons at least) and
    // climbs back with one comparison at least
    for (const a of [...CASES, ...SWEEP]) {
      expect(run('bottom-up-heapsort', a).counts.compares, at(a)).toBeGreaterThanOrEqual(lgSum(2, a.length - 1));
    }
    for (const s of SEEDS) {
      const c = counts('bottom-up-heapsort', input('random', 512, s))[0];
      expect(c, `seed ${s}`).toBeLessThan(512 * 9 + 512);
      expect(c, `seed ${s}`).toBeLessThan(counts('heapsort', input('random', 512, s))[0] * 0.65);
    }
    expect([counts('bottom-up-heapsort', input('random', 512, 4242))[0], counts('bottom-up-heapsort', input('sorted', 512, 1))[0]])
      .toEqual([4764, 4771]);
  });

  it('weak-heapsort: builds with exactly n − 1 comparisons; at most (n − 1)⌈lg n⌉ − 2^⌈lg n⌉ + n, reached', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const t = run('weak-heapsort', a);
      if (a.length >= 2) expect(comparesBefore(t, OP.phase, 2), at(a)).toBe(a.length - 1);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(weakWorst(a.length));
    }
    // keys all equal never exchange, so every path runs along left children: ⌈lg m⌉ joins for m keys
    for (const n of ALL) expect(counts('weak-heapsort', equal(n))[0], `equal n=${n}`).toBe(weakWorst(n));
    for (let n = 0; n <= 8; n++) {
      const most = permutations(n).reduce((m, p) => Math.max(m, run('weak-heapsort', p).counts.compares), 0);
      expect(most, `n=${n}`).toBe(weakWorst(n));
    }
    // one more than (n − 1)⌈lg n⌉ − 2^⌈lg n⌉ + n − 1: Reversed [4, 3, 2, 1] makes 6, not 5
    expect(counts('weak-heapsort', [4, 3, 2, 1])[0]).toBe(6);
  });

  it('weak-heapsort: the worst case is at most n lg n + 0.09n; fewer comparisons than bottom-up heapsort on Random permutation', () => {
    for (let n = 1; n <= 100_000; n++) expect(weakWorst(n), `n=${n}`).toBeLessThanOrEqual(n * lg(n) + 0.09 * n);
    for (const s of SEEDS) {
      expect(counts('weak-heapsort', input('random', 512, s))[0], `seed ${s}`)
        .toBeLessThan(counts('bottom-up-heapsort', input('random', 512, s))[0]);
    }
    expect([counts('weak-heapsort', input('random', 512, 4242))[0], weakWorst(512)]).toEqual([4358, 4599]);
  });

  it('d-ary-heapsort: builds Reversed with n − 1 comparisons and no write; keys all equal (n − 1) + Σ min(3, m − 1)', () => {
    for (const n of ALL.filter((x) => x >= 2)) {
      expect(before(run('d-ary-heapsort', input('reversed', n, 1)), OP.phase, 2), `reversed n=${n}`)
        .toEqual({ compares: n - 1, writes: 0 });
      let sum = n - 1;
      for (let m = 1; m <= n - 1; m++) sum += Math.min(3, m - 1);
      expect(counts('d-ary-heapsort', equal(n)), `equal n=${n}`).toEqual([sum, 2 * (n - 1), 0]);
    }
    for (const a of [...CASES, ...SWEEP]) {
      const c = run('d-ary-heapsort', a).counts;
      expect([c.writes, c.auxWrites], at(a)).toEqual([2 * c.swaps, 0]);
    }
  });

  it('d-ary-heapsort: fewer array writes than heapsort on Random permutation at 512 keys', () => {
    for (const s of SEEDS) {
      expect(counts('d-ary-heapsort', input('random', 512, s))[1], `seed ${s}`)
        .toBeLessThan(counts('heapsort', input('random', 512, s))[1]);
    }
    expect(counts('d-ary-heapsort', input('random', 512, 4242)).slice(0, 2)).toEqual([7495, 5832]);
  });

  it('smoothsort: Already sorted and keys all equal cost fewer than 4n comparisons and no write', () => {
    for (const n of ALL.filter((x) => x >= 1)) {
      for (const a of [input('sorted', n, 1), equal(n)]) {
        const [c, w, x] = counts('smoothsort', a);
        expect(c, `n=${n}`).toBeLessThan(4 * n);
        expect([w, x], `n=${n}`).toEqual([0, 0]);
      }
    }
    expect(counts('smoothsort', input('sorted', 512, 1))[0]).toBe(2007);
  });

  it('smoothsort: Nearly sorted to Random permutation at 128 keys; on Random at 512 more comparisons than heapsort', () => {
    expect([counts('smoothsort', input('nearly-sorted', 128, 4242))[0], counts('smoothsort', input('random', 128, 4242))[0]])
      .toEqual([499, 2248]);
    for (const s of SEEDS) {
      expect(counts('smoothsort', input('random', 512, s))[0], `seed ${s}`)
        .toBeGreaterThan(counts('heapsort', input('random', 512, s))[0]);
    }
    expect(counts('smoothsort', input('random', 512, 4242))[0]).toBe(12870);
  });

  it('poplar-sort: Already sorted and keys all equal: no write, ½ n lg n comparisons when n is a power of two', () => {
    for (const n of ALL) {
      for (const a of [input('sorted', n, 1), equal(n)]) expect(counts('poplar-sort', a).slice(1), `n=${n}`).toEqual([0, 0]);
    }
    for (const n of POW2) {
      expect(counts('poplar-sort', input('sorted', n, 1))[0], `sorted n=${n}`).toBe((n * lg(n)) / 2);
      expect(counts('poplar-sort', equal(n))[0], `equal n=${n}`).toBe((n * lg(n)) / 2);
    }
  });

  it('poplar-sort against smoothsort: fewer comparisons on Already sorted at 128 keys, more at 512; fewer on Nearly sorted at 128', () => {
    const both = (shape: 'sorted' | 'nearly-sorted', n: number, s = 4242) => ['poplar-sort', 'smoothsort']
      .map((id) => counts(id, input(shape, n, s))[0]);
    expect(both('sorted', 128)).toEqual([448, 477]);
    expect(both('sorted', 512)).toEqual([2304, 2007]);
    expect(both('nearly-sorted', 128)).toEqual([462, 499]);
    for (const s of SEEDS) {
      const [p, m] = both('nearly-sorted', 128, s);
      expect(p, `seed ${s}`).toBeLessThan(m);
    }
  });

  it('tournament-sort: the first tournament n − 1 comparisons, each replay at most ⌈lg n⌉; exactly n array writes', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const t = run('tournament-sort', a);
      const n = a.length;
      // every output is one write; the comparisons between two outputs are one replay
      const replays: number[] = [];
      let c = 0;
      for (let e = 0; e < t.length; e++) {
        const op = t.events[3 * e];
        if (op === OP.compare) c++;
        else if (op === OP.write) { replays.push(c); c = 0; }
      }
      replays.push(c);
      expect(t.counts.writes, at(a)).toBe(n < 2 ? 0 : n);
      if (n < 2) continue;
      expect(replays[0], at(a)).toBe(n - 1);
      for (const r of replays.slice(1)) expect(r, at(a)).toBeLessThanOrEqual(ceilLg(n));
    }
  });

  it('tournament-sort: Reversed Σ_{k<n} ν(k) comparisons; Already sorted and keys all equal ½ n lg n at powers of two', () => {
    for (const n of ALL) expect(counts('tournament-sort', input('reversed', n, 1))[0], `reversed n=${n}`).toBe(bits(n));
    for (const n of POW2) {
      expect(counts('tournament-sort', input('sorted', n, 1))[0], `sorted n=${n}`).toBe((n * lg(n)) / 2);
      expect(counts('tournament-sort', equal(n))[0], `equal n=${n}`).toBe((n * lg(n)) / 2);
    }
    expect([counts('tournament-sort', input('sorted', 512, 1))[0], counts('tournament-sort', input('random', 512, 4242))[0]])
      .toEqual([2304, 3988]);
  });

  it('binary-heap: the k-th insert at most ⌊lg k⌋ comparisons, exactly that on Ascending; a remove-max of m keys at most 2⌊lg(m − 1)⌋', () => {
    for (const w of QUEUE_CASES) {
      const t = queueRun(binaryHeap, w);
      perOp(t, 'insert').forEach((c, i) => expect(c.compares, `insert ${i + 1} of ${w.keys.length}`).toBeLessThanOrEqual(floorLg(i + 1)));
      perOp(t, 'remove').forEach((c, i) => {
        const m = w.keys.length - i;
        expect(c.compares, `remove from ${m}`).toBeLessThanOrEqual(m < 2 ? 0 : 2 * floorLg(m - 1));
      });
    }
    for (const n of TREE_SIZES) {
      const up = perOp(queueRun(binaryHeap, workload('keys', 'ascending', n, 1)), 'insert');
      expect(up.map((c) => c.compares), `ascending n=${n}`).toEqual(up.map((_, i) => floorLg(i + 1)));
      expect(up.reduce((s, c) => s + c.compares, 0)).toBe(lgSum(1, n));
    }
    expect(lgSum(1, 255)).toBe(1538);
  });

  it('binary-heap: on Descending no insert swims: one comparison and three array accesses each after the first', () => {
    for (const n of TREE_SIZES) {
      const t = queueRun(binaryHeap, workload('keys', 'descending', n, 4242));
      const ins = perOp(t, 'insert');
      expect(ins.map((c) => [c.compares, accesses(c)]), `n=${n}`).toEqual(ins.map((_, i) => (i ? [1, 3] : [0, 1])));
      const cost = costOf(t, 'insert', ['reads', 'writes']);
      expect([cost.total, cost.max], `n=${n}`).toEqual([3 * n - 2, n > 1 ? 3 : 1]);
    }
    // the readout's average, as the plate prints it (two decimals)
    expect(((3 * 255 - 2) / 255).toFixed(2)).toBe('2.99');
  });

  it('binomial-queue: n inserts make n − ν(n) comparisons and write n + 2(n − ν(n)) links, the k-th the trailing 1-bits of k − 1', () => {
    for (const w of QUEUE_CASES) {
      const n = w.keys.length;
      const ins = perOp(queueRun(binomialQueue, w), 'insert');
      expect(ins.map((c) => c.compares), `n=${n}`).toEqual(ins.map((_, i) => ones(i)));
      expect(ins.reduce((s, c) => s + c.compares, 0), `n=${n}`).toBe(n - nu(n));
      expect(ins.reduce((s, c) => s + c.links, 0), `n=${n}`).toBe(n + 2 * (n - nu(n)));
    }
    expect([255 - nu(255), 255 + 2 * (255 - nu(255))]).toEqual([247, 749]);
    expect((247 / 255).toFixed(2)).toBe('0.97');
  });

  it('binomial-queue: a remove-max of m keys between ν(m) − 1 and ν(m) − 1 + ⌊lg m⌋ − e₂(m) ≤ 2⌊lg m⌋ comparisons', () => {
    for (const w of QUEUE_CASES) {
      perOp(queueRun(binomialQueue, w), 'remove').forEach((c, i) => {
        const m = w.keys.length - i;
        const where = `remove from ${m} of ${w.keys.length}`;
        expect(c.compares, where).toBeGreaterThanOrEqual(nu(m) - 1);
        expect(c.compares, where).toBeLessThanOrEqual(nu(m) - 1 + floorLg(m) - e2(m));
        expect(nu(m) - 1 + floorLg(m) - e2(m), where).toBeLessThanOrEqual(2 * floorLg(m));
      });
    }
  });
});
