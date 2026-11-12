// The deleting search trees' share of deletions becomes a control (S2 C3): deletion by join and
// the randomized BST share one parameter factory, so they stay in step. The workload deleted
// ⌊n/2⌋ of the n keys; now ⌊f n⌋ for the control f, whose default 0.5 is the old half (the hash
// engine's "Keys deleted at the end" is the same idea, in percent). Checked: the control exists
// on both, it travels in a shared link, it sets the deletions, the tree keeps exactly the keys
// not deleted in ascending in-order, it drives what the plates read, and every tree plate's
// default input and trace are what they were.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/tree';
import { NIL, SHAPES, trace, workload, type Key, type Store, type TreeKernel } from '../src/engines/tree/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<TreeKernel>('../src/kernels/tree/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/tree/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const TREES = ['bst-delete-join', 'randomized-bst'];
const KEY = 'deletes';
/** The plates' default number of keys (src/engines/tree/index.ts SIZE.keys). */
const N = 31;
const SEED = 4242;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
/** Keys deleted at share f of n keys: ⌊f n⌋, f read as the decimal it stands for. */
const deleted = (f: number, n: number) => Math.floor(Math.round(f * 100) * n / 100);

/** The keys of a binary search tree's store, in order. */
function inorder(s: Store): Key[] {
  const out: Key[] = [];
  const rec = (h: number) => {
    if (h === NIL) return;
    rec(s.kids[h][0]);
    out.push(s.keys[h][0]);
    rec(s.kids[h][1]);
  };
  rec(s.roots[0] ?? NIL);
  return out;
}

const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });

describe('deleting search trees: share deleted', () => {
  it('is one range control on both deleting trees, the old half its default', () => {
    for (const id of TREES) {
      const d = plateOf(id).params.find((x) => x.key === KEY);
      expect(d, id).toMatchObject({ kind: 'range', label: 'Share deleted', min: 0, max: 0.5, step: 0.05, value: 0.5, rebuild: true });
      expect(kernelOf(id).params, `${id} declares it as the other does`).toEqual(kernelOf(TREES[0]).params);
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of TREES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const f of [0, 0.05, 0.25, 0.35]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: f }, 7)), `${id} ${f}`).toEqual({ seed: 7, params: { [KEY]: f } });
      }
    }
  });

  it('deletes ⌊f n⌋ keys and keeps the rest in ascending order, at every setting', () => {
    const d = kernelOf('bst-delete-join').params?.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the kernel declares the control').toBeDefined();
    for (const f of settings(d!)) {
      for (const sh of SHAPES.keys.map((s) => s.value)) {
        for (const n of [2, 3, 7, N, 61, 255]) {
          for (const seed of [1, 42, SEED]) {
            const w = workload('keys', sh, n, seed, { [KEY]: f });
            expect(w.deletes.length, `${sh} n=${n} f=${f}`).toBe(deleted(f, n));
            expect(new Set(w.deletes).size, 'distinct keys, all present').toBe(w.deletes.length);
            const gone = new Set(w.deletes);
            const left = (w.keys as number[]).filter((k) => !gone.has(k)).sort((a, b) => a - b);
            for (const id of TREES) {
              const t = trace(kernelOf(id), w);
              expect(inorder(t.store), `${id} ${sh} n=${n} f=${f} seed=${seed}`).toEqual(left);
              expect(left.length).toBe(n - deleted(f, n));
            }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plates\' readouts', async () => {
    for (const id of TREES) {
      for (const f of [0, 0.1, 0.25]) {
        const held = await read(id, claim('Keys held', { [KEY]: f }));
        expect(held.reason, id).toBeUndefined();
        expect(held.value, `${id} f=${f}`).toBe(N - deleted(f, N));
        // n inserts, ⌊n/2⌋ searches, ⌊f n⌋ deletes
        const ops = await read(id, claim('Operation', { [KEY]: f }));
        expect(ops.value, `${id} f=${f}`).toBe(N + Math.floor(N / 2) + deleted(f, N));
        const result = await read(id, claim('Result', { [KEY]: f }));
        expect(result.text, id).toBe('in-order ascending, verified');
      }
    }
  }, 120_000);
});

describe('the tree engine at the defaults is what it was before the deletions control', () => {
  // recorded on the code before the control existed (S5 779097a)
  const TREES_PARAMS = '193f59433690ed5a';

  it('every tree kernel draws the same input and records the same trace, the default given or not', () => {
    for (const id of Object.keys(modules).sort()) {
      const k = modules[id];
      for (const sh of SHAPES[k.input].map((s) => s.value)) {
        for (const n of [2, 7, N, 61]) {
          for (const seed of [1, SEED]) {
            const { opts: _a, ...bare } = workload(k.input, sh, n, seed);
            const { opts: _b, ...given } = workload(k.input, sh, n, seed, { [KEY]: 0.5 });
            expect(given, `${id} ${sh} n=${n}`).toEqual(bare);
            const a = trace(k, workload(k.input, sh, n, seed));
            const b = trace(k, workload(k.input, sh, n, seed, { [KEY]: 0.5 }));
            expect(hash([b.events, b.counts, b.found]), `${id} ${sh} n=${n} seed=${seed}`).toBe(hash([a.events, a.counts, a.found]));
          }
        }
      }
    }
  }, 120_000);

  it('the deleting trees offer the same controls as before, the new one aside', () => {
    expect(hash(TREES.map((id) => [id, plateOf(id).params.filter((d) => d.key !== KEY)]))).toBe(TREES_PARAMS);
  });

  it('the deleting trees read the same at their defaults, the default given or not', async () => {
    for (const id of TREES) {
      for (const readout of ['Operation', 'Keys held', 'Height', 'Average depth of a key', 'Key comparisons',
        'Nodes touched', 'Links written', 'Rotations', 'Cost per delete', 'Lookups', 'Result']) {
        const bare = await read(id, claim(readout, {}));
        const given = await read(id, claim(readout, { [KEY]: 0.5 }));
        expect(given.text, `${id} ${readout}`).toBe(bare.text);
      }
    }
  }, 120_000);
});
