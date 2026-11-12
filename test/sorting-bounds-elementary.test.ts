// Every exact count and every hard inequality the elementary sorting shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a shift or a copy one), Auxiliary writes, the Rounds readout and the Phase readout's
// count. Each kernel runs as its plate plays it: its TypeScript kernel, or the wasm kernel its
// sidecar record maps (src/kernels/sorting-wasm), replayed through the same engine.
// Asymptotic bounds (O, about, with high probability) are not checked here; that every kernel
// sorts every shape and size is test/kernels-array.test.ts ("leaves every input shape and size in
// the order its goal promises") and test/kernels-sorting-wasm.test.ts ("leaves every input shape
// and size sorted, as an independent reference does").
import { describe, expect, it } from 'vitest';
import { input, inversions, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const files = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = async (id: string): Promise<ArrayKernel> => files[`../src/kernels/array/${id}.ts`] ?? sidecarKernel(id);
const K = Object.fromEntries(await Promise.all([
  'binary-insertion-sort', 'bubble-sort', 'circle-sort', 'comb-sort', 'cycle-sort', 'double-selection-sort',
  'exchange-sort', 'gnome-sort', 'insertion-sort', 'library-sort', 'odd-even-sort', 'pair-insertion-sort',
  'selection-sort', 'shaker-sort', 'shellsort-knuth', 'shellsort-sedgewick', 'two-way-insertion-sort',
].map(async (id) => [id, await kernelOf(id)] as const)));

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
const SIZES = [1, 2, 3, 7, 8, 16, 33, 64, 128];

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const tri = (n: number) => (n < 2 ? 0 : (n * (n - 1)) / 2);
/** Keys with a larger key somewhere before them: the keys an insertion has to move. */
const moving = (a: number[]) => a.filter((x, i) => a.slice(0, i).some((y) => y > x)).length;
/** Keys not at the position they hold in the sorted order. */
const outOfPlace = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y);
  return a.filter((x, i) => x !== s[i]).length;
};
/** Σ_{i=1}^{n−1} ⌊lg i⌋ and Σ_{i=1}^{n−1} (⌊lg i⌋ + 1): binary search over 1, 2, …, n − 1 keys. */
const lgSum = (n: number, plus: number) => {
  let s = 0;
  for (let i = 1; i < n; i++) s += Math.floor(Math.log2(i)) + plus;
  return s;
};
/** The round (1-based, as the Rounds readout counts) of the run's last exchange; 0 for none. */
function lastExchangeRound(t: Trace): number {
  let round = 0;
  let last = 0;
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.round) round++;
    else if (op === OP.swap || op === OP.write) last = round;
  }
  return last;
}
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;

describe('sorting/elementary: exact bounds against counted runs', () => {
  it('selection-sort: n(n − 1)/2 comparisons on every input, at most 2(n − 1) writes, none on sorted', () => {
    for (const a of CASES) {
      const t = run('selection-sort', a);
      expect(t.counts.compares, at(a)).toBe(tri(a.length));
      expect(t.counts.writes, at(a)).toBeLessThanOrEqual(2 * Math.max(0, a.length - 1));
    }
    for (const n of SIZES) expect(run('selection-sort', input('sorted', n, 1)).counts.writes).toBe(0);
  });

  it('insertion-sort: writes = inversions + keys that move; inversions ≤ comparisons ≤ inversions + n − 1', () => {
    for (const a of CASES) {
      const t = run('insertion-sort', a);
      const inv = inversions(a);
      expect(t.counts.writes, at(a)).toBe(inv + moving(a));
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(inv);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(inv + Math.max(0, a.length - 1));
      expect(t.counts.auxWrites, at(a)).toBe(0);
    }
    for (const n of SIZES) {
      const sorted = run('insertion-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([n - 1, 0]);
      const reversed = run('insertion-sort', input('reversed', n, 1));
      expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`).toEqual([tri(n), tri(n) + n - 1]);
    }
  });

  it('binary-insertion-sort: Σ⌊lg i⌋ ≤ comparisons ≤ Σ(⌊lg i⌋ + 1), the top on reversed; writes as insertion sort', () => {
    for (const a of CASES) {
      const t = run('binary-insertion-sort', a);
      expect(t.counts.writes, at(a)).toBe(inversions(a) + moving(a));
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(lgSum(a.length, 0));
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(lgSum(a.length, 1));
    }
    for (const n of SIZES) {
      const reversed = run('binary-insertion-sort', input('reversed', n, 1));
      expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`).toEqual([lgSum(n, 1), tri(n) + n - 1]);
      expect(run('binary-insertion-sort', input('sorted', n, 1)).counts.writes, `sorted n=${n}`).toBe(0);
    }
  });

  for (const id of ['bubble-sort', 'shaker-sort']) {
    it(`${id}: writes = 2 × inversions; n − 1 comparisons on sorted, n(n − 1)/2 on reversed`, () => {
      for (const a of CASES) {
        const t = run(id, a);
        expect(t.counts.writes, at(a)).toBe(2 * inversions(a));
        expect(t.counts.compares, at(a)).toBeLessThanOrEqual(tri(a.length));
      }
      for (const n of SIZES) {
        const sorted = run(id, input('sorted', n, 1));
        expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([n - 1, 0]);
        const reversed = run(id, input('reversed', n, 1));
        expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`).toEqual([tri(n), 2 * tri(n)]);
      }
    });
  }

  it('gnome-sort: writes = 2 × inversions, and 2 × inversions ≤ comparisons ≤ 2 × inversions + n − 1', () => {
    for (const a of CASES) {
      const t = run('gnome-sort', a);
      const inv = inversions(a);
      expect(t.counts.writes, at(a)).toBe(2 * inv);
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(2 * inv);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(2 * inv + Math.max(0, a.length - 1));
    }
    for (const n of SIZES) {
      const sorted = run('gnome-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([n - 1, 0]);
      const reversed = run('gnome-sort', input('reversed', n, 1));
      expect([reversed.counts.compares, reversed.counts.writes], `reversed n=${n}`).toEqual([2 * tri(n), 2 * tri(n)]);
    }
  });

  it('odd-even-sort: writes = 2 × inversions, the last exchange within n rounds, at most 2⌈n/2⌉ + 2 rounds', () => {
    for (const a of CASES) {
      const n = a.length;
      const t = run('odd-even-sort', a);
      expect(t.counts.writes, at(a)).toBe(2 * inversions(a));
      expect(lastExchangeRound(t), at(a)).toBeLessThanOrEqual(n);
      expect(t.marks.rounds, at(a)).toBeLessThanOrEqual(n < 2 ? 0 : 2 * Math.ceil(n / 2) + 2);
    }
    for (const n of SIZES.filter((x) => x >= 2)) {
      const sorted = run('odd-even-sort', input('sorted', n, 1));
      expect([sorted.marks.rounds, sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([2, n - 1, 0]);
    }
  });

  it('cycle-sort: writes = keys out of place (so at most n), comparisons ≥ n(n − 1)/2, exactly that on sorted', () => {
    for (const a of CASES) {
      const t = run('cycle-sort', a);
      expect(t.counts.writes, at(a)).toBe(outOfPlace(a));
      expect(t.counts.writes, at(a)).toBeLessThanOrEqual(a.length);
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(tri(a.length));
    }
    for (const n of SIZES) {
      const sorted = run('cycle-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([tri(n), 0]);
    }
  });

  it('exchange-sort: n(n − 1)/2 comparisons on every input; writes ≤ 2 × inversions, n(n − 1) on reversed', () => {
    for (const a of CASES) {
      const t = run('exchange-sort', a);
      expect(t.counts.compares, at(a)).toBe(tri(a.length));
      expect(t.counts.writes, at(a)).toBeLessThanOrEqual(2 * inversions(a));
    }
    for (const n of SIZES) {
      expect(run('exchange-sort', input('sorted', n, 1)).counts.writes, `sorted n=${n}`).toBe(0);
      expect(run('exchange-sort', input('reversed', n, 1)).counts.writes, `reversed n=${n}`).toBe(2 * tri(n));
    }
  });

  it('double-selection-sort: ⌊n²/4⌋ ≤ comparisons ≤ 2⌊n²/4⌋ (reversed, sorted), writes ≤ 4⌊n/2⌋', () => {
    const q = (n: number) => Math.floor((n * n) / 4);
    for (const a of CASES) {
      const t = run('double-selection-sort', a);
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(q(a.length));
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(2 * q(a.length));
      expect(t.counts.writes, at(a)).toBeLessThanOrEqual(4 * Math.floor(a.length / 2));
    }
    for (const n of SIZES) {
      expect(run('double-selection-sort', input('reversed', n, 1)).counts.compares, `reversed n=${n}`).toBe(q(n));
      const sorted = run('double-selection-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([2 * q(n), 0]);
    }
  });

  it('circle-sort: comparisons = sweeps × one sweep\'s; sorted one sweep, (n/2) lg n for n a power of two; reversed two', () => {
    for (const a of CASES) {
      const t = run('circle-sort', a);
      const sweep = run('circle-sort', a.slice().sort((x, y) => x - y)).counts.compares;
      expect(t.counts.compares, at(a)).toBe(t.marks.phases * sweep);
    }
    for (let n = 2; n <= 512; n *= 2) {
      const sorted = run('circle-sort', input('sorted', n, 1));
      expect([sorted.marks.phases, sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`)
        .toEqual([1, (n / 2) * Math.log2(n), 0]);
    }
    for (const n of SIZES.filter((x) => x >= 2)) {
      const reversed = run('circle-sort', input('reversed', n, 1));
      expect([reversed.marks.phases, reversed.counts.writes], `reversed n=${n}`).toEqual([2, 2 * Math.floor(n / 2)]);
    }
  });

  it('comb-sort: on sorted keys no writes, and n − g comparisons for each gap g = ⌊10g/13⌋ from n down to 1', () => {
    for (const n of [0, ...SIZES, 200, 1000]) {
      let compares = 0;
      let passes = 0;
      for (let g = n; ;) {
        g = Math.max(1, Math.floor((10 * g) / 13));
        compares += Math.max(0, n - g);
        passes++;
        if (g === 1) break;
      }
      const sorted = run('comb-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes, sorted.marks.phases], `sorted n=${n}`).toEqual([compares, 0, passes]);
    }
  });

  for (const [id, increments] of [
    ['shellsort-knuth', (n: number) => { const h: number[] = []; for (let x = 1; x < n; x = 3 * x + 1) h.push(x); return h; }],
    ['shellsort-sedgewick', (n: number) => {
      const h = n > 1 ? [1] : [];
      for (let k = 1; 4 ** k + 3 * 2 ** (k - 1) + 1 < n; k++) h.push(4 ** k + 3 * 2 ** (k - 1) + 1);
      return h;
    }],
  ] as const) {
    it(`${id}: on sorted keys no writes, and Σ (n − h) comparisons over its increments h < n`, () => {
      for (const n of [0, ...SIZES, 200, 1000]) {
        const want = increments(n).reduce((s, h) => s + n - h, 0);
        const sorted = run(id, input('sorted', n, 1));
        expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`).toEqual([want, 0]);
      }
    });
  }

  it('pair-insertion-sort: on sorted keys 3⌊(n − 1)/2⌋ comparisons, one more for even n, and 2⌊(n − 1)/2⌋ writes', () => {
    for (const n of [...SIZES, 200]) {
      const pairs = Math.floor((n - 1) / 2);
      const sorted = run('pair-insertion-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.writes], `sorted n=${n}`)
        .toEqual([3 * pairs + (n % 2 === 0 ? 1 : 0), 2 * pairs]);
    }
  });

  it('two-way-insertion-sort: n array writes; Σ⌊lg i⌋ ≤ comparisons ≤ Σ(⌊lg i⌋ + 1), the top on reversed', () => {
    for (const a of CASES) {
      const t = run('two-way-insertion-sort', a);
      expect(t.counts.writes, at(a)).toBe(a.length < 2 ? 0 : a.length);
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(lgSum(a.length, 0));
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(lgSum(a.length, 1));
    }
    for (const n of SIZES.filter((x) => x >= 2)) {
      const reversed = run('two-way-insertion-sort', input('reversed', n, 1));
      expect([reversed.counts.compares, reversed.counts.auxWrites], `reversed n=${n}`).toEqual([lgSum(n, 1), n]);
      expect(run('two-way-insertion-sort', input('sorted', n, 1)).counts.auxWrites, `sorted n=${n}`).toBe(n);
    }
  });

  it('library-sort: exactly n array writes (the copy back) and ⌊lg(n − 1)⌋ + 1 rebalancing phases', () => {
    for (const a of CASES) {
      const t = run('library-sort', a);
      const n = a.length;
      expect(t.counts.writes, at(a)).toBe(n < 2 ? 0 : n);
      // a rebalance before the insertion that follows 1, 2, 4, … keys: every power of two below n
      expect(t.marks.phases, at(a)).toBe(n < 2 ? 0 : Math.floor(Math.log2(n - 1)) + 1);
    }
  });
});
