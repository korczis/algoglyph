// Every exact count or hard inequality the searching wing's tree-engine entries state in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and compared with what the kernel
// counts (src/engines/tree/trace.ts) or the height the plate measures (src/engines/tree/scene.ts
// shape(), the "Height ... levels" readout). Expected, amortised and "about" bounds are not checked
// here. Bounds already proved elsewhere, so each has one test:
//   avl-tree "below about 1.44 lg n levels": test/kernels-tree.test.ts, 'an AVL tree stays within
//   1.44 lg n'; patricia-trie "n nodes for n keys": test/kernels-tree.test.ts, 'keeps its
//   invariants on every input shape, size and parameter setting' (one node per key);
//   bst-search-insert "a path of n levels" on ascending keys: test/kernels-tree.test.ts, 'a plain
//   search tree on ascending keys is a path' (descending is checked here).
import { describe, expect, it } from 'vitest';
import { NIL, SHAPES, Store, trace, workload, type Counts, type Trace, type TreeKernel }
  from '../src/engines/tree/trace';
import { kernel as bstSearchInsert } from '../src/kernels/tree/bst-search-insert';
import { kernel as bstRootInsertion } from '../src/kernels/tree/bst-root-insertion';
import { kernel as bstRotations } from '../src/kernels/tree/bst-rotations';
import { kernel as redBlack } from '../src/kernels/tree/red-black-tree';
import { kernel as twoThreeFour } from '../src/kernels/tree/two-three-four-tree';
import { kernel as bTree } from '../src/kernels/tree/b-tree';
import { kernel as binaryTrie } from '../src/kernels/tree/binary-trie';
import { kernel as digitalSearchTree } from '../src/kernels/tree/digital-search-tree';
import { kernel as patricia } from '../src/kernels/tree/patricia-trie';
import { kernel as multiwayTrie } from '../src/kernels/tree/multiway-trie';

const SIZES = [1, 2, 3, 7, 16, 61, 128, 300];
const lg = Math.log2;
const EPS = 1e-9;

const heightOf = (s: Store, h: number): number =>
  (h === NIL ? 0 : 1 + Math.max(0, ...s.kids[h].map((c) => heightOf(s, c))));
const height = (t: Trace) => heightOf(t.store, t.store.roots[0] ?? NIL);

/** The counts each operation of a kind spent, in order. */
function perOp(t: Trace, kind: string): Counts[] {
  const out: Counts[] = [];
  t.ops.forEach((op, i) => {
    if (op.kind !== kind) return;
    const end = i + 1 < t.ops.length ? t.ops[i + 1].c : t.counts;
    const d = { ...end };
    for (const f of Object.keys(d) as (keyof Counts)[]) d[f] = end[f] - op.c[f];
    out.push(d);
  });
  return out;
}

function runs(k: TreeKernel, opts: Record<string, number> = {}) {
  const out: { shape: string; n: number; t: Trace }[] = [];
  for (const { value: shape } of SHAPES[k.input]) {
    for (const n of SIZES) {
      const t = trace(k, workload(k.input, shape, n, 1000 + n, opts));
      expect(t.truncated).toBe(false);
      out.push({ shape, n, t });
    }
  }
  return out;
}

describe('searching (tree engine): exact bounds against counted runs', () => {
  it('bst-search-insert: at most n comparisons per search, exactly n on a path of n levels', () => {
    for (const { shape, n, t } of runs(bstSearchInsert)) {
      const h = height(t);
      for (const c of perOp(t, 'search')) expect(c.compares, `${shape} n=${n}`).toBeLessThanOrEqual(Math.min(n, h));
    }
    for (const shape of ['ascending', 'descending']) {
      for (const n of SIZES) {
        const w = workload('keys', shape, n, 1000 + n);
        // a miss beyond the far end of the path walks every level
        w.searches = [shape === 'ascending' ? Math.max(...(w.keys as number[])) + 1 : Math.min(...(w.keys as number[])) - 1];
        const t = trace(bstSearchInsert, w);
        expect(height(t), `${shape} n=${n}`).toBe(n);
        expect(perOp(t, 'search')[0].compares, `${shape} n=${n}`).toBe(n);
      }
    }
  });

  it('bst-root-insertion: one rotation per comparison of an insertion, n − 1 at the bottom of a path', () => {
    for (const { shape, n, t } of runs(bstRootInsertion)) {
      perOp(t, 'insert').forEach((c, i) => {
        expect(c.rotations, `${shape} n=${n} insert ${i}`).toBe(c.compares);
        expect(c.rotations).toBeLessThanOrEqual(i);
      });
    }
    for (const n of SIZES.filter((m) => m > 1)) {
      // ascending keys 2..n build a path by root insertion; key 1 then lands at its bottom
      const w = workload('keys', 'ascending', n, 1);
      w.keys = [...Array.from({ length: n - 1 }, (_, i) => i + 2), 1];
      const t = trace(bstRootInsertion, w);
      const last = perOp(t, 'insert').at(-1)!;
      expect(last.compares, `n=${n}`).toBe(n - 1);
      expect(last.rotations, `n=${n}`).toBe(n - 1);
      expect(t.store.keys[t.store.roots[0]][0]).toBe(1);
    }
  });

  it('bst-rotations: balancing leaves the minimal height ⌈lg(n+1)⌉ on every input order', () => {
    for (const { shape, n, t } of runs(bstRotations)) {
      expect(height(t), `${shape} n=${n}`).toBe(Math.ceil(lg(n + 1)));
    }
  });

  it('red-black-tree: at most 2 lg(n+1) levels on every input order', () => {
    for (const { shape, n, t } of runs(redBlack)) {
      expect(height(t), `${shape} n=${n}`).toBeLessThanOrEqual(2 * lg(n + 1) + EPS);
    }
    for (const shape of ['ascending', 'descending', 'random']) {
      const t = trace(redBlack, workload('keys', shape, 2000, 7));
      expect(height(t), shape).toBeLessThanOrEqual(2 * lg(2001));
    }
  });

  it('two-three-four-tree: between log₄(n+1) and lg(n+1) levels', () => {
    for (const { shape, n, t } of runs(twoThreeFour)) {
      const h = height(t);
      expect(h, `${shape} n=${n}`).toBeLessThanOrEqual(lg(n + 1) + EPS);
      expect(h, `${shape} n=${n}`).toBeGreaterThanOrEqual(lg(n + 1) / 2 - EPS);
    }
  });

  // not a catalogued bound (the entry's notes state only the average): a kernel invariant kept
  it('b-tree kernel: a search reads at most 1 + log_t((n+1)/2) pages, for every minimum degree t', () => {
    for (let deg = 2; deg <= 8; deg++) {
      for (const { shape, n, t } of runs(bTree, { degree: deg })) {
        const h = height(t);
        const bound = 1 + Math.log((n + 1) / 2) / Math.log(deg);
        expect(h, `t=${deg} ${shape} n=${n}`).toBeLessThanOrEqual(bound + EPS);
        for (const c of perOp(t, 'search')) expect(c.visits).toBeLessThanOrEqual(h);
      }
    }
  });

  it('binary-trie: at most w bit tests per search for w-bit keys, w when two keys differ in the last bit', () => {
    for (const { shape, n, t } of runs(binaryTrie)) {
      for (const c of perOp(t, 'search')) expect(c.digits, `${shape} n=${n}`).toBeLessThanOrEqual(t.workload.bits);
    }
    for (const n of [2, 16, 128]) {
      const w = workload('bits', 'random', n, 3);
      w.keys = [0, 1];
      w.searches = [1];
      const t = trace(binaryTrie, w);
      expect(perOp(t, 'search')[0].digits, `w=${w.bits}`).toBe(w.bits);
    }
  });

  it('digital-search-tree: at most w + 1 nodes touched per search for w-bit keys', () => {
    for (const { shape, n, t } of runs(digitalSearchTree)) {
      expect(height(t)).toBeLessThanOrEqual(t.workload.bits + 1);
      for (const c of perOp(t, 'search')) expect(c.visits, `${shape} n=${n}`).toBeLessThanOrEqual(t.workload.bits + 1);
    }
  });

  it('patricia-trie: exactly one key comparison per search, after at most w bit tests', () => {
    for (const { shape, n, t } of runs(patricia)) {
      for (const c of perOp(t, 'search')) {
        expect(c.compares, `${shape} n=${n}`).toBe(1);
        expect(c.digits, `${shape} n=${n}`).toBeLessThanOrEqual(t.workload.bits);
      }
    }
  });

  it('multiway-trie: one character test per character of the search key, no comparisons', () => {
    for (const { shape, n, t } of runs(multiwayTrie)) {
      const searches = perOp(t, 'search');
      searches.forEach((c, i) => {
        const word = t.workload.searches[i] as string;
        expect(c.compares).toBe(0);
        expect(c.digits, `${shape} n=${n} ${word}`).toBeLessThanOrEqual(word.length);
        if (t.found[i].yes) expect(c.digits, `${shape} n=${n} ${word}`).toBe(word.length);
      });
    }
  });
});
