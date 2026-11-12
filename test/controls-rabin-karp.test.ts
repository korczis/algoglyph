// Rabin–Karp's radix becomes a control (S2 B1). Each window was read as a base-256 number modulo
// q; now the base is the control R (256, 31 or 2), 256 its default. Checked: the control exists,
// it travels in a shared link, it drives the readouts (the matches are indexOf's at every radix
// and modulus, and the hash updates are 2m + (n − m) = n + m whatever the radix), and the
// kernel's default trace is what it was before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/rabin-karp';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'rabin-karp';
const KEY = 'R';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.search.size.value;
const SHAPES = KINDS.search.shapes.map((s) => s.value);

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, string> } });

/** Every start of the pattern in the text, overlapping ones included, by String.indexOf. */
function findAll(text: string, pattern: string): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(pattern); i >= 0; i = text.indexOf(pattern, i + 1)) out.push(i);
  return out;
}

describe('rabin-karp: radix', () => {
  it('is a select control with the old constant 256 as its default', () => {
    const d = plate().params.find((x) => x.key === KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Radix', value: '256', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(['256', '31', '2']);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const r of ['31', '2']) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: r }, 7)), r).toEqual({ seed: 7, params: { [KEY]: r } });
    }
  });

  it('finds what indexOf finds, with n + m hash updates, at every radix and modulus', () => {
    for (const R of ['256', '31', '2']) {
      for (const q of ['1000003', '997', '13']) {
        for (const shape of SHAPES) {
          for (const n of [16, N, 512]) {
            for (const seed of [1, 2, 3, SEED]) {
              const x = input('search', n, shape, seed);
              const t = trace(kernel, x, { q, [KEY]: R });
              const at = `R=${R} q=${q} ${shape} n=${n} seed=${seed}`;
              expect(t.result, at).toEqual(findAll(x.text, x.pattern));
              // m hash steps for each of the pattern and the first window, then one per slide
              expect(t.counts[1], at).toBe(x.text.length + x.pattern.length);
            }
          }
        }
      }
    }
  });

  it('a radix changes the hashes: radix 2 modulo 13 collides on windows radix 256 does not', () => {
    // the hash of a window is Σ c_k R^(m−1−k) mod q: the radix is in it, so the spurious hits move
    let differ = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const x = input('search', 512, 'words', seed);
      const spur = (R: string) => {
        const t = trace(kernel, x, { q: '13', [KEY]: R });
        return t.events.toArray().filter((e) => e.s === 'Spurious hash hits').at(-1)?.ss?.[0];
      };
      if (spur('2') !== spur('256')) differ++;
    }
    expect(differ).toBeGreaterThan(0);
  });

  it('drives the plate\'s readouts', async () => {
    const x = input('search', N, SHAPES[0], SEED);
    for (const R of ['31', '2']) {
      const m = await read(ID, claim('Matches', { [KEY]: R }));
      expect(m.reason).toBeUndefined();
      expect(m.value, `R=${R}`).toBe(findAll(x.text, x.pattern).length);
      const h = await read(ID, claim('Hash updates', { [KEY]: R }));
      expect(h.reason).toBeUndefined();
      expect(h.value, `R=${R}`).toBe(x.text.length + x.pattern.length);
    }
  });
});

describe('rabin-karp at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): every event and count
  const TRACES = '10bc01432a17b080';

  it('records the same trace, with the default passed or absent', () => {
    const runs = (extra: Params) => SHAPES.flatMap((shape) => [16, N, 2048].flatMap((n) => [1, SEED].flatMap((seed) =>
      ['1000003', '13'].map((q) => {
        const t = trace(kernel, input('search', n, shape, seed), { q, ...extra });
        return [shape, n, seed, q, t.counts, hash(t.events.toArray())];
      }))));
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ [KEY]: '256' })).toEqual(absent);
  });
});
