// The word tries' alphabet becomes a control (S2 C2): the multiway trie and the ternary search
// trie share one parameter factory, so they stay in step. The workload drew its words from the
// five letters 'abcde'; now from the first R letters of 'abcdefghij' for the control R, whose
// default 5 is the old alphabet. The multiway trie's nodes get R links each. Checked: the control
// exists on both, it travels in a shared link, it sets the alphabet, the heights stay within
// their bounds and the words read back are the words inserted, it drives what the plates read,
// and every tree plate's default input and trace are what they were.
//
// Height counts levels, a root alone being one level (src/engines/tree/scene.ts shape()).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/tree';
import { shape } from '../src/engines/tree/scene';
import { NIL, SHAPES, trace, workload, type Store, type TreeKernel } from '../src/engines/tree/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<TreeKernel>('../src/kernels/tree/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/tree/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const TRIES = ['multiway-trie', 'ternary-search-trie'];
const KEY = 'letters';
/** The plates' default number of words (src/engines/tree/index.ts SIZE.words). */
const N = 20;
const SEED = 4242;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);

/** The words a store holds, read from its links alone. */
function words(id: string, s: Store): string[] {
  const out: string[] = [];
  const root = s.roots[0] ?? NIL;
  if (root === NIL) return out;
  if (id === 'multiway-trie') {
    const rec = (h: number, prefix: string) => {
      if (s.tag[h] === 1) out.push(prefix);
      s.kids[h].forEach((c) => { if (c !== NIL) rec(c, prefix + String(s.keys[c][0])); });
    };
    rec(root, '');
  } else {
    const rec = (h: number, prefix: string) => {
      if (h === NIL) return;
      const c = String(s.keys[h][0]);
      if (s.tag[h] === 1) out.push(prefix + c);
      rec(s.kids[h][0], prefix);
      rec(s.kids[h][1], prefix + c);
      rec(s.kids[h][2], prefix);
    };
    rec(root, '');
  }
  return out.sort();
}

/** The height bound in levels for words of at most L letters over R letters:
 * - multiway trie: the root holds no letter and each letter of a word goes one level down, so
 *   at most L + 1 levels.
 * - ternary search trie: at each position a path crosses a search tree of the distinct letters
 *   there, at most R nodes, before its equal link moves on: at most R · L levels. */
const bound = (id: string, L: number, R: number) => (id === 'multiway-trie' ? L + 1 : R * L);

const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });

describe('word tries: alphabet size', () => {
  it('is one range control on both word tries, the old five letters its default', () => {
    for (const id of TRIES) {
      const d = plateOf(id).params.find((x) => x.key === KEY);
      expect(d, id).toMatchObject({ kind: 'range', label: 'Alphabet size R', min: 3, max: 10, step: 1, value: 5, rebuild: true });
      expect(kernelOf(id).params, `${id} declares it as the other does`).toEqual(kernelOf(TRIES[0]).params);
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of TRIES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const r of [3, 7, 10]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: r }, 7)), `${id} ${r}`).toEqual({ seed: 7, params: { [KEY]: r } });
      }
    }
  });

  it('sets the alphabet, keeps the heights within their bounds and reads back every word', () => {
    const d = kernelOf('multiway-trie').params?.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the kernel declares the control').toBeDefined();
    for (const R of settings(d!)) {
      const letters = 'abcdefghij'.slice(0, R);
      for (const sh of SHAPES.words.map((s) => s.value)) {
        for (const n of [2, 3, 7, N, 61, 120]) {
          for (const seed of [1, 42, SEED]) {
            const w = workload('words', sh, n, seed, { [KEY]: R });
            const all = [...w.keys, ...w.searches] as string[];
            for (const x of all) for (const c of x) expect(letters.includes(c), `${x} over ${letters}`).toBe(true);
            // R ≥ 3 letters spell 3 + 9 + 27 + 81 + 243 = 363 words of 1 to 5 letters, so n ≤ 120 fit
            expect(new Set(w.keys).size, `${sh} n=${n} R=${R}`).toBe(n);
            const L = Math.max(...(w.keys as string[]).map((x) => x.length));
            for (const id of TRIES) {
              const k = kernelOf(id);
              const t = trace(k, w);
              const s = shape(t.store, k);
              expect(s.height, `${id} ${sh} n=${n} R=${R} seed=${seed}`).toBeLessThanOrEqual(bound(id, L, R));
              expect(words(id, t.store), `${id} reads back the words inserted`).toEqual((w.keys as string[]).slice().sort());
              expect(s.size).toBe(n);
              if (id === 'multiway-trie') {
                expect(L + 1, 'the longest word is one path below the root').toBe(s.height);
                for (const ks of t.store.kids) expect(ks.length, 'R links per node').toBe(R);
              }
            }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plates\' readouts', async () => {
    for (const id of TRIES) {
      for (const R of [3, 7, 10]) {
        const held = await read(id, claim('Keys held', { [KEY]: R }));
        expect(held.reason, id).toBeUndefined();
        expect(held.value, `${id} R=${R}`).toBe(N);
        const h = await read(id, claim('Height', { [KEY]: R }));
        const w = workload('words', 'random', N, SEED, { [KEY]: R });
        const L = Math.max(...(w.keys as string[]).map((x) => x.length));
        expect(h.value!, `${id} R=${R}`).toBeLessThanOrEqual(bound(id, L, R));
      }
      const few = await read(id, claim('Nodes touched', { [KEY]: 3 }));
      const many = await read(id, claim('Nodes touched', { [KEY]: 10 }));
      expect(many.value, `${id}: another alphabet, another trie`).not.toBe(few.value);
    }
  }, 120_000);
});

describe('the tree engine at the defaults is what it was before the alphabet control', () => {
  // recorded on the code before the control existed (S5 779097a)
  const TRIES_PARAMS = '553f632f753e35d2';

  it('every tree kernel draws the same input and records the same trace, the default given or not', () => {
    for (const id of Object.keys(modules).sort()) {
      const k = modules[id];
      for (const sh of SHAPES[k.input].map((s) => s.value)) {
        for (const n of [2, 7, N, 61]) {
          for (const seed of [1, SEED]) {
            const { opts: _a, ...bare } = workload(k.input, sh, n, seed);
            const { opts: _b, ...given } = workload(k.input, sh, n, seed, { [KEY]: 5 });
            expect(given, `${id} ${sh} n=${n}`).toEqual(bare);
            const a = trace(k, workload(k.input, sh, n, seed));
            const b = trace(k, workload(k.input, sh, n, seed, { [KEY]: 5 }));
            expect(hash([b.events, b.counts, b.found]), `${id} ${sh} n=${n} seed=${seed}`).toBe(hash([a.events, a.counts, a.found]));
          }
        }
      }
    }
  }, 120_000);

  it('the word tries offer the same controls as before, the new one aside', () => {
    expect(hash(TRIES.map((id) => [id, plateOf(id).params.filter((d) => d.key !== KEY)]))).toBe(TRIES_PARAMS);
  });

  it('the word tries read the same at their defaults, the default given or not', async () => {
    for (const id of TRIES) {
      for (const readout of ['Operation', 'Keys held', 'Height', 'Average depth of a key', 'Character tests',
        'Key comparisons', 'Nodes touched', 'Links written', 'Cost per search', 'Lookups']) {
        const bare = await read(id, claim(readout, {}));
        const given = await read(id, claim(readout, { [KEY]: 5 }));
        expect(given.text, `${id} ${readout}`).toBe(bare.text);
      }
    }
  }, 120_000);
});
