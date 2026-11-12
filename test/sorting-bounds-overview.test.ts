// Every exact count the overview shelf (sorting/overview) states (catalogue/entries/sort-tapestry.md,
// ADR 0006 §4), in the units of the Sort Tapestry plate: comparisons / row and writes / row, the
// counts of the plate's own generators (src/plates/sort-tapestry/algorithms.ts) averaged over its
// rows. Each generator is run on the rows the plate shuffles, at every size of its slider, and the
// plate itself headless until every row is sorted. That every generator sorts every permutation it
// is given is test/algorithms.test.ts ("sorting generators").
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/sort-tapestry/plate';
import { ALGORITHMS, type Counter } from '../src/plates/sort-tapestry/algorithms';
import { mulberry32, shuffle } from '../src/core/random';
import { headless } from './support/esoteric';

/** The slider's sizes: 16 to 192 values per row in steps of 8. */
const NS = Array.from({ length: 23 }, (_, i) => 16 + 8 * i);
/** Rows as the plate shuffles them for its first generation. */
const rowsOf = (n: number, seed: number, rows = 36) => {
  const rnd = mulberry32(seed);
  return Array.from({ length: rows }, () => shuffle(Array.from({ length: n }, (_, i) => i), rnd));
};
const count = (id: string, a: number[]): Counter => {
  const c: Counter = { cmp: 0, wr: 0 };
  for (const _ of ALGORITHMS[id].run(a, c)) { /* drain */ }
  return c;
};
/** Base-4 digits of n − 1: the passes of the plate's radix sort over the values 0..n − 1. */
const digits4 = (n: number) => {
  let d = 0;
  for (let x = n - 1; x > 0; x = Math.floor(x / 4)) d++;
  return d;
};

describe('sorting/overview: exact counts against the plate', () => {
  it('radix: no comparison on any row; n writes per base-4 digit of n − 1, four passes from 65 values up to the slider\'s 192', () => {
    for (const n of NS) {
      for (const seed of [1, 4242]) {
        for (const a of rowsOf(n, seed)) expect(count('radix', a), `n=${n}`).toEqual({ cmp: 0, wr: n * digits4(n) });
      }
    }
    expect([digits4(64), digits4(72), digits4(192), digits4(256), digits4(257)]).toEqual([3, 4, 4, 4, 5]);
  });

  it('selection: n(n − 1)/2 comparisons on every row and at most 2(n − 1) writes', () => {
    for (const n of NS) {
      for (const a of rowsOf(n, 4242)) {
        const c = count('selection', a);
        expect(c.cmp, `n=${n}`).toBe((n * (n - 1)) / 2);
        expect(c.wr, `n=${n}`).toBeLessThanOrEqual(2 * (n - 1));
      }
    }
  });

  it('the plate reads out those counts per row once every row is sorted', () => {
    const at = (algorithm: string) => {
      const h = headless(plate, { algorithm, n: 96, loop: false });
      for (let f = 0; f < 20000 && h.stats()['rows sorted'] !== '36 / 36'; f++) h.frames(1);
      return h.stats();
    };
    const r = at('radix');
    expect([r['comparisons / row'], r['writes / row'], r['rows sorted']]).toEqual(['0', '384', '36 / 36']);
    expect(at('selection')['comparisons / row']).toBe('4,560');
  });
});
