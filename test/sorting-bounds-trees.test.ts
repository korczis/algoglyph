// Every exact count and every hard inequality the tree shelf (sorting/trees) states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (a copy is one write),
// Auxiliary writes (every cell of a drawn structure that changes) and the Phase readout. Every
// kernel of the shelf is a wasm kernel, played as its sidecar record maps it
// (src/kernels/sorting-wasm) and replayed through the array engine.
// Tree sort's comparisons are the internal path length of the tree it builds, which a TypeScript
// replica of its insertions computes; the replica is checked against the kernel on every input
// here before it stands for it. Asymptotic bounds (O(n log n), the amortised splay bound, the
// adaptive bounds in Osc or Inv) are not checked here; that every kernel sorts every shape and
// size is test/kernels-sorting-wasm.test.ts ("leaves every input shape and size sorted, as an
// independent reference does").
import { describe, expect, it } from 'vitest';
import { input, OP, SHAPES, trace, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const IDS = ['tree-sort', 'avl-tree-sort', 'splaysort', 'cartesian-tree-sort', 'patience-sorting'];
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
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const tri = (n: number) => (n < 2 ? 0 : (n * (n - 1)) / 2);
const lg = (x: number) => Math.floor(Math.log2(x));
const equal = (n: number) => new Array<number>(n).fill(7);
/** The three inputs on which every new key goes to one end of what is already built. */
const monotone = (n: number) => [input('sorted', n, 1), input('reversed', n, 1), equal(n)];
/** The phases a run entered, by name, in order. */
const phases = (t: Trace) => {
  const out: string[] = [];
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.phase) out.push(t.labels[t.events[3 * e + 1]]);
  return out;
};
/** Comparisons made inside each phase, in order. */
function comparesPerPhase(t: Trace): number[] {
  const out: number[] = [];
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.phase) out.push(0);
    else if (op === OP.compare && out.length) out[out.length - 1]++;
  }
  return out;
}
/** Comparisons made for each key the first phase reads (a kernel's own read starts a key). */
function comparesPerKey(t: Trace): number[] {
  const out: number[] = [];
  let phase = 0;
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.phase) phase++;
    else if (phase !== 1) continue;
    else if (op === OP.read) out.push(0);
    else if (op === OP.compare) out[out.length - 1]++;
  }
  return out;
}
/** The input's element identities at the end of a wasm run: whether two equal keys crossed. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const r = S.run(id, keys, { seed: seedOf(keys) });
  const tags = [...r.tags];
  return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
}
/** Inputs searched for a witness: every three-key word up to seven keys, and Few distinct keys at
 * every plate size, twenty seeds each. */
const WITNESS_INPUTS = [...[2, 3, 4, 5, 6, 7].flatMap(words),
  ...Array.from({ length: 64 }, (_, i) => 8 * (i + 1)).flatMap((n) => Array.from({ length: 20 }, (_, s) => input('few-unique', n, s + 1)))];

/** Tree sort's comparisons by a replica: insert each key into an unbalanced search tree, equal
 * keys to the right, one comparison per node passed; the sum is the tree's internal path length. */
function bstCompares(a: number[]): number {
  const key: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  let c = 0;
  for (const x of a) {
    const id = key.length;
    key.push(x);
    left.push(-1);
    right.push(-1);
    if (id === 0) continue;
    let cur = 0;
    for (;;) {
      c++;
      const side = x < key[cur] ? left : right;
      if (side[cur] < 0) { side[cur] = id; break; }
      cur = side[cur];
    }
  }
  return c;
}
/** Σ_{k=1}^{n} ⌊lg k⌋: the least internal path length of a binary tree of n nodes. */
const minPath = (n: number) => {
  let s = 0;
  for (let k = 1; k <= n; k++) s += lg(k);
  return s;
};
/** The greatest height of an AVL tree of m nodes: the largest h whose fewest nodes N(h) ≤ m, with
 * N(0) = 0, N(1) = 1 and N(h) = N(h − 1) + N(h − 2) + 1. */
function avlHeight(m: number): number {
  const N = [0, 1];
  while (N[N.length - 1] <= m) N.push(N[N.length - 1] + N[N.length - 2] + 1);
  return N.length - 2;
}
/** Σ_{m=1}^{n−1} H(m): an insertion into m nodes compares at most the tree's height. */
const avlBound = (n: number) => {
  let s = 0;
  for (let m = 1; m < n; m++) s += avlHeight(m);
  return s;
};
/** Σ_{m=1}^{n−1} (⌊lg m⌋ + 1): the right spine of the AVL tree an ascending run builds. */
const spineSum = (n: number) => {
  let s = 0;
  for (let m = 1; m < n; m++) s += lg(m) + 1;
  return s;
};
/** The longest non-decreasing subsequence, by the quadratic recurrence. */
function lnds(a: number[]): number {
  const L = a.map(() => 1);
  for (let j = 0; j < a.length; j++) for (let i = 0; i < j; i++) if (a[i] <= a[j]) L[j] = Math.max(L[j], L[i] + 1);
  return Math.max(0, ...L);
}

describe('sorting/trees: exact bounds against counted runs', () => {
  it('tree-sort: comparisons equal the internal path length of the search tree it builds', () => {
    for (const a of CASES) expect(run('tree-sort', a).counts.compares, at(a)).toBe(bstCompares(a));
  });

  it('tree-sort: n(n − 1)/2 comparisons on Already sorted, Reversed and equal keys, the most of any input; never fewer than Σ ⌊lg k⌋; n array writes, n auxiliary writes, 2 phases', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const a of monotone(n)) expect(run('tree-sort', a).counts.compares, `n=${n}`).toBe(tri(n));
      for (const shape of SHAPES) {
        const t = run('tree-sort', input(shape, n, n));
        expect([t.counts.writes, t.counts.auxWrites, t.marks.phases, t.marks.rounds, t.marks.lanes], `${shape} n=${n}`)
          .toEqual([n, n, 2, 0, 0]);
      }
    }
    for (const a of CASES) {
      const c = run('tree-sort', a).counts.compares;
      expect(c, at(a)).toBeLessThanOrEqual(tri(a.length));
      expect(c, at(a)).toBeGreaterThanOrEqual(minPath(a.length));
    }
    // both ends are reached by some permutation of every size up to eight
    for (let n = 1; n <= 8; n++) {
      const all = permutations(n).map((p) => bstCompares(p));
      expect([Math.min(...all), Math.max(...all)], `n=${n}`).toEqual([minPath(n), tri(n)]);
    }
    expect(run('tree-sort', input('sorted', 64, 1)).counts.compares).toBe(2016);
    expect([run('tree-sort', input('random', 512, 4242)).counts.compares, run('tree-sort', input('sorted', 512, 1)).counts.compares])
      .toEqual([5173, 130816]);
  });

  it('avl-tree-sort: Σ (⌊lg m⌋ + 1) comparisons on Already sorted, Reversed and equal keys; never more than Σ H(m), the AVL height bound, reached at every n up to eight', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const a of monotone(n)) expect(run('avl-tree-sort', a).counts.compares, `n=${n}`).toBe(spineSum(n));
      for (const shape of SHAPES) {
        const t = run('avl-tree-sort', input(shape, n, n));
        expect([t.counts.writes, t.counts.auxWrites, t.marks.phases], `${shape} n=${n}`).toEqual([n, n, 2]);
      }
    }
    for (const a of CASES) expect(run('avl-tree-sort', a).counts.compares, at(a)).toBeLessThanOrEqual(avlBound(a.length));
    for (let n = 1; n <= 8; n++) {
      expect(Math.max(...permutations(n).map((p) => run('avl-tree-sort', p).counts.compares)), `n=${n}`).toBe(avlBound(n));
    }
    // the height bound behind O(n log n): H(m) < 1.4405 lg(m + 2) at every size the plate offers
    for (let m = 1; m <= 512; m++) expect(avlHeight(m), `m=${m}`).toBeLessThan(1.4405 * Math.log2(m + 2));
    // Already sorted is not the worst input: at eight keys it costs 17, the worst permutation 18
    expect([spineSum(8), avlBound(8)]).toEqual([17, 18]);
    expect([run('avl-tree-sort', input('sorted', 64, 1)).counts.compares, run('avl-tree-sort', input('sorted', 512, 1)).counts.compares])
      .toEqual([321, 4097]);
    // against the unbalanced tree on the same Already sorted input
    expect(run('tree-sort', input('sorted', 512, 1)).counts.compares).toBe(130816);
  });

  it('splaysort: n − 1 comparisons on Already sorted, Reversed and equal keys, the fewest of any input; 2n − 3 on Organ pipe', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const a of monotone(n)) expect(run('splaysort', a).counts.compares, `n=${n}`).toBe(n - 1);
      if (n >= 3) expect(run('splaysort', input('organ-pipe', n, 1)).counts.compares, `n=${n}`).toBe(2 * n - 3);
      for (const shape of SHAPES) {
        const t = run('splaysort', input(shape, n, n));
        expect([t.counts.writes, t.counts.auxWrites, t.marks.phases], `${shape} n=${n}`).toEqual([n, n, 2]);
      }
    }
    for (const a of CASES) expect(run('splaysort', a).counts.compares, at(a)).toBeGreaterThanOrEqual(Math.max(0, a.length - 1));
    // adaptivity, measured on the plate's default seed: Nearly sorted costs a ninth of Random at 512 keys
    expect([run('splaysort', input('nearly-sorted', 512, 4242)).counts.compares, run('splaysort', input('random', 512, 4242)).counts.compares])
      .toEqual([597, 5135]);
    expect(run('splaysort', input('sorted', 64, 1)).counts.compares).toBe(63);
  });

  it('cartesian-tree-sort: n − 1 comparisons and 2n − 1 auxiliary writes on Already sorted, Reversed and equal keys; 2n − 3 comparisons on Organ pipe; the build never compares more than 2n − 3 times', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const a of monotone(n)) {
        const t = run('cartesian-tree-sort', a);
        expect([t.counts.compares, t.counts.auxWrites], `n=${n}`).toEqual([n - 1, 2 * n - 1]);
      }
      if (n >= 3) expect(run('cartesian-tree-sort', input('organ-pipe', n, 1)).counts.compares, `n=${n}`).toBe(2 * n - 3);
      for (const shape of SHAPES) {
        const t = run('cartesian-tree-sort', input(shape, n, n));
        expect([t.counts.writes, t.marks.phases], `${shape} n=${n}`).toEqual([n, 2]);
      }
    }
    for (const a of CASES.filter((x) => x.length >= 2)) {
      const t = run('cartesian-tree-sort', a);
      const [build] = comparesPerPhase(t);
      expect(build, at(a)).toBeGreaterThanOrEqual(a.length - 1);
      expect(build, at(a)).toBeLessThanOrEqual(2 * a.length - 3);
      expect(t.counts.compares, at(a)).toBeGreaterThanOrEqual(a.length - 1);
    }
    expect(run('cartesian-tree-sort', input('organ-pipe', 64, 1)).counts.compares).toBe(125);
  });

  it('patience-sorting: as many piles as the longest non-decreasing subsequence; each key dealt with at most ⌈lg(P + 1)⌉ comparisons; one pile and n − 1 comparisons on Reversed', () => {
    const piles = (t: Trace) => Number(/^collect from (\d+) piles$/.exec(phases(t)[1])![1]);
    for (const a of CASES.filter((x) => x.length >= 2)) {
      const t = run('patience-sorting', a);
      const P = piles(t);
      expect(P, at(a)).toBe(lnds(a));
      for (const c of comparesPerKey(t)) expect(c, at(a)).toBeLessThanOrEqual(Math.ceil(Math.log2(P + 1)));
      expect([t.counts.writes, t.counts.auxWrites, t.marks.phases], at(a)).toEqual([a.length, a.length, 2]);
    }
    for (const n of NS.filter((x) => x >= 2)) {
      const r = run('patience-sorting', input('reversed', n, 1));
      expect([piles(r), r.counts.compares], `n=${n}`).toEqual([1, n - 1]);
      expect([piles(run('patience-sorting', input('sorted', n, 1))), piles(run('patience-sorting', equal(n)))], `n=${n}`).toEqual([n, n]);
    }
    // Already sorted deals one pile per key and costs more than Random permutation at 512 keys
    expect(['sorted', 'random', 'reversed'].map((shape) => run('patience-sorting', input(shape as 'sorted', 512, 4242)).counts.compares))
      .toEqual([10798, 7584, 511]);
    const a = input('random', 64, 4242);
    expect([piles(run('patience-sorting', a)), lnds(a)]).toEqual([12, 12]);
  });

  it('a witness of reordered equal keys for every kernel whose manifest says unstable and whose run shows it', () => {
    const found = Object.fromEntries(IDS.map((id) => [id, WITNESS_INPUTS.some((a) => reordersEqualKeys(id, a))]));
    expect(found).toEqual({
      'tree-sort': false, 'avl-tree-sort': false, splaysort: false, 'cartesian-tree-sort': true, 'patience-sorting': false,
    });
    expect(reordersEqualKeys('cartesian-tree-sort', [2, 2, 1, 2])).toBe(true);
  });
});
