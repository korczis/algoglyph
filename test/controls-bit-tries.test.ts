// The bit tries' key width becomes a control (S2 C1): the binary trie, the digital search tree
// and Patricia share one parameter factory, so they stay in step. The workload drew keys of
// w = max(4, ⌈lg 4n⌉) bits; now w = max(4, ⌈lg 4n⌉) + e for the control e ("extra key bits"),
// whose default 0 is the old width. Checked: the control exists on each, it travels in a shared
// link, it sets the width and every height stays within the bound that width gives, it drives
// what the plates read, and every tree plate's default input and trace are what they were.
//
// Height counts levels, a root alone being one level (src/engines/tree/scene.ts shape()).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/tree';
import { shape } from '../src/engines/tree/scene';
import { SHAPES, trace, workload, type TreeKernel } from '../src/engines/tree/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<TreeKernel>('../src/kernels/tree/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/tree/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const TRIES = ['binary-trie', 'digital-search-tree', 'patricia-trie'];
const KEY = 'spare';
/** The plates' default number of keys (src/engines/tree/index.ts SIZE.bits). */
const N = 24;
const SEED = 4242;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);

/** The key width at e extra bits, from n alone: the old width plus e. */
const width = (n: number, e: number) => Math.max(4, Math.ceil(Math.log2(Math.max(2, 4 * n)))) + e;

/** The height bound in levels for w-bit keys, the same for all three:
 * - binary trie: an internal node at depth d branches on bit d, so internal nodes sit at depths
 *   0..w − 1 and a leaf at most at depth w: at most w + 1 levels.
 * - digital search tree: a key at depth d agrees with the path on its first d bits, so a node at
 *   depth w would be reached by all w bits and only its own key does: at most w + 1 levels.
 * - Patricia: bit indices strictly increase down the tree from the header's −1 through 0..w − 1,
 *   so a path is the header and at most w nodes: at most w + 1 levels. */
const bound = (w: number) => w + 1;

const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });

describe('bit tries: extra key bits', () => {
  it('is one range control on every bit trie, the old width its default', () => {
    for (const id of TRIES) {
      const d = plateOf(id).params.find((x) => x.key === KEY);
      expect(d, id).toMatchObject({ kind: 'range', label: 'Extra key bits', min: 0, max: 6, step: 1, value: 0, rebuild: true });
      expect(kernelOf(id).params, `${id} declares it as the others do`).toEqual(kernelOf(TRIES[0]).params);
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of TRIES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const e of [1, 3, 6]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: e }, 7)), `${id} ${e}`).toEqual({ seed: 7, params: { [KEY]: e } });
      }
    }
  });

  it('sets the key width, and every height stays within its bound, at every setting', () => {
    const d = kernelOf('binary-trie').params?.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the kernel declares the control').toBeDefined();
    for (const e of settings(d!)) {
      for (const sh of SHAPES.bits.map((s) => s.value)) {
        for (const n of [2, 3, 7, N, 61, 255]) {
          for (const seed of [1, 42, SEED]) {
            const w = workload('bits', sh, n, seed, { [KEY]: e });
            expect(w.bits, `${sh} n=${n} e=${e}`).toBe(width(n, e));
            expect(new Set(w.keys).size, 'n distinct keys').toBe(n);
            for (const k of [...w.keys, ...w.searches] as number[]) expect(k >= 0 && k < 2 ** w.bits).toBe(true);
            for (const id of TRIES) {
              const t = trace(kernelOf(id), w);
              const s = shape(t.store, kernelOf(id));
              expect(s.height, `${id} ${sh} n=${n} e=${e} seed=${seed}`).toBeLessThanOrEqual(bound(w.bits));
              expect(s.size, `${id} holds every key once`).toBe(n);
              // Patricia: one node per key, the header included
              if (id === 'patricia-trie') expect(s.nodes).toBe(n);
            }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plates\' readouts', async () => {
    for (const id of TRIES) {
      for (const e of [0, 3, 6]) {
        const h = await read(id, claim('Height', { [KEY]: e }));
        expect(h.reason, id).toBeUndefined();
        expect(h.value!, `${id} e=${e}`).toBeLessThanOrEqual(bound(width(N, e)));
        const held = await read(id, claim('Keys held', { [KEY]: e }));
        expect(held.value, `${id} e=${e}`).toBe(N);
      }
      // a wider key spreads the clustered blocks apart: the trie on them changes
      const narrow = await read(id, claim('Bit tests', { shape: 'clustered', [KEY]: 0 }));
      const wide = await read(id, claim('Bit tests', { shape: 'clustered', [KEY]: 6 }));
      expect(narrow.reason ?? wide.reason, id).toBeUndefined();
      expect(wide.value, id).not.toBe(narrow.value);
    }
  }, 120_000);
});

describe('the tree engine at the defaults is what it was before the key-width control', () => {
  // recorded on the code before the control existed (S5 779097a)
  const TRIES_PARAMS = 'af829aa2dfa5e539';

  it('every tree kernel draws the same input and records the same trace, the default given or not', () => {
    for (const id of Object.keys(modules).sort()) {
      const k = modules[id];
      for (const sh of SHAPES[k.input].map((s) => s.value)) {
        for (const n of [2, 7, N, 61]) {
          for (const seed of [1, SEED]) {
            const { opts: _a, ...bare } = workload(k.input, sh, n, seed);
            const { opts: _b, ...given } = workload(k.input, sh, n, seed, { [KEY]: 0 });
            expect(given, `${id} ${sh} n=${n}`).toEqual(bare);
            const a = trace(k, workload(k.input, sh, n, seed));
            const b = trace(k, workload(k.input, sh, n, seed, { [KEY]: 0 }));
            expect(hash([b.events, b.counts, b.found]), `${id} ${sh} n=${n} seed=${seed}`).toBe(hash([a.events, a.counts, a.found]));
          }
        }
      }
    }
  }, 120_000);

  it('the bit tries offer the same controls as before, the new one aside', () => {
    expect(hash(TRIES.map((id) => [id, plateOf(id).params.filter((d) => d.key !== KEY)]))).toBe(TRIES_PARAMS);
  });

  it('the bit tries read the same at their defaults, the default given or not', async () => {
    for (const id of TRIES) {
      for (const readout of ['Operation', 'Keys held', 'Height', 'Average depth of a key', 'Bit tests',
        'Nodes touched', 'Links written', 'Cost per search', 'Lookups']) {
        const bare = await read(id, claim(readout, {}));
        const given = await read(id, claim(readout, { [KEY]: 0 }));
        expect(given.text, `${id} ${readout}`).toBe(bare.text);
      }
    }
  }, 120_000);
});
