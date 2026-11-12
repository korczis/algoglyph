// Every exact count and every hard inequality the distribution shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a shift or a copy one) and Auxiliary writes, which for these wasm-played kernels count
// every cell of the drawn strip that changes. All seven play the wasm kernel their sidecar record
// maps (src/kernels/sorting-wasm), replayed through the array engine.
// The keys are the plate's: input(shape, n, seed) draws 1..n (Few distinct keys 1..4, Organ pipe
// odd keys up to n), so a bound that needs the key range reads it from the input itself: every
// plate input spans at most n − 1 values above its minimum.
// Asymptotic bounds (linear on uniform keys, n² worst) are not checked here; that every kernel
// sorts every shape and size is test/kernels-sorting-wasm.test.ts ("leaves every input shape and
// size sorted, as an independent reference does").
import { describe, expect, it } from 'vitest';
import { apply, input, inversions, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const K: Record<string, ArrayKernel> = Object.fromEntries(await Promise.all([
  'address-calculation-sort', 'bucket-sort', 'flashsort', 'interpolation-sort', 'learnedsort', 'pigeonhole-sort',
  'proxmap-sort',
].map(async (id) => [id, await sidecarKernel(id)] as const)));

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
const ALL = Array.from({ length: 1025 }, (_, n) => n);
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
const distinct = (a: number[]) => new Set(a).size;
/** The values the keys span above their minimum: max − min. */
const span = (a: number[]) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
const isPermutation = (a: number[]) => a.slice().sort((x, y) => x - y).every((x, i) => x === i + 1);
/** Keys smaller than every key before them (the first key not counted). */
const newMinima = (a: number[]) => a.filter((x, i) => i > 0 && a.slice(0, i).every((y) => x < y)).length;
/** Keys with a larger key somewhere before them: the keys an insertion has to move. */
const moving = (a: number[]) => a.filter((x, i) => a.slice(0, i).some((y) => y > x)).length;
/** Left-to-right minima and maxima, the first key counted as both. */
const records = (a: number[]) => {
  let m = 0; let M = 0;
  a.forEach((x, i) => {
    if (a.slice(0, i).every((y) => x < y)) m++;
    if (a.slice(0, i).every((y) => x > y)) M++;
  });
  return m + M;
};
/** Comparisons of an exchange insertion sort: every exchange, and the comparison that stops it. */
function insertionCompares(seq: number[]): number {
  const a = seq.slice();
  let c = 0;
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      c++;
      if (!(a[j - 1] > a[j])) break;
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      j--;
    }
  }
  return c;
}
/** A run cut at its phase marks: each phase's counts, and the array as it stood when it began. */
function phases(t: Trace): { name: string; compares: number; writes: number; keys: number[] }[] {
  const a = t.input.slice();
  const aux = new Array<number>(t.auxN).fill(0);
  const out = [{ name: '', compares: 0, writes: 0, keys: a.slice() }];
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.phase) out.push({ name: t.labels[t.events[3 * e + 1]], compares: 0, writes: 0, keys: a.slice() });
    const p = out[out.length - 1];
    if (op === OP.compare) p.compares++;
    else if (op === OP.swap) p.writes += 2;
    else if (op === OP.write) p.writes++;
    apply(a, aux, t.events, e);
  }
  return out;
}
/** What the shift insertion sort that closes flashsort and LearnedSort counts on `a`. */
const shiftInsertion = (a: number[]) => {
  const inv = inversions(a);
  return { compares: inv + Math.max(0, a.length - 1) - newMinima(a), writes: inv + moving(a) };
};

describe('sorting/distribution: exact bounds against counted runs', () => {
  it('address-calculation-sort: n array writes; on 1..n no collision, 2n − m − M comparisons for its m minima and M maxima', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const [, w] = counts('address-calculation-sort', a);
      expect(w, at(a)).toBe(span(a) > 0 ? a.length : 0);
      // every key compares with the nearest stored key on each side, and stops there
      if (isPermutation(a) && a.length >= 2) {
        expect(counts('address-calculation-sort', a)[0], at(a)).toBe(2 * a.length - records(a));
      }
    }
    expect(counts('address-calculation-sort', input('random', 512, 4242)).slice(0, 2)).toEqual([1013, 512]);
    for (const n of ALL.filter((x) => x >= 2)) {
      for (const s of ['sorted', 'reversed'] as const) expect(counts('address-calculation-sort', input(s, n, 1))[0], `${s} n=${n}`).toBe(n - 1);
    }
  });

  it('address-calculation-sort: a key value below the largest costs at least m(m − 1)/2 comparisons for its m copies', () => {
    // each new copy walks rightwards past every copy stored before it
    const floor = (a: number[]) => {
      const top = Math.max(...a);
      const m = new Map<number, number>();
      for (const x of a) if (x !== top) m.set(x, (m.get(x) ?? 0) + 1);
      return [...m.values()].reduce((s, c) => s + (c * (c - 1)) / 2, 0);
    };
    for (const a of [...CASES, ...SWEEP].filter((x) => x.length)) {
      expect(counts('address-calculation-sort', a)[0], at(a)).toBeGreaterThanOrEqual(floor(a));
    }
    // Few distinct keys at 512 keys: quadratic, against 1,013 on Random permutation
    const few = input('few-unique', 512, 4242);
    expect([counts('address-calculation-sort', few)[0], floor(few)]).toEqual([25911, 25027]);
    for (const s of SEEDS) {
      expect(counts('address-calculation-sort', input('few-unique', 512, s))[0], `seed ${s}`)
        .toBeGreaterThan(20 * counts('address-calculation-sort', input('random', 512, s))[0]);
    }
  });

  it('bucket-sort: when the keys span at most n values, n − d comparisons for d distinct keys, n array and n auxiliary writes', () => {
    for (const a of [...CASES, ...SWEEP].filter((x) => span(x) + 1 <= x.length)) {
      const n = a.length;
      // a bucket per key value: only equal keys share a bucket, and insertion sort leaves them be
      expect(counts('bucket-sort', a), at(a)).toEqual(span(a) > 0 ? [n - distinct(a), n, n] : [0, 0, 0]);
    }
    expect(SHAPES.map((s) => counts('bucket-sort', input(s, 512, 4242))[0])).toEqual([0, 0, 0, 508, 256, 0]);
  });

  it('flashsort: one exchange, a permutation of n − 1 or n writes, then a shift insertion sort counted from its own input', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const n = a.length;
      const t = run('flashsort', a);
      if (n < 2 || span(a) === 0) {
        expect([t.counts.compares, t.counts.writes], at(a)).toEqual([n < 2 ? 0 : 2 * (n - 1), 0]);
        continue;
      }
      const p = phases(t);
      expect(p.map((x) => x.name.replace(/\d+/, 'm')), at(a)).toEqual(['', 'classify into m classes', 'flash permutation', 'insertion sort']);
      expect([p[0].compares, p[1].writes, t.counts.swaps, t.counts.auxWrites], at(a)).toEqual([2 * (n - 1), 2, 1, 0]);
      expect([n - 1, n], at(a)).toContain(p[2].writes);
      expect({ compares: p[3].compares, writes: p[3].writes }, at(a)).toEqual(shiftInsertion(p[3].keys));
    }
  });

  it('flashsort: Already sorted leaves the insertion pass more to repair, and costs more than Random permutation at 512 keys', () => {
    const left = (a: number[]) => inversions(phases(run('flashsort', a))[3].keys);
    const sorted = counts('flashsort', input('sorted', 512, 1))[0];
    expect([counts('flashsort', input('random', 512, 4242))[0], counts('flashsort', input('reversed', 512, 1))[0], sorted])
      .toEqual([1708, 1764, 1829]);
    expect([left(input('random', 512, 4242)), left(input('sorted', 512, 1))]).toEqual([175, 297]);
    for (const s of SEEDS) {
      expect(counts('flashsort', input('random', 512, s))[0], `seed ${s}`).toBeLessThan(sorted);
      expect(left(input('random', 512, s)), `seed ${s}`).toBeLessThan(297);
    }
  });

  it('interpolation-sort: when the keys span fewer than n values, 2(n − 1) + 2(n − d) comparisons, n array and n auxiliary writes', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const n = a.length;
      const [c, w, x] = counts('interpolation-sort', a);
      expect(w, at(a)).toBe(n);
      if (n < 2) { expect([c, x], at(a)).toEqual([0, 0]); continue; }
      if (span(a) === 0) { expect([c, x], at(a)).toEqual([2 * (n - 1), 0]); continue; }
      // the first interpolation gives every key value its own bucket; a bucket of equal keys costs
      // the two comparisons per key of its own minimum and maximum, and stops
      if (span(a) <= n - 1) expect([c, x], at(a)).toEqual([2 * (n - 1) + 2 * (n - distinct(a)), n]);
    }
    expect(SHAPES.map((s) => counts('interpolation-sort', input(s, 512, 4242))[0])).toEqual([1022, 1022, 1022, 2038, 1534, 1022]);
  });

  it('learnedsort: n writes for the buckets, then a shift insertion sort counted from its own input; s + n auxiliary writes', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const n = a.length;
      const t = run('learnedsort', a);
      if (n < 16) {
        // below 16 keys an exchange insertion sort, and nothing else
        expect([t.counts.compares, t.counts.swaps, t.counts.writes, t.counts.auxWrites], at(a))
          .toEqual([insertionCompares(a), inversions(a), 2 * inversions(a), 0]);
        continue;
      }
      const s = Math.min(n, Math.max(16, Math.floor(Math.sqrt(n))));
      const p = phases(t);
      expect(p.map((x) => x.name.replace(/\d+(?= keys| buckets)/, 'k')), at(a)).toEqual(['', 'sample k keys', 'train the CDF model (2-layer RMI)',
        'place keys into k buckets by the model', 'touch-up insertion sort']);
      // the sample's exchange insertion sort: at least s − 1 comparisons, at most s(s − 1)/2
      expect(p[1].compares, at(a)).toBeGreaterThanOrEqual(s - 1);
      expect(p[1].compares, at(a)).toBeLessThanOrEqual((s * (s - 1)) / 2);
      expect([p[3].compares, p[3].writes, t.counts.swaps, t.counts.auxWrites], at(a)).toEqual([0, n, 0, s + n]);
      expect({ compares: p[4].compares, writes: p[4].writes }, at(a)).toEqual(shiftInsertion(p[4].keys));
    }
  });

  it('learnedsort: Already sorted at 512 keys needs no repair; Random permutation at 256 keys leaves the touch-up most of the work', () => {
    expect(counts('learnedsort', input('sorted', 512, 1)).slice(1)).toEqual([512, 534]);
    expect(run('learnedsort', input('random', 512, 4242)).labels).toContain('sample 22 keys');
    expect(counts('learnedsort', input('random', 512, 4242)).slice(0, 2)).toEqual([1718, 1945]);
    const p = phases(run('learnedsort', input('random', 256, 4242)));
    expect([p.reduce((s, x) => s + x.compares, 0), p[4].compares, inversions(p[4].keys)]).toEqual([6502, 6428, 6174]);
  });

  it('pigeonhole-sort: no comparison and exactly n array writes; at least n auxiliary writes, exactly n on Already sorted', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const [c, w, x] = counts('pigeonhole-sort', a);
      expect([c, w], at(a)).toEqual([0, a.length]);
      expect(x, at(a)).toBeGreaterThanOrEqual(a.length);
    }
    for (const n of ALL) expect(counts('pigeonhole-sort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([0, n, n]);
  });

  it('proxmap-sort: when the keys span fewer than n values, n − d comparisons for d distinct keys and n array writes', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const n = a.length;
      const [c, w, x] = counts('proxmap-sort', a);
      if (span(a) === 0) { expect([c, w, x], at(a)).toEqual([0, 0, 0]); continue; }
      expect(w, at(a)).toBe(n);
      expect(x, at(a)).toBeGreaterThanOrEqual(2 * n);
      // the map sends every key value to its own subarray; a key after equal ones stops at once
      if (span(a) <= n - 1) expect(c, at(a)).toBe(n - distinct(a));
    }
    expect(SHAPES.map((s) => counts('proxmap-sort', input(s, 512, 4242))[0])).toEqual([0, 0, 0, 508, 256, 0]);
    for (const n of ALL.filter((x) => x >= 2)) expect(counts('proxmap-sort', input('sorted', n, 1))[2], `sorted n=${n}`).toBe(2 * n);
  });
});
