// Every exact count and every hard inequality the special-purpose shelf (sorting/special) states in
// a bound (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared
// with what each plate counts. Bead sort, pancake sort, spaghetti sort and tag sort are wasm
// kernels played as their sidecar records map them (src/kernels/sorting-wasm) and replayed through
// the array engine: Comparisons, Array writes (an exchange is two writes, a copy one), Auxiliary
// writes (every cell of a drawn structure that changes) and the Phase readout's count. Burnt
// pancake sort is a bespoke plate whose step-wise mirror (src/plates/burnt-pancake-sort/pancake.ts)
// test/plate-burnt-pancake-sort.test.ts proves equal to the wasm kernel; it is run here as the
// plate runs it, and its units are the plate's: flips, comparisons, swaps and turns.
// Spaghetti sort's auxiliary writes and tag sort's comparisons are computed by TypeScript replicas,
// each checked against the kernel on every input before it stands for it. The flip bounds that
// Gates and Papadimitriou, Chitturi et al. and Cohen and Blum prove are about the best method, not
// the plates' simple one, and are not checked here; that every wasm kernel sorts every shape and
// size is test/kernels-sorting-wasm.test.ts ("leaves every input shape and size sorted, as an
// independent reference does").
import { describe, expect, it } from 'vitest';
import { input, OP, SHAPES, trace, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';
import { burntPancakeSort, countUp, pancakeRun, UP, type PancakeState } from '../src/plates/burnt-pancake-sort/pancake';
import { items, Stepper, Tracer } from '../src/plates/_shared/kernel-mirror/tracer';
import { DISTINCT, input as plateInput, isSorted, runSeed } from '../src/plates/_shared/sort-input/input';

const IDS = ['bead-sort', 'pancake-sort', 'spaghetti-sort', 'tag-sort'];
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
  ...SHAPES.flatMap((shape) => [8, 16, 33, 64, 100, 128, 256, 456].flatMap((n) => [1, 2].map((s) => input(shape, n, 97 * s + n)))),
];
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const tri = (n: number) => (n < 2 ? 0 : (n * (n - 1)) / 2);
const equal = (n: number) => new Array<number>(n).fill(7);
/** The phases a run entered, by name, in order. */
const phases = (t: Trace) => {
  const out: string[] = [];
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.phase) out.push(t.labels[t.events[3 * e + 1]]);
  return out;
};
/** The input's element identities at the end of a wasm run: whether two equal keys crossed. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const r = S.run(id, keys, { seed: seedOf(keys) });
  const tags = [...r.tags];
  return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
}
/** Inputs searched for a witness: every three-key word up to seven keys, and Few distinct keys at
 * every plate size, twenty seeds each. */
const WITNESS_INPUTS = [...[2, 3, 4, 5, 6, 7].flatMap(words),
  ...Array.from({ length: 57 }, (_, i) => 8 * (i + 1)).flatMap((n) => Array.from({ length: 20 }, (_, s) => input('few-unique', n, s + 1)))];

/** Spaghetti sort's auxiliary writes by a replica: the bundle is drawn once (n cells), and every
 * removal of the rightmost longest rod shifts each rod behind it one cell left. */
function spaghettiAux(a: number[]): number {
  const bundle = a.slice();
  let w = a.length;
  while (bundle.length) {
    let best = 0;
    for (let i = 1; i < bundle.length; i++) if (bundle[i] >= bundle[best]) best = i;
    w += bundle.length - 1 - best;
    bundle.splice(best, 1);
  }
  return w;
}
/** Tag sort's comparisons by a replica: top-down merge sort of the tags, the left half ⌊n/2⌋ keys,
 * a right key taken only when strictly smaller. */
function mergeCompares(a: number[]): number {
  const sort = (xs: number[]): [number[], number] => {
    if (xs.length < 2) return [xs, 0];
    const mid = Math.floor(xs.length / 2);
    const [l, cl] = sort(xs.slice(0, mid));
    const [r, cr] = sort(xs.slice(mid));
    const out: number[] = [];
    let [i, j, c] = [0, 0, 0];
    while (i < l.length && j < r.length) {
      c++;
      if (r[j] < l[i]) out.push(r[j++]);
      else out.push(l[i++]);
    }
    return [[...out, ...l.slice(i), ...r.slice(j)], cl + cr + c];
  };
  return sort(a)[1];
}
/** Records not at their place in the stable sorted order: the records the cycle walk moves. */
const misplaced = (a: number[]) => a.map((_, i) => i).sort((x, y) => a[x] - a[y] || x - y).filter((x, i) => x !== i).length;
/** The merge sort worst case n⌈lg n⌉ − 2^⌈lg n⌉ + 1. */
const mergeWorst = (n: number) => {
  if (n < 2) return 0;
  const L = Math.ceil(Math.log2(n));
  return n * L - 2 ** L + 1;
};

/** Burnt pancake sort as the plate runs it, from any keys and any orientation (true: burnt side up). */
function burnt(keys: number[], up: boolean[]): { flips: number; cmp: number; swap: number; write: number; sorted: boolean; upLeft: number } {
  const a = items(keys);
  a.tag = a.tag.map((x, i) => (up[i] ? (x | UP) >>> 0 : x));
  const t = new Tracer(1);
  const st: PancakeState = { flips: 0, flipping: 0, upAtStart: 0 };
  // a stack with no burnt side up is drawn first by the kernel's generator; the plate's "all down"
  // start skips that draw, as these exhaustive cases do
  const s = new Stepper(burntPancakeSort(t, a, st, false), t);
  s.finish();
  return { flips: st.flips, ...t.counts, sorted: isSorted(a.key), upLeft: countUp(a) };
}

describe('sorting/special: exact bounds against counted runs', () => {
  it('bead-sort: no comparison, n array writes and 2 phases on every input; the pole heights drawn after every fourth row, at most ⌈n/4⌉(max − min) auxiliary writes, none for keys all equal', () => {
    for (const a of CASES.filter((x) => x.length >= 1)) {
      const t = run('bead-sort', a);
      expect([t.counts.compares, t.counts.writes, t.marks.phases], at(a)).toEqual([0, a.length, 2]);
      expect(t.counts.auxWrites, at(a)).toBeLessThanOrEqual(Math.ceil(a.length / 4) * (Math.max(...a) - Math.min(...a)));
      // every auxiliary write follows the read of row 4, 8, … or of the last row (reads before the
      // drop are the adapter's copy and the kernel's search for the key range)
      let rows = -1;
      for (let e = 0; e < t.length; e++) {
        const op = t.events[3 * e];
        if (op === OP.phase) rows = rows < 0 ? 0 : rows;
        else if (op === OP.read && rows >= 0) rows++;
        else if (op === OP.auxWrite) expect(rows % 4 === 0 || rows === a.length, at(a)).toBe(true);
      }
    }
    for (const n of NS.filter((x) => x >= 1)) expect(run('bead-sort', equal(n)).counts.auxWrites, `n=${n}`).toBe(0);
    for (const shape of SHAPES) {
      const a = input(shape, 512, 4242);
      expect(run('bead-sort', a).counts.auxWrites, shape).toBeLessThanOrEqual(128 * (Math.max(...a) - Math.min(...a)));
    }
    // the beads the kernel moves are Σ (key − min); the plate counts only the pole heights it draws
    const a = input('random', 64, 4242);
    expect([run('bead-sort', a).counts.auxWrites, a.reduce((s, x) => s + x - Math.min(...a), 0)]).toEqual([855, 2016]);
  });

  it('pancake-sort: n(n − 1)/2 comparisons on every input; at most 2n − 3 flips, reached at every n from 2 to 8; one flip on Reversed, none on Already sorted', () => {
    for (const a of CASES) {
      const t = run('pancake-sort', a);
      const flips = phases(t);
      expect(t.counts.compares, at(a)).toBe(tri(a.length));
      if (a.length >= 2) expect(flips.length, at(a)).toBeLessThanOrEqual(2 * a.length - 3);
      // a flip of k pancakes is ⌊k/2⌋ exchanges
      const ks = flips.map((x) => Number(/reverse the top (\d+)$/.exec(x)![1]));
      expect(t.counts.writes, at(a)).toBe(ks.reduce((s, k) => s + 2 * Math.floor(k / 2), 0));
    }
    for (let n = 2; n <= 8; n++) {
      expect(Math.max(...permutations(n).map((p) => run('pancake-sort', p).marks.phases)), `n=${n}`).toBe(2 * n - 3);
    }
    for (const n of NS.filter((x) => x >= 2)) {
      const r = run('pancake-sort', input('reversed', n, 1));
      expect([r.marks.phases, r.counts.writes], `n=${n}`).toEqual([1, 2 * Math.floor(n / 2)]);
      const s = run('pancake-sort', input('sorted', n, 1));
      expect([s.marks.phases, s.counts.writes, s.counts.compares], `n=${n}`).toEqual([0, 0, tri(n)]);
    }
    expect(run('pancake-sort', input('reversed', 64, 1)).counts.writes).toBe(64);
  });

  it('spaghetti-sort: n(n − 1)/2 comparisons, n array writes and n + 1 phases on every input; auxiliary writes n plus the rods shifted, from n on Already sorted to n(n + 1)/2 on Reversed', () => {
    for (const a of CASES) {
      const t = run('spaghetti-sort', a);
      expect([t.counts.compares, t.counts.writes, t.marks.phases], at(a)).toEqual([tri(a.length), a.length, a.length + 1]);
      expect(t.counts.auxWrites, at(a)).toBe(spaghettiAux(a));
      expect(t.counts.auxWrites, at(a)).toBeGreaterThanOrEqual(a.length);
      expect(t.counts.auxWrites, at(a)).toBeLessThanOrEqual((a.length * (a.length + 1)) / 2);
    }
    for (const n of NS.filter((x) => x >= 1 && x <= 456)) {
      expect(run('spaghetti-sort', input('sorted', n, 1)).counts.auxWrites, `n=${n}`).toBe(n);
      expect(run('spaghetti-sort', input('reversed', n, 1)).counts.auxWrites, `n=${n}`).toBe((n * (n + 1)) / 2);
    }
    expect(run('spaghetti-sort', input('random', 64, 4242)).counts.compares).toBe(2016);
  });

  it('tag-sort: the comparisons of a top-down merge sort, at most n⌈lg n⌉ − 2^⌈lg n⌉ + 1, reached at every n up to 8; array writes the records out of place, auxiliary writes n more', () => {
    for (const a of CASES) {
      const t = run('tag-sort', a);
      expect(t.counts.compares, at(a)).toBe(mergeCompares(a));
      expect(t.counts.compares, at(a)).toBeLessThanOrEqual(mergeWorst(a.length));
      expect([t.counts.writes, t.counts.auxWrites, t.marks.phases], at(a)).toEqual([misplaced(a), a.length + misplaced(a), 3]);
    }
    for (let n = 2; n <= 8; n++) expect(Math.max(...permutations(n).map(mergeCompares)), `n=${n}`).toBe(mergeWorst(n));
    for (const n of NS.filter((x) => x >= 2)) {
      expect(run('tag-sort', input('sorted', n, 1)).counts.writes, `n=${n}`).toBe(0);
      // Reversed: every record moves once, except the middle one of an odd count
      expect(run('tag-sort', input('reversed', n, 1)).counts.writes, `n=${n}`).toBe(n - (n % 2));
    }
    expect([run('tag-sort', input('reversed', 64, 1)).counts.writes, run('tag-sort', input('reversed', 64, 1)).counts.compares]).toEqual([64, 192]);
  });

  it('burnt-pancake-sort: n(n − 1)/2 comparisons on every stack; at most 3n − 2 flips, reached by Already sorted with every burnt side up; every stack ends in order, burnt sides down', () => {
    // every signed permutation of up to five pancakes
    for (let n = 1; n <= 5; n++) {
      let most = 0;
      for (const p of permutations(n)) {
        for (let mask = 0; mask < 2 ** n; mask++) {
          const r = burnt(p, p.map((_, i) => ((mask >> i) & 1) === 1));
          expect([r.sorted, r.upLeft, r.cmp], `${p} ${mask}`).toEqual([true, 0, tri(n)]);
          expect(r.flips, `${p} ${mask}`).toBeLessThanOrEqual(3 * n - 2);
          most = Math.max(most, r.flips);
        }
      }
      expect(most, `n=${n}`).toBe(3 * n - 2);
    }
    for (let n = 1; n <= 40; n++) {
      const sorted = Array.from({ length: n }, (_, i) => i + 1);
      const up = burnt(sorted, sorted.map(() => true));
      expect([up.flips, up.cmp], `n=${n}`).toEqual([3 * n - 2, tri(n)]);
      expect(burnt(sorted, sorted.map(() => false)).flips, `n=${n}`).toBe(0);
      // the plate's own runs: every shape, every start, within 3n − 2 flips
      for (const shape of DISTINCT) {
        for (const orient of ['random', 'up', 'down'] as const) {
          const seed = runSeed(4242, n);
          const r = pancakeRun(plateInput(shape, n, seed), seed, orient);
          r.stepper.finish();
          expect(r.state.flips, `${shape} ${orient} n=${n}`).toBeLessThanOrEqual(3 * n - 2);
          expect(r.stepper.t.counts.cmp, `${shape} ${orient} n=${n}`).toBe(tri(n));
        }
      }
    }
  });

  it('a witness of reordered equal keys for every kernel whose manifest says unstable and whose run shows it', () => {
    const found = Object.fromEntries(IDS.map((id) => [id, WITNESS_INPUTS.some((a) => reordersEqualKeys(id, a))]));
    expect(found).toEqual({ 'bead-sort': false, 'pancake-sort': true, 'spaghetti-sort': false, 'tag-sort': false });
    expect(reordersEqualKeys('pancake-sort', [2, 1, 1])).toBe(true);
    // burnt pancake sort, as its plate's mirror runs it: two equal pancakes, burnt sides down, cross
    const a = items([2, 1, 1]);
    const t = new Tracer(1);
    new Stepper(burntPancakeSort(t, a, { flips: 0, flipping: 0, upAtStart: 0 }, false), t).finish();
    expect(a.tag.map((x) => x & ~UP & 0x7fffffff)).toEqual([2, 1, 0]);
  });
});
