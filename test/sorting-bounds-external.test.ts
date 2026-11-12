// Every exact count and every hard inequality the external shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the engines count for the plate. The entries of IDS are array-engine plates that play
// the wasm kernel their sidecar record maps (src/kernels/sorting-wasm), replayed through the array
// engine:
// Comparisons, Array writes (an exchange is two writes, a copy one), Auxiliary writes (every cell
// of a drawn structure that changes), the Passes readout (the kernel's own round() calls, one per
// pass over the data) and the Phase readout. The kernels simulate a memory of M keys,
// M = max(4, ⌈√n⌉), on the array as the file; polyphase, cascade and oscillating merging, the
// distribution sorts, funnelsort and the buffer tree mark phases only, never a whole pass.
// Balanced multiway merging is a custom plate (src/plates/balanced-multiway-merge/merge.ts):
// Runs on the tapes, Merge passes done, Records written. Replacement selection is a tree-engine
// plate (src/kernels/tree/replacement-selection.ts): Runs written and Average run length.
// Block transfers (Aggarwal and Vitter's I/O model) are what the entries' notes reason about; the
// plates count element operations and passes, and only those are checked here. Asymptotic bounds
// are not checked; that every kernel sorts every shape and size is
// test/kernels-sorting-wasm.test.ts ("leaves every input shape and size sorted, as an independent
// reference does"), and that the two custom-engine plates sort is test/plates-custom.test.ts and
// test/kernels-tree.test.ts.
import { describe, expect, it } from 'vitest';
import { input, OP, SHAPES, trace, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';
import { trace as treeTrace, workload } from '../src/engines/tree/trace';
import { kernel as replacementSelection } from '../src/kernels/tree/replacement-selection';
import { sortExternally } from '../src/plates/balanced-multiway-merge/merge';

const IDS = ['external-merge-sort', 'two-phase-multiway-merge-sort', 'tape-merge-sort', 'polyphase-merge-sort',
  'cascade-merge-sort', 'oscillating-merge-sort', 'external-radix-sort', 'external-quicksort', 'external-samplesort',
  'external-bucket-sort', 'funnel-sort', 'buffer-tree-sort'];
const K = Object.fromEntries(await Promise.all(IDS.map(async (id) => [id, await sidecarKernel(id)] as const)));
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
/** Sizes an exact formula is checked at: every n to 64, every size of the plate's grid, and edges. */
const NS = [...new Set([...Array.from({ length: 65 }, (_, n) => n), ...Array.from({ length: 64 }, (_, i) => 8 * (i + 1)),
  100, 127, 129, 255, 257, 511])].sort((a, b) => a - b);
/** The inputs every inequality is checked on: all permutations and three-key words up to six keys,
 * and every plate shape at the plate's sizes, two seeds each. */
const CASES: number[][] = [
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
  ...SHAPES.flatMap((shape) => [8, 16, 33, 64, 100, 128, 256, 512].flatMap((n) => [1, 2].map((s) => input(shape, n, 97 * s + n)))),
];

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
/** The phases a run entered, by name, in order. */
const phases = (t: Trace) => {
  const out: string[] = [];
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.phase) out.push(t.labels[t.events[3 * e + 1]]);
  return out;
};
/** Comparisons, array writes and auxiliary writes made inside each phase, in order. */
function perPhase(t: Trace): { name: string; compares: number; writes: number }[] {
  const out: { name: string; compares: number; writes: number }[] = [];
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.phase) out.push({ name: t.labels[t.events[3 * e + 1]], compares: 0, writes: 0 });
    else if (out.length && op === OP.compare) out.at(-1)!.compares++;
    else if (out.length && op === OP.write) out.at(-1)!.writes++;
    else if (out.length && op === OP.swap) out.at(-1)!.writes += 2;
  }
  return out;
}
/** The kernels' memory: max(4, ⌈√n⌉) keys. */
const memory = (n: number) => { let m = 4; while (m * m < n) m++; return m; };
/** The lengths of the memory loads (initial runs) of n keys with a memory of m. */
const loads = (n: number, m: number) => Array.from({ length: Math.ceil(n / m) }, (_, i) => Math.min(m, n - i * m));
const ceilLog = (b: number, x: number) => { let p = 0; for (let c = 1; c < x; c *= b) p++; return p; };
/** An upper bound on the kernels' in-memory merge sort of L keys: one test whether the halves are
 * already in order, then at most L − 1 comparisons to merge them. */
const memSortMax = (L: number): number => (L < 2 ? 0 : memSortMax(Math.floor(L / 2)) + memSortMax(Math.ceil(L / 2)) + L);
/**
 * Merging consecutive runs k at a time until one is left, on keys already in order: the head scan
 * compares the live heads, so a key of the i-th run of a group (from 0) costs g − 1 − i
 * comparisons while the g − i runs from it on are live. Returns the comparisons and the passes.
 */
function sortedMerges(lengths: number[], k: number): { compares: number; passes: number } {
  let [compares, passes, runs] = [0, 0, lengths];
  while (runs.length > 1) {
    const next: number[] = [];
    for (let g = 0; g < runs.length; g += k) {
      const group = runs.slice(g, g + k);
      group.forEach((L, i) => { compares += L * (group.length - 1 - i); });
      next.push(group.reduce((s, L) => s + L, 0));
    }
    runs = next;
    passes++;
  }
  return { compares, passes };
}
/** The input's element identities at the end of a wasm run: whether two equal keys crossed. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const r = S.run(id, keys, { seed: seedOf(keys) });
  const tags = [...r.tags];
  return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
}
/** Inputs searched for a witness: every three-key word up to seven keys, and Few distinct keys at every
 * plate size, twenty seeds each. */
const WITNESS_INPUTS = [...[2, 3, 4, 5, 6, 7].flatMap(words),
  ...Array.from({ length: 64 }, (_, i) => 8 * (i + 1)).flatMap((n) => Array.from({ length: 20 }, (_, s) => input('few-unique', n, s + 1)))];
const witnessOf = (id: string) => WITNESS_INPUTS.find((a) => reordersEqualKeys(id, a));

describe('sorting/external: exact bounds against counted runs', () => {
  it('external-merge-sort: 1 + ⌈log₄ r⌉ passes for r = ⌈n/M⌉ runs, n array writes; on Already sorted (n − r) plus the head scans\' comparisons and 2n auxiliary writes', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const M = memory(n);
      const L = loads(n, M);
      for (const shape of SHAPES) {
        const t = run('external-merge-sort', input(shape, n, n));
        const passes = 1 + ceilLog(4, L.length);
        expect([t.marks.rounds, t.counts.writes, t.counts.swaps], `${shape} n=${n}`).toEqual([passes, n, 0]);
        expect(t.counts.compares, `${shape} n=${n}`).toBeLessThanOrEqual(L.reduce((s, x) => s + memSortMax(x), 0) + 3 * n * (passes - 1));
        expect(t.counts.auxWrites, `${shape} n=${n}`).toBeLessThanOrEqual(n * (passes + 2));
      }
      const sorted = run('external-merge-sort', input('sorted', n, 1));
      const m = sortedMerges(L, 4);
      expect([sorted.counts.compares, sorted.counts.auxWrites], `n=${n}`).toEqual([n - L.length + m.compares, 2 * n]);
    }
    // what the plate reads at 512 keys: 23 runs of at most 23 keys, then three merge passes
    const t = run('external-merge-sort', input('random', 512, 4242));
    expect([t.marks.rounds, phases(t)[0]]).toEqual([4, 'phase 1: run generation, memory M = 23']);
    expect(run('external-merge-sort', input('sorted', 512, 1)).counts.compares).toBe(2260);
    expect(t.counts.compares).toBe(5240);
  });

  it('two-phase-multiway-merge-sort: 2 passes from 2 keys on, memory 2M, n array writes; on Already sorted (n − r) plus one head scan, 4n auxiliary writes', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const M2 = 2 * memory(n);
      const L = loads(n, M2);
      for (const shape of SHAPES) {
        const t = run('two-phase-multiway-merge-sort', input(shape, n, n));
        expect([t.marks.rounds, t.counts.writes, t.counts.swaps], `${shape} n=${n}`).toEqual([2, n, 0]);
        expect(t.counts.compares, `${shape} n=${n}`).toBeLessThanOrEqual(L.reduce((s, x) => s + memSortMax(x), 0) + (L.length - 1) * n);
        expect(t.counts.auxWrites, `${shape} n=${n}`).toBeLessThanOrEqual(5 * n);
        expect(phases(t)[1], `${shape} n=${n}`).toBe(`phase 2: one ${L.length}-way merge with blocks of B = ${Math.max(1, Math.floor(M2 / (L.length + 1)))}`);
      }
      const sorted = run('two-phase-multiway-merge-sort', input('sorted', n, 1));
      expect([sorted.counts.compares, sorted.counts.auxWrites], `n=${n}`).toEqual([n - L.length + sortedMerges(L, L.length).compares, 4 * n]);
    }
    expect(phases(run('two-phase-multiway-merge-sort', input('random', 512, 4242))))
      .toEqual(['phase 1: sort sublists of M = 46 items', 'phase 2: one 12-way merge with blocks of B = 3']);
    expect(run('two-phase-multiway-merge-sort', input('sorted', 512, 1)).counts.compares).toBe(3536);
    // one head scan over 12 sublists costs more comparisons than three over four runs
    expect([run('two-phase-multiway-merge-sort', input('random', 512, 4242)).counts.compares,
      run('external-merge-sort', input('random', 512, 4242)).counts.compares]).toEqual([8073, 5240]);
  });

  it('tape-merge-sort: 1 + 2⌈lg r⌉ passes, a distribution and a merge for every halving; n array writes; on Already sorted (passes + 1)·n auxiliary writes', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const L = loads(n, memory(n));
      const passes = 1 + 2 * ceilLog(2, L.length);
      for (const shape of SHAPES) {
        const t = run('tape-merge-sort', input(shape, n, n));
        expect([t.marks.rounds, t.counts.writes], `${shape} n=${n}`).toEqual([passes, n]);
        expect(t.counts.compares, `${shape} n=${n}`).toBeLessThanOrEqual(L.reduce((s, x) => s + memSortMax(x), 0) + n * ceilLog(2, L.length));
      }
      const sorted = run('tape-merge-sort', input('sorted', n, 1));
      // its merges are those of a two-way external merge sort: run i of B and run i of C are neighbours
      expect([sorted.counts.compares, sorted.counts.auxWrites], `n=${n}`).toEqual([n - L.length + sortedMerges(L, 2).compares, (passes + 1) * n]);
    }
    expect(run('tape-merge-sort', input('random', 512, 4242)).marks.rounds).toBe(11);
  });

  it('polyphase-merge-sort: no whole pass; the smallest Fibonacci level of order 2 holding the r runs gives its merge phases, level + 3 phases in all', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const r = loads(n, memory(n)).length;
      let [a, b, level] = [1, 0, 0];
      while (a + b < r) { [a, b] = [a + b, a]; level++; }
      for (const shape of SHAPES) {
        const t = run('polyphase-merge-sort', input(shape, n, n));
        const ph = phases(t);
        expect([t.marks.rounds, t.marks.phases, t.counts.writes], `${shape} n=${n}`).toEqual([0, level + 3, n]);
        expect(ph[1], `${shape} n=${n}`).toBe(`distribution: level ${level} of order 2: [${a}, ${b}] runs, ${a + b - r} of them dummy`);
        // each phase merges a key at most once, two runs at a time: at most one comparison per key and phase
        expect(t.counts.compares, `${shape} n=${n}`).toBeLessThanOrEqual(loads(n, memory(n)).reduce((s, x) => s + memSortMax(x), 0) + n * level);
        // the merges of each phase are the shorter input tape's runs: Fibonacci numbers, falling
        const merges = ph.slice(2, -1).map((x) => Number(/: (\d+) merges/.exec(x)![1]));
        const fib = [1, 1];
        while (fib.length < level) fib.unshift(fib[0] + fib[1]);
        expect(merges, `${shape} n=${n}`).toEqual(fib.slice(fib.length - level));
      }
    }
    expect(run('polyphase-merge-sort', input('random', 512, 4242)).marks.phases).toBe(10);
  });

  it('cascade-merge-sort: no whole pass; a cascade level L holds the r runs, and L cascades of three merging steps less the last two give 3L + 1 phases', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const r = loads(n, memory(n)).length;
      let [lv, lev] = [0, [1, 0, 0]];
      while (lev[0] + lev[1] + lev[2] < r) { lev = [lev[0] + lev[1] + lev[2], lev[0] + lev[1], lev[0]]; lv++; }
      for (const shape of SHAPES) {
        const t = run('cascade-merge-sort', input(shape, n, n));
        expect([t.marks.rounds, t.counts.writes], `${shape} n=${n}`).toEqual([0, n]);
        expect(t.marks.phases, `${shape} n=${n}`).toBe(lv === 0 ? 3 : 3 * lv + 1);
        expect(phases(t)[1], `${shape} n=${n}`).toBe(`distribution: cascade level ${lv}: [${lev.join(', ')}] runs, ${lev[0] + lev[1] + lev[2] - r} of them dummy`);
        // a cascade merges a key at most once, at most three ways: two comparisons per key and cascade
        expect(t.counts.compares, `${shape} n=${n}`).toBeLessThanOrEqual(loads(n, memory(n)).reduce((s, x) => s + memSortMax(x), 0) + 2 * n * lv);
        // the copy that ends a cascade moves a tape without a comparison
        for (const p of perPhase(t)) if (p.name.includes('1-way copy')) expect(p.compares, `${shape} n=${n}`).toBe(0);
      }
    }
    expect(run('cascade-merge-sort', input('random', 512, 4242)).marks.phases).toBe(13);
  });

  it('oscillating-merge-sort: L = ⌈log₃ r⌉ levels, every key written to a tape once per level: (L + 1)·n auxiliary writes; r loads and (3^L − 1)/2 merges', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const r = loads(n, memory(n)).length;
      const L = ceilLog(3, r);
      for (const shape of SHAPES) {
        const t = run('oscillating-merge-sort', input(shape, n, n));
        expect([t.marks.rounds, t.counts.writes, t.counts.auxWrites, t.marks.phases], `${shape} n=${n}`)
          .toEqual([0, n, (L + 1) * n, r + (3 ** L - 1) / 2 + 2]);
        expect(t.counts.compares, `${shape} n=${n}`).toBeLessThanOrEqual(loads(n, memory(n)).reduce((s, x) => s + memSortMax(x), 0) + 2 * n * L);
      }
    }
    // the first merge comes before the last load: run formation and merging alternate
    const ph = phases(run('oscillating-merge-sort', input('random', 512, 4242)));
    expect(ph.length).toBe(38);
    expect(ph.findIndex((x) => x.startsWith('merge'))).toBeLessThan(ph.length - 1 - [...ph].reverse().findIndex((x) => x.startsWith('read and sort')));
    expect(ph.slice(0, 5).map((x) => x.split(' ')[0])).toEqual(['4', 'read', 'read', 'read', 'merge']);
    expect(ph.filter((x) => x.startsWith('read and sort')).length).toBe(23);
  });

  it('external-radix-sort: no comparison; one pass per base-16 digit of max − min, n array writes and n auxiliary writes in each', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const a = input(shape, n, n);
        const range = Math.max(...a) - Math.min(...a);
        let d = 1;
        while (16 ** d <= range) d++;
        const t = run('external-radix-sort', a);
        expect([t.counts.compares, t.marks.rounds, t.counts.writes, t.counts.auxWrites], `${shape} n=${n}`).toEqual([0, d, d * n, d * n]);
      }
    }
    expect(run('external-radix-sort', input('random', 512, 4242)).marks.rounds).toBe(3);
    expect(run('external-radix-sort', input('few-unique', 512, 4242)).marks.rounds).toBe(1);
  });

  it('external-quicksort: every partition reads a part larger than M and writes each of its keys once; Already sorted costs more comparisons than Random', () => {
    for (const a of CASES.filter((x) => x.length >= 2)) {
      const t = run('external-quicksort', a);
      const M = memory(a.length);
      // a partition is marked over its part; an internal sort writes its part and nothing else
      const parts: number[] = [];
      for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.range) parts.push(t.events[3 * e + 2] - t.events[3 * e + 1] + 1);
      expect(parts.every((s) => s > M), at(a)).toBe(true);
      expect(parts.length, at(a)).toBe(phases(t).filter((x) => x.startsWith('partition')).length);
      for (const p of perPhase(t)) if (p.name.startsWith('partition')) expect(p.writes, at(a)).toBeGreaterThan(M);
      expect(t.counts.swaps, at(a)).toBe(0);
    }
    // Already sorted: every key after the first M lies between the middle group's ends and is
    // inserted by binary search; Random sends most keys straight to a side
    for (const n of [64, 128, 256, 384, 512]) {
      expect(run('external-quicksort', input('sorted', n, 1)).counts.compares, `n=${n}`)
        .toBeGreaterThan(1.5 * run('external-quicksort', input('random', n, 4242)).counts.compares);
    }
    expect([run('external-quicksort', input('sorted', 512, 1)).counts.compares, run('external-quicksort', input('random', 512, 4242)).counts.compares])
      .toEqual([10721, 5722]);
  });

  it('external-samplesort: each distribution compares a key two or three times; auxiliary writes are the array writes plus three splitters per distribution', () => {
    for (const a of CASES.filter((x) => x.length >= 2)) {
      const t = run('external-samplesort', a);
      const per = perPhase(t);
      const dists = per.filter((p) => p.name.endsWith('distribute into bucket files'));
      for (const p of dists) {
        expect(p.compares, at(a)).toBeGreaterThanOrEqual(2 * p.writes);
        expect(p.compares, at(a)).toBeLessThanOrEqual(3 * p.writes);
      }
      expect(t.counts.auxWrites, at(a)).toBe(t.counts.writes + 3 * dists.length);
    }
    // keys equal to a splitter need no further work: Few distinct keys at 512 takes two distributions
    expect(phases(run('external-samplesort', input('few-unique', 512, 4242))).length).toBe(4);
  });

  it('external-bucket-sort: comparisons only inside memory loads; on a permutation the buckets, writes and Already sorted comparisons depend on n alone', () => {
    /** Writes, and comparisons on Already sorted, for the consecutive keys lo..hi (equal-width buckets of k = 4). */
    const shape = (lo: number, hi: number, M: number): [number, number] => {
      const s = hi - lo + 1;
      if (s < 2) return [0, 0];
      if (s <= M) return [s, s - 1];
      const parts = [[], [], [], []] as number[][];
      for (let x = lo; x <= hi; x++) parts[Math.floor(((x - lo) * 4) / s)].push(x);
      return parts.filter((p) => p.length).map((p) => shape(p[0], p.at(-1)!, M)).reduce(([w, c], [w2, c2]) => [w + w2, c + c2], [s, 0]);
    };
    for (const n of NS.filter((x) => x >= 2)) {
      const [w, c] = shape(1, n, memory(n));
      for (const sh of ['random', 'nearly-sorted', 'reversed', 'sorted'] as const) {
        const t = run('external-bucket-sort', input(sh, n, n));
        expect([t.counts.writes, t.counts.auxWrites], `${sh} n=${n}`).toEqual([w, w]);
      }
      expect(run('external-bucket-sort', input('sorted', n, 1)).counts.compares, `n=${n}`).toBe(c);
      // keys 1..4 from 128 keys on: every bucket of the first distribution holds one key value and
      // more keys than memory, so it is finished without a comparison
      if (n >= 128) {
        for (const seed of [1, 2, 3]) {
          expect(run('external-bucket-sort', input('few-unique', n, seed)).counts, `n=${n}`).toMatchObject({ compares: 0, writes: n, auxWrites: n });
        }
      }
    }
    for (const a of CASES) {
      const t = run('external-bucket-sort', a);
      expect(t.counts.writes, at(a)).toBe(t.counts.auxWrites);
      for (const p of perPhase(t)) if (!p.name.endsWith('internal sort')) expect(p.compares, at(a)).toBe(0);
    }
    expect(run('external-bucket-sort', input('random', 512, 4242)).counts.writes).toBe(2048);
  });

  it('funnel-sort: segments of at most 8 keys by insertion; the funnels\' buffers take the same auxiliary writes on every input of n keys', () => {
    /** Auxiliary writes, funnel merges and Already sorted array writes of funnelsort on n keys. */
    const funnel = (n: number): [number, number, number] => {
      if (n <= 8) return [0, 0, 0];
      let k = 2;
      while (k * k * k < n) k++;
      const seg = Math.ceil(n / k);
      const sizes = Array.from({ length: k }, (_, i) => Math.min(n, (i + 1) * seg) - Math.min(n, i * seg)).filter((x) => x > 0);
      // every internal node of the merge tree buffers the keys of its subtree; the root holds all n
      const tree = (a: number, b: number): number => (b - a === 1 ? 0
        : sizes.slice(a, b).reduce((s, x) => s + x, 0) + tree(a, a + Math.floor((b - a) / 2)) + tree(a + Math.floor((b - a) / 2), b));
      return sizes.map(funnel).reduce(([x, m, w], [x2, m2, w2]) => [x + x2, m + m2, w + w2], [tree(0, sizes.length), 1, n]);
    };
    for (const n of NS) {
      const [aux, merges, sortedWrites] = funnel(n);
      for (const shape of SHAPES) {
        const t = run('funnel-sort', input(shape, n, n));
        expect([t.counts.auxWrites, t.marks.phases], `${shape} n=${n}`).toEqual([aux, merges]);
      }
      expect(run('funnel-sort', input('sorted', n, 1)).counts.writes, `n=${n}`).toBe(sortedWrites);
    }
    for (const a of CASES) expect(run('funnel-sort', a).counts.auxWrites, at(a)).toBe(funnel(a.length)[0]);
    // up to 8 keys insertion sort alone; from 9 to 24 keys a single 3-funnel over three segments of at most 8
    for (let n = 0; n <= 24; n++) {
      expect(phases(run('funnel-sort', input('random', n, n))), `n=${n}`).toEqual(n <= 8 ? [] : ['depth 0: merge 3 sorted segments with a 3-funnel']);
    }
    expect(funnel(512)).toEqual([3392, 41, 1536]);
  });

  it('buffer-tree-sort: n array writes and n auxiliary writes; the root buffer is emptied ⌊n/M⌋ times', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('buffer-tree-sort', input(shape, n, n));
        const ph = phases(t);
        expect([t.counts.writes, t.counts.auxWrites, t.marks.rounds], `${shape} n=${n}`).toEqual([n, n, 0]);
        expect(ph.filter((x) => x.startsWith('root buffer full')).length, `${shape} n=${n}`).toBe(Math.floor(n / memory(n)));
        expect(ph.length, `${shape} n=${n}`).toBe(2 + Math.floor(n / memory(n)) + ph.filter((x) => x.startsWith('the root split')).length);
      }
    }
  });

  it('balanced-multiway-merge: ⌈log_P ⌈N/M⌉⌉ merge passes, each dividing the runs by P rounding up; N records written per pass and N in the distribution', () => {
    for (const N of [20, 100, 240, 600]) {
      for (let M = 2; M <= 60; M++) {
        for (let P = 2; P <= 6; P++) {
          const keys = Array.from({ length: N }, (_, i) => (i * 7919 + M * 31 + P) % 1000);
          const { output, s } = sortExternally(keys, M, P);
          const r = Math.ceil(N / M);
          const passes = ceilLog(P, r);
          const after = [r];
          while (after.at(-1)! > 1) after.push(Math.ceil(after.at(-1)! / P));
          expect([s.pass, s.writes, s.runsAfter], `N=${N} M=${M} P=${P}`).toEqual([passes, N * (1 + passes), after]);
          expect(output, `N=${N} M=${M} P=${P}`).toEqual(keys.slice().sort((x, y) => x - y));
        }
      }
    }
    // the plate's defaults: 240 records, M = 8, P = 3: 30 runs, then 10, 4, 2, 1
    expect(sortExternally(Array.from({ length: 240 }, (_, i) => i), 8, 3).s.runsAfter).toEqual([30, 10, 4, 2, 1]);
  });

  it('replacement-selection: every run but the last holds at least M keys; Ascending is one run, Descending runs of exactly M', () => {
    const runsOf = (shape: string, n: number, M: number, seed = 1) => {
      const t = treeTrace(replacementSelection, workload('keys', shape, n, seed, { memory: M }));
      const len = new Map<number, number>();
      for (const o of t.outputs) len.set(o.group, (len.get(o.group) ?? 0) + 1);
      return [...len.keys()].sort((a, b) => a - b).map((g) => len.get(g)!);
    };
    for (const n of [2, 3, 8, 31, 64, 100, 200, 255]) {
      for (const M of [2, 3, 4, 8, 16, 33, 64]) {
        for (const seed of [1, 2, 3]) {
          for (const shape of ['random', 'zigzag']) {
            const lens = runsOf(shape, n, M, seed);
            expect(lens.reduce((s, x) => s + x, 0), `${shape} n=${n} M=${M}`).toBe(n);
            expect(lens.slice(0, -1).every((x) => x >= Math.min(M, n)), `${shape} n=${n} M=${M}: ${lens}`).toBe(true);
          }
        }
        expect(runsOf('ascending', n, M), `n=${n} M=${M}`).toEqual([n]);
        const m = Math.min(M, n);
        const desc = runsOf('descending', n, M);
        expect(desc, `n=${n} M=${M}`).toEqual([...new Array(Math.floor(n / m)).fill(m), ...(n % m ? [n % m] : [])]);
      }
    }
  });

  it('a witness of reordered equal keys for every external kernel whose manifest says unstable and whose run shows it', () => {
    const found = Object.fromEntries(['polyphase-merge-sort', 'cascade-merge-sort', 'oscillating-merge-sort', 'external-quicksort',
      'external-samplesort', 'funnel-sort', 'buffer-tree-sort'].map((id) => [id, witnessOf(id) !== undefined]));
    expect(found).toEqual(WITNESSED);
  });
});

/** Kernels with a witness (stable: false in the entry); the others keep equal keys in order on every input tried. */
const WITNESSED: Record<string, boolean> = {
  'polyphase-merge-sort': true, 'cascade-merge-sort': true, 'oscillating-merge-sort': false, 'external-quicksort': true,
  'external-samplesort': false, 'funnel-sort': false, 'buffer-tree-sort': false,
};
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;
