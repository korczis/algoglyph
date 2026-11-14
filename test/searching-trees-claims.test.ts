// Where the searching wing's tree claims get their figures (catalogue/entries/<id>.md `claims`,
// read on the plates by test/claims.test.ts). Every value is recomputed here at the claim's own
// setup by an independent structure (test/support/tree-oracles.ts: textbook BST, root insertion,
// median rebalancing, AVL, left-leaning red-black, splay and B-tree on plain objects, sharing no
// code with src/kernels/tree), over the keys the engine's workload() draws for that setup. The
// closed forms the statements give are checked here too, against the same oracle.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED, type Claim } from '../src/core/claims';
import { workload } from '../src/engines/tree/trace';
import {
  avl, binShape, bTree, inorder, llrb, pageShape, plainBst, rootInsertionBst, rotationBalancedBst,
  splay, type BinRun, type Counts, type PageRun,
} from './support/tree-oracles';

interface Entry { id: string; claims?: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };
const entry = (id: string) => model.entries.find((e) => e.id === id)!;

type Oracle = (keys: number[], searches: number[], opts: Record<string, number>) => BinRun | PageRun;
const ORACLES: Record<string, Oracle> = {
  'bst-search-insert': (k, s) => plainBst(k, s),
  'bst-root-insertion': (k, s) => rootInsertionBst(k, s),
  'bst-rotations': (k, s) => rotationBalancedBst(k, s),
  'avl-tree': (k, s) => avl(k, s),
  'red-black-tree': (k, s) => llrb(k, s),
  'splay-tree': (k, s) => splay(k, s),
  'two-three-four-tree': (k, s) => bTree(k, s, 2, false),
  'b-tree': (k, s, o) => bTree(k, s, o.degree ?? 3, true),
};

/** The input a claim's setup draws, as the plate draws it on its first run. */
function inputOf(c: Claim, opts: Record<string, number>) {
  const p = (c.setup?.params ?? {}) as Record<string, unknown>;
  return workload('keys', String(p.shape ?? 'random'), Number(p.n ?? 31), c.setup?.seed ?? DEFAULT_SEED, opts);
}

const isPage = (r: BinRun | PageRun): r is PageRun => !!r.root && 'kids' in r.root;

/** What the oracle shows for a readout the plate publishes. */
function reading(r: BinRun | PageRun, label: string): number {
  const shape = isPage(r) ? pageShape(r.root) : binShape(r.root as BinRun['root']);
  const counts: Counts = r.counts;
  switch (label) {
    case 'Height': return shape.height;
    case 'Keys held': return shape.size;
    case 'Key comparisons': return counts.compares;
    case 'Rotations': return counts.rotations;
    case 'Recolourings': return counts.recolours;
    case 'Node splits': return counts.splits;
    default: throw new Error(`no oracle reading for readout "${label}"`);
  }
}

describe('searching tree claims: every figure from an independent structure', () => {
  for (const id of Object.keys(ORACLES)) {
    it(`${id}: at least three claims, each matching its oracle`, () => {
      const claims = entry(id).claims ?? [];
      expect(claims.length, id).toBeGreaterThanOrEqual(3);
      for (const c of claims) {
        expect(c.setup?.seeds, `${c.id}: one seed per claim here`).toBeUndefined();
        const opts = id === 'b-tree' ? { degree: Number((c.setup?.params as Record<string, unknown>)?.degree ?? 3) } : {};
        const w = inputOf(c, opts);
        const r = ORACLES[id](w.keys as number[], w.searches as number[], opts);
        if (!isPage(r)) {
          const keys = inorder(r.root as BinRun['root']);
          expect(keys, `${c.id}: the oracle is a search tree`).toEqual([...(w.keys as number[])].sort((a, b) => a - b));
        } else {
          expect(pageShape(r.root).leafDepths.size, `${c.id}: every leaf at one depth`).toBe(1);
        }
        expect(Number.isInteger(c.expect.value), `${c.id}: an integer value`).toBe(true);
        expect(c.expect.value, `${c.id} (${c.readout})`).toBe(reading(r, c.readout));
      }
    });
  }
});

describe('the closed forms the statements give', () => {
  const asc = (n: number) => workload('keys', 'ascending', n, DEFAULT_SEED, {});

  it('ascending keys build a path of n levels in a plain BST, and cost 0 + 1 + … + (n − 1) to insert', () => {
    const w = asc(31);
    const r = plainBst(w.keys as number[], []);
    expect(binShape(r.root).height).toBe(31);
    expect(r.counts.compares).toBe((31 * 30) / 2);
  });

  it('root insertion of ascending keys: one comparison and one rotation per key after the first', () => {
    const w = asc(31);
    const r = rootInsertionBst(w.keys as number[], []);
    expect(r.counts.rotations).toBe(30);
    expect(r.counts.compares).toBe(30);
    expect(binShape(r.root).height).toBe(31);
  });

  it('median rebalancing leaves a perfect tree: 2^k − 1 keys in k levels', () => {
    for (const shape of ['random', 'ascending', 'descending', 'zigzag']) {
      const w = workload('keys', shape, 31, DEFAULT_SEED, {});
      expect(binShape(rotationBalancedBst(w.keys as number[], []).root).height, shape).toBe(5);
    }
  });

  /**
   * AVL on ascending keys, in this plate's convention (a double rotation is two). The i-th key
   * goes to the end of the right spine. When i is a power of two the i − 1 keys before it form
   * a perfect tree (true for i = 1, 2, and kept below), so the new key lengthens the spine by one
   * level and every node on it leans right by at most one: no rotation. Otherwise the spine's
   * lowest node of balance −1 tips to −2 with its right child leaning right, an outside case:
   * one single rotation, which restores that subtree's height, so nothing above changes. Hence
   * one rotation for every i that is not a power of two, and after 2^k − 1 keys the tree is
   * perfect again: 2^k − 1 − k rotations, 31 − 5 = 26 for n = 31, in 5 levels. The test checks
   * the rule key by key, not only the total.
   */
  it('AVL on ascending keys rotates once exactly at every key whose rank is not a power of two', () => {
    const w = asc(31);
    const keys = w.keys as number[];
    let before = 0;
    for (let i = 1; i <= keys.length; i++) {
      const r = avl(keys.slice(0, i), []);
      const isPow2 = (i & (i - 1)) === 0;
      expect(r.counts.rotations - before, `key ${i}`).toBe(isPow2 ? 0 : 1);
      before = r.counts.rotations;
      if (((i + 1) & i) === 0) expect(binShape(r.root).height, `after ${i} keys`).toBe(Math.log2(i + 1));
    }
    expect(before).toBe(26);
  });

  it('the 2-3-4 tree is the B-tree of minimum degree 2: the same splits and height on the same keys', () => {
    for (const shape of ['random', 'ascending', 'descending', 'zigzag']) {
      const w = workload('keys', shape, 31, DEFAULT_SEED, {});
      const a = bTree(w.keys as number[], [], 2, false);
      const b = bTree(w.keys as number[], [], 2, true);
      expect(a.counts.splits, shape).toBe(b.counts.splits);
      expect(pageShape(a.root).height, shape).toBe(pageShape(b.root).height);
    }
  });
});
