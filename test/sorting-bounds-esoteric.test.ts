// Every exact count and every hard inequality the esoteric shelf (sorting/esoteric) states in a
// bound (catalogue/entries/*.md, ADR 0006 §4), in the units each plate counts. Eight of the nine
// are bespoke plates whose step-wise mirrors (src/plates/<id>/) their own tests prove equal to the
// wasm kernels, counter for counter: test/plate-bogosort.test.ts, plate-bozosort, plate-bogobogosort,
// plate-slowsort, plate-stooge-sort, plate-worstsort, plate-miracle-sort and plate-stalin-sort.
// Those tests also prove the exact theory the plates chart: bogosort's expected n!/Πmᵢ! shuffles,
// bozosort's Markov chain on cycle types, bogobogosort's Σ m! (n! − 1 on average), the slowsort and
// stooge sort recurrences, which this file names and does not repeat. What is added here holds for
// every seed: the identities between a run's counters, the inequalities no run can break, and the
// exact counts on special inputs. Sleep sort is an array-engine plate of a wasm kernel, played as
// its sidecar record maps it and counted as the array engine counts it: Comparisons, Array writes,
// Rounds, Lanes and the Phase readout.
import { describe, expect, it } from 'vitest';
import { input as arrayInput, OP, SHAPES as ARRAY_SHAPES, trace, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';
import { bogosort, expectedShuffles, type BogoState } from '../src/plates/bogosort/bogosort';
import { bozosort, countInversions, newState } from '../src/plates/bozosort/bozosort';
import { bogobogosort, type BbsState } from '../src/plates/bogobogosort/bogobogosort';
import { slowComparisons, slowsort } from '../src/plates/slowsort/slowsort';
import { STOOGE_EXPONENT, stoogeComparisons, stoogeSort } from '../src/plates/stooge-sort/stooge';
import { kernelLevels, worstsort, type WorstState } from '../src/plates/worstsort/worstsort';
import { miracleCheck } from '../src/plates/miracle-sort/miracle';
import { stalinRun, survivors } from '../src/plates/stalin-sort/stalin';
import { items, Stepper, Tracer, type Algorithm, type Items } from '../src/plates/_shared/kernel-mirror/tracer';
import { input, isSorted, runSeed, SHAPES } from '../src/plates/_shared/sort-input/input';
import { factorial, harmonic } from '../src/plates/_shared/theory/combinatorics';

const sleep = await sidecarKernel('sleep-sort');
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
const tri = (n: number) => (n < 2 ? 0 : (n * (n - 1)) / 2);
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;
/** Small inputs for the randomised sorts: all permutations and three-key words up to five keys. */
const SMALL: number[][] = [0, 1, 2, 3, 4, 5].flatMap((n) => [...permutations(n), ...words(n)]);
/** The plates' own inputs: every shape at every n the trial plates offer, five seeds each. */
const PLATE = SHAPES.flatMap((shape) => [2, 3, 4, 5, 6].flatMap((n) => [1, 2, 3, 4, 5].map((k) => input(shape, n, runSeed(4242, k)))));

/** A mirror run to its end, with its tracer and items. */
function finish(alg: (t: Tracer, a: Items) => Algorithm, keys: number[], seed = 1): { t: Tracer; a: Items; outcome: string } {
  const a = items(keys);
  const t = new Tracer(seed);
  const outcome = new Stepper(alg(t, a), t).finish();
  return { t, a, outcome };
}
/** Whether two equal keys left the run in the opposite order to the one they came in. */
const crossed = (a: Items) => a.tag.some((x, i) => i > 0 && a.key[i] === a.key[i - 1] && (x & 0x7fffffff) < (a.tag[i - 1] & 0x7fffffff));
const sameOrder = (a: Items) => a.tag.every((x, i) => i === 0 || a.key[i] !== a.key[i - 1] || x > a.tag[i - 1]);

describe('sorting/esoteric: exact bounds against counted runs', () => {
  it('bogosort: n − 1 swaps per shuffle, every check 1 to n − 1 comparisons and the last n − 1; Already sorted n − 1 comparisons, no shuffle', () => {
    for (const keys of [...SMALL, ...PLATE]) {
      for (const seed of [1, 2, 3]) {
        const st: BogoState = { shuffles: 0 };
        const { t, a, outcome } = finish((tr, x) => bogosort(tr, x, st), keys, seed);
        const n = keys.length;
        expect([outcome, isSorted(a.key)], at(keys)).toEqual(['sorted', true]);
        expect(t.counts.swap, at(keys)).toBe(Math.max(0, n - 1) * st.shuffles);
        expect(t.counts.cmp, at(keys)).toBeGreaterThanOrEqual(st.shuffles + Math.max(0, n - 1));
        expect(t.counts.cmp, at(keys)).toBeLessThanOrEqual(Math.max(0, n - 1) * (st.shuffles + 1));
        if (isSorted(keys)) expect([st.shuffles, t.counts.cmp, t.counts.swap], at(keys)).toEqual([0, Math.max(0, n - 1), 0]);
      }
    }
    // the theory the plate charts (proved in test/plate-bogosort.test.ts), at the plate's default n
    expect([expectedShuffles([5, 4, 3, 2, 1]), expectedShuffles([2, 1, 1, 2]), expectedShuffles([1, 2, 3, 4, 5])]).toEqual([120, 6, 0]);
  });

  it('bozosort: one swap per pair drawn, every check 1 to n − 1 comparisons and the last n − 1; the repair never swaps more than the input has inversions', () => {
    for (const keys of [...SMALL, ...PLATE.filter((x) => new Set(x).size === x.length)]) {
      const n = keys.length;
      for (const seed of [1, 2, 3]) {
        const st = newState(keys);
        const { t, a } = finish((tr, x) => bozosort(tr, x, st), keys, seed);
        expect(isSorted(a.key), at(keys)).toBe(true);
        expect([t.counts.swap, st.swaps], at(keys)).toEqual([st.picks, st.picks]);
        expect(t.counts.cmp, at(keys)).toBeGreaterThanOrEqual(st.picks + Math.max(0, n - 1));
        expect(t.counts.cmp, at(keys)).toBeLessThanOrEqual(Math.max(0, n - 1) * (st.picks + 1));
        const fix = newState(keys);
        finish((tr, x) => bozosort(tr, x, fix, 'inversion'), keys, seed);
        expect(fix.swaps, at(keys)).toBeLessThanOrEqual(countInversions(keys));
        expect(fix.worse, at(keys)).toBe(0);
      }
    }
    // the blind walk does add inversions: on five reversed keys every seed tried makes such a swap
    for (let seed = 1; seed <= 20; seed++) {
      const st = newState([5, 4, 3, 2, 1]);
      finish((tr, x) => bozosort(tr, x, st), [5, 4, 3, 2, 1], seed);
      expect(st.worse, `seed ${seed}`).toBeGreaterThan(0);
      expect(st.better + st.worse + st.idle, `seed ${seed}`).toBe(st.swaps);
    }
  });

  it('bogobogosort: comparisons are exactly the swaps plus n − 1; a shuffle of a prefix of m keys is m − 1 swaps; Already sorted n − 1 comparisons, no shuffle', () => {
    for (const keys of [...SMALL, ...PLATE.filter((x) => new Set(x).size === x.length)]) {
      const n = keys.length;
      for (const seed of [1, 2, 3]) {
        const st: BbsState = { shuffles: 0, level: new Array<number>(n + 1).fill(0), prefix: 0 };
        const { t, a } = finish((tr, x) => bogobogosort(tr, x, st), keys, seed);
        expect(isSorted(a.key), at(keys)).toBe(true);
        expect(t.counts.swap, at(keys)).toBe(st.level.reduce((s, x, m) => s + Math.max(0, m - 1) * x, 0));
        expect(t.counts.cmp, at(keys)).toBe(t.counts.swap + Math.max(0, n - 1));
        if (isSorted(keys)) expect([st.shuffles, t.counts.cmp], at(keys)).toEqual([0, Math.max(0, n - 1)]);
      }
    }
  });

  it('slowsort and stooge sort: every swap removes an inversion, so never more swaps than the input has inversions; none on Already sorted', () => {
    const cases = [...[0, 1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
      ...SHAPES.flatMap((shape) => [16, 33, 45].map((n) => input(shape, n, n)))];
    for (const keys of cases) {
      for (const [name, alg] of [['slowsort', slowsort], ['stooge', stoogeSort]] as const) {
        const { t, a } = finish((tr, x) => alg(tr, x, { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] }), keys);
        expect(isSorted(a.key), `${name} ${at(keys)}`).toBe(true);
        expect(t.counts.swap, `${name} ${at(keys)}`).toBeLessThanOrEqual(countInversions(keys));
        if (isSorted(keys)) expect(t.counts.swap, `${name} ${at(keys)}`).toBe(0);
      }
    }
    // the exact counts at the plates' default sizes (the recurrences equal the kernels' counts on
    // every input: test/plate-slowsort.test.ts and test/plate-stooge-sort.test.ts)
    expect([slowComparisons(16), stoogeComparisons(24), STOOGE_EXPONENT.toFixed(4)]).toEqual([406, 3280, '2.7095']);
  });

  it('worstsort: at the kernel\'s f(n) n! permutations bubble-sorted for n from 3 to 5, already in order on Already sorted (n! − 1 list comparisons, no swap) and reversed on Reversed (n!(n! − 1)/2 of each)', () => {
    const state = (): WorstState => ({ levels: 0, list: null, initial: null, pass: 0, at: -1, lex: 0, swaps: 0, passLex: [], passSwaps: [] });
    for (const n of [3, 4, 5]) {
      const N = factorial(n);
      const up = state();
      finish((tr, x) => worstsort(tr, x, up), input('sorted', n, 1));
      expect([up.list!.length, up.lex, up.swaps], `n=${n}`).toEqual([N, N - 1, 0]);
      const down = state();
      finish((tr, x) => worstsort(tr, x, down), input('reversed', n, 1));
      expect([down.list!.length, down.lex, down.swaps], `n=${n}`).toEqual([N, tri(N), tri(N)]);
    }
    // two keys take two levels: the list of the 2 permutations of the 2 permutations
    const two = state();
    finish((tr, x) => worstsort(tr, x, two), [2, 1]);
    expect([kernelLevels(2), two.list!.length]).toEqual([2, 2]);
  });

  it('miracle sort: one check on non-decreasing input, n − 1 comparisons, nothing written', () => {
    for (const keys of [...[1, 2, 3, 4, 5, 6].flatMap(words), ...SHAPES.map((s) => input(s, 64, 1))].filter(isSorted)) {
      const st = { descent: -1 };
      const { t, a, outcome } = finish((tr, x) => miracleCheck(tr, x, st), keys);
      expect([outcome, t.counts.cmp, t.counts.write + t.counts.swap], at(keys)).toEqual(['sorted', keys.length - 1, 0]);
      expect(a.tag, at(keys)).toEqual(keys.map((_, i) => i));
    }
  });

  it('stalin sort: n − 1 comparisons on every input; reads and writes only for survivors after the first key eliminated; one survivor on Reversed, n on Already sorted', () => {
    for (const keys of [...[2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
      ...SHAPES.flatMap((s) => [2, 17, 64, 256, 512].map((n) => input(s, n, n)))]) {
      const r = stalinRun(keys);
      r.stepper.finish();
      const fate = [...r.state.fate];
      const firstOut = fate.indexOf(-1);
      const late = firstOut < 0 ? 0 : fate.slice(firstOut).filter((f) => f === 1).length;
      const c = r.stepper.t.counts;
      expect([c.cmp, c.read, c.write, c.swap], at(keys)).toEqual([keys.length - 1, late, late, 0]);
      expect(sameOrder({ key: survivors(r), tag: r.a.tag.slice(0, r.state.kept) }), at(keys)).toBe(true);
    }
    expect(harmonic(64).toFixed(2)).toBe('4.74');
    for (const n of [2, 17, 64, 256, 512]) {
      expect(survivors((() => { const r = stalinRun(input('reversed', n, 1)); r.stepper.finish(); return r; })()).length, `n=${n}`).toBe(1);
      expect(survivors((() => { const r = stalinRun(input('sorted', n, 1)); r.stepper.finish(); return r; })()).length, `n=${n}`).toBe(n);
    }
  });

  it('sleep-sort: n array writes, 2 rounds and n lanes; one phase per distinct key after the spawn, the last at t = max − min; the timer heap within its bound', () => {
    const lg = (x: number) => Math.floor(Math.log2(x));
    /** A push onto i keys climbs at most ⌊lg(i + 1)⌋ levels, a removal leaving s keys sinks at most ⌊lg s⌋, two comparisons a level. */
    const heapBound = (n: number) => {
      let b = 0;
      for (let i = 1; i < n; i++) b += lg(i + 1) + 2 * lg(i);
      return b;
    };
    const run = (a: number[]): Trace => trace(sleep, a);
    const cases = [...[1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
      ...ARRAY_SHAPES.flatMap((s) => [8, 16, 33, 64, 128, 256, 512].map((n) => arrayInput(s, n, n)))];
    for (const a of cases) {
      const t = run(a);
      const ph: string[] = [];
      for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.phase) ph.push(t.labels[t.events[3 * e + 1]]);
      expect([t.counts.writes, t.marks.rounds, t.marks.lanes, t.marks.phases], at(a)).toEqual([a.length, 2, a.length, 1 + new Set(a).size]);
      expect(ph[ph.length - 1], at(a)).toBe(`t = ${Math.max(...a) - Math.min(...a)}`);
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(heapBound(a.length));
    }
    expect(run(arrayInput('few-unique', 64, 4242)).marks.phases).toBe(5);
    expect(run(arrayInput('random', 64, 4242)).counts.compares).toBe(592);
  });

  it('a witness of reordered equal keys for every plate whose run shows it, and the identities kept where the test finds none', () => {
    const witness = (alg: (t: Tracer, a: Items) => Algorithm) => [2, 3, 4, 5].flatMap(words)
      .some((keys) => [1, 2, 3, 4, 5, 6, 7, 8].some((seed) => crossed(finish(alg, keys, seed).a)));
    expect({
      bogosort: witness((t, a) => bogosort(t, a, { shuffles: 0 })),
      bozosort: witness((t, a) => bozosort(t, a, newState(a.key))),
      bogobogosort: witness((t, a) => bogobogosort(t, a, { shuffles: 0, level: new Array<number>(a.key.length + 1).fill(0), prefix: 0 })),
      slowsort: witness((t, a) => slowsort(t, a, { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] })),
      stooge: witness((t, a) => stoogeSort(t, a, { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] })),
    }).toEqual({ bogosort: true, bozosort: true, bogobogosort: true, slowsort: true, stooge: true });
    expect(crossed(finish((t, a) => stoogeSort(t, a, { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] }), [2, 1, 1]).a)).toBe(true);
    expect(finish((t, a) => slowsort(t, a, { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] }), [2, 1, 1, 1]).a.tag).toEqual([1, 3, 2, 0]);
    // worstsort keeps equal keys in input order on every three-key word it takes
    for (const keys of [1, 2, 3, 4, 5].flatMap(words)) {
      const st: WorstState = { levels: 0, list: null, initial: null, pass: 0, at: -1, lex: 0, swaps: 0, passLex: [], passSwaps: [] };
      const { a } = finish((t, x) => worstsort(t, x, st), keys);
      expect(isSorted(a.key) && sameOrder(a), at(keys)).toBe(true);
    }
    // sleep sort: equal deadlines wake in thread order, so no input searched reorders equal keys
    const reorders = (keys: number[]) => {
      const r = S.run('sleep-sort', keys, { seed: seedOf(keys) });
      const tags = [...r.tags];
      return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
    };
    expect([2, 3, 4, 5, 6, 7].flatMap(words).some(reorders)).toBe(false);
  });
});
