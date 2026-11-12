// Every exact count and every hard inequality the selection shelf (sorting/selection) states in a
// bound or a postcondition (catalogue/entries/quickselect.md, ADR 0006 §4), driven at several n,
// every rank k and every input shape and compared with what the array engine counts for the plate:
// Comparisons and Array writes (an exchange is two writes). Quickselect is a TypeScript kernel
// (src/kernels/array/quickselect.ts), traced as its plate traces it, with k = ⌊p·(n − 1)/100⌋ for
// the plate's rank slider p. Its expected linear cost is the source's asymptotic statement; here
// it is the mean over a fixed set of seeds, which the test recomputes exactly. That the kernel
// places the k-th smallest key at index k on every shape and size is test/kernels-array.test.ts
// ("leaves every input shape and size in the order its goal promises").
import { describe, expect, it } from 'vitest';
import { input, OP, SHAPES, trace, type Trace } from '../src/engines/array/trace';
import { kernel } from '../src/kernels/array/quickselect';

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) => p.map((_, i) => i).concat(p.length)
    .map((i) => [...p.slice(0, i), n, ...p.slice(i)]));
}
/** Every word of length n over the keys 1..3: ties in every arrangement. */
function words(n: number): number[][] {
  return Array.from({ length: 3 ** n }, (_, x) => Array.from({ length: n }, (_, i) => 1 + (Math.floor(x / 3 ** i) % 3)));
}
/** Sizes an exact formula is checked at: every n to 64, every size of the plate's grid, and edges. */
const NS = [...new Set([...Array.from({ length: 64 }, (_, n) => n + 1), ...Array.from({ length: 64 }, (_, i) => 8 * (i + 1)),
  100, 127, 129, 255, 257, 511])].sort((a, b) => a - b);
/** The plate's rank: k = ⌊p·(n − 1)/100⌋ for the slider's percent p. */
const rank = (n: number, p: number) => Math.min(n - 1, Math.floor((p / 100) * (n - 1)));
/** The inputs every inequality is checked on, each with every rank: all permutations and three-key
 * words up to six keys; and every plate shape at the plate's sizes, two seeds each, at eleven ranks. */
const SMALL: number[][] = [1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]);
const LARGE: number[][] = SHAPES.flatMap((shape) => [8, 16, 33, 64, 100, 128, 256, 512].flatMap((n) => [1, 2].map((s) => input(shape, n, 97 * s + n))));
const CASES: [number[], number][] = [
  ...SMALL.flatMap((a) => a.map((_, k) => [a, k] as [number[], number])),
  ...LARGE.flatMap((a) => [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => [a, rank(a.length, p)] as [number[], number])),
];
const at = (a: number[], k: number) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}] k=${k}`;

const run = (a: number[], k: number): Trace => {
  const t = trace(kernel, a, k);
  expect(t.truncated, at(a, k)).toBe(false);
  return t;
};
/** Comparisons and keys of every partition: a partition starts at its range mark. */
function partitions(t: Trace): { keys: number; compares: number }[] {
  const out: { keys: number; compares: number }[] = [];
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.range) out.push({ keys: t.events[3 * e + 2] - t.events[3 * e + 1] + 1, compares: 0 });
    else if (op === OP.compare) out[out.length - 1].compares++;
  }
  return out;
}
/** Σ (m + 1) over m = lo..hi. */
const sumPlus = (lo: number, hi: number) => {
  let s = 0;
  for (let m = lo; m <= hi; m++) s += m + 1;
  return s;
};

describe('sorting/selection: exact bounds against counted runs', () => {
  it('quickselect: every key left of k is no larger than a[k] and every key right of it no smaller', () => {
    for (const [a, k] of CASES) {
      const o = run(a, k).output;
      for (let i = 0; i < o.length; i++) {
        if (i < k) expect(o[i], at(a, k)).toBeLessThanOrEqual(o[k]);
        if (i > k) expect(o[i], at(a, k)).toBeGreaterThanOrEqual(o[k]);
      }
    }
  });

  it('quickselect: a partition of m keys makes at most m + 1 comparisons; at most (n − 1)(n + 4)/2 in all, for every k, reached on Already sorted with k = 0', () => {
    for (const [a, k] of CASES) {
      const t = run(a, k);
      for (const p of partitions(t)) expect(p.compares, at(a, k)).toBeLessThanOrEqual(p.keys + 1);
      expect(t.counts.compares, at(a, k)).toBeLessThanOrEqual(a.length < 2 ? 0 : ((a.length - 1) * (a.length + 4)) / 2);
    }
    for (const n of NS.filter((x) => x >= 2)) expect(run(input('sorted', n, 1), 0).counts.compares, `n=${n}`).toBe(((n - 1) * (n + 4)) / 2);
  });

  it('quickselect: on Already sorted Σ (m + 1) comparisons for m from max(k + 1, 2) to n and 2(n − max(k, 1)) array writes, one partition per key above rank k', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const p of [0, 1, 10, 25, 50, 75, 99, 100]) {
        const k = rank(n, p);
        const t = run(input('sorted', n, 1), k);
        expect([t.counts.compares, t.counts.writes, partitions(t).length], `n=${n} k=${k}`)
          .toEqual([sumPlus(Math.max(k + 1, 2), n), 2 * (n - Math.max(k, 1)), n - Math.max(k, 1)]);
      }
    }
    expect(run(input('sorted', 64, 1), rank(64, 50)).counts.compares).toBe(1617);
  });

  it('quickselect: on Reversed with k = 0 exactly n comparisons and 2 array writes, one partition', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const t = run(input('reversed', n, 1), 0);
      expect([t.counts.compares, t.counts.writes, partitions(t).length], `n=${n}`).toEqual([n, 2, 1]);
    }
  });

  it('quickselect: linear on average, about 1.94n comparisons for k = 0 and 3.31n for the median over Random permutations at 512 keys (seeds 1 to 400)', () => {
    const mean = (p: number) => {
      let s = 0;
      for (let seed = 1; seed <= 400; seed++) s += run(input('random', 512, seed), rank(512, p)).counts.compares;
      return s / 400 / 512;
    };
    expect([mean(0).toFixed(2), mean(50).toFixed(2)]).toEqual(['1.94', '3.31']);
    // below n lg n = 4,608, the comparisons a sort would need first
    expect(mean(50) * 512).toBeLessThan(512 * 9);
  });

  it('quickselect: the first partition leaves about half the keys for k = 0 and three quarters for the median (Random permutations at 512 keys, seeds 1 to 400)', () => {
    const kept = (p: number) => {
      let s = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const [first, second] = partitions(run(input('random', 512, seed), rank(512, p)));
        s += (second?.keys ?? 0) / first.keys;
      }
      return (s / 400).toFixed(2);
    };
    expect([kept(0), kept(50)]).toEqual(['0.49', '0.74']);
  });

  it('quickselect: Reversed with k at 50 % is near the worst case, 131,582 comparisons at 512 keys against (n − 1)(n + 4)/2 = 131,838', () => {
    expect(run(input('reversed', 512, 1), rank(512, 50)).counts.compares).toBe(131582);
  });
});
