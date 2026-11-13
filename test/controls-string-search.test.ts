// The string searches' pattern length becomes one control (S2 A1): brute force, Knuth-Morris-Pratt,
// Boyer-Moore and Rabin-Karp share one parameter factory (src/kernels/string/_search.ts), so they
// stay in step. 'auto' is the old draw: 4..7 characters of English words, 6 of DNA, and
// max(6, ⌊n/16⌋) on Repetitive input, the same random numbers in the same order; a number fixes
// m (at most the text's length). Checked: the control exists on each, it travels in a shared link,
// and at every setting each search finds what String.prototype.indexOf finds within the
// comparison bounds of its method.
//
// One file for the four search plates: they share the control's factory and its oracles.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

type K = StringKernel<'search', number[]>;
const modules = import.meta.glob<K>('../src/kernels/string/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/string/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id) as never);
};
const SEARCH = ['brute-force-search', 'knuth-morris-pratt', 'boyer-moore', 'rabin-karp'];
const KEY = 'm';
const SETTINGS = ['auto', '4', '6', '8', '16', '32', '64', '128'];
const SEED = 4242;
const SHAPES = KINDS.search.shapes.map((s) => s.value);

/** Every start of the pattern in the text, by String.prototype.indexOf (an independent search). */
function findAll(text: string, pattern: string): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(pattern); i >= 0; i = text.indexOf(pattern, i + 1)) out.push(i);
  return out;
}
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params } });

describe('string search: pattern length', () => {
  it('is one select control on every search plate, the old draw its default', () => {
    for (const id of SEARCH) {
      const d = plateOf(id).params.find((x) => x.key === KEY) as SelectParam | undefined;
      expect(d, id).toMatchObject({ kind: 'select', label: 'Pattern length', value: 'auto', rebuild: true });
      expect(d!.options.map((o) => o.value), id).toEqual(SETTINGS);
      expect(kernelOf(id).params?.find((x) => x.key === KEY), `${id} declares it as the others do`)
        .toEqual(kernelOf(SEARCH[0]).params?.find((x) => x.key === KEY));
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of SEARCH) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const m of SETTINGS.slice(1)) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: m }, 7)), `${id} ${m}`).toEqual({ seed: 7, params: { [KEY]: m } });
      }
    }
  });

  it('sets the pattern length, and every search finds what indexOf finds within its bounds', () => {
    for (const setting of SETTINGS) {
      for (const shape of SHAPES) {
        for (const n of [16, 96, 512, 2048]) {
          for (const seed of [1, SEED]) {
            const x = input('search', n, shape, seed, { [KEY]: setting });
            const N = x.text.length; const m = x.pattern.length;
            const tag = `${setting} ${shape} n=${n} seed=${seed}`;
            if (setting !== 'auto') expect(m, tag).toBe(Math.min(Number(setting), N));
            const want = findAll(x.text, x.pattern);
            expect(want.length, `${tag}: the pattern occurs`).toBeGreaterThan(0);
            for (const id of SEARCH) {
              const t = trace(kernelOf(id), x, { [KEY]: setting });
              expect(t.truncated, `${id} ${tag}`).toBe(false);
              expect(t.result, `${id} ${tag}`).toEqual(want);
              const c = t.counts[0];
              if (id === 'brute-force-search') expect(c, `${id} ${tag}`).toBeLessThanOrEqual(m * (N - m + 1));
              if (id === 'knuth-morris-pratt') expect(c, `${id} ${tag}`).toBeLessThanOrEqual(2 * N + 2 * m);
              // the two first windows hashed (2m), then one update per slide (n − m)
              if (id === 'rabin-karp') expect(t.counts[1], `${id} ${tag}`).toBe(2 * m + (N - m));
            }
          }
        }
      }
    }
  }, 300_000);

  it('never makes brute force heavier than its old worst, Repetitive at n 2048', () => {
    const at = (shape: string, setting: string, seed: number) =>
      trace(kernelOf('brute-force-search'), input('search', 2048, shape, seed, { [KEY]: setting })).counts[0];
    for (const seed of [1, SEED]) {
      const worst = at('repetitive', 'auto', seed);
      // the old worst is m(n − m + 1) at m = 128 at most, and the brute force count reaches it
      expect(worst).toBeLessThanOrEqual(128 * (2048 - 128 + 1));
      for (const shape of SHAPES) for (const s of SETTINGS) expect(at(shape, s, seed), `${shape} ${s}`).toBeLessThanOrEqual(worst);
    }
  }, 120_000);

  it('drives the plates\' readouts', async () => {
    // DNA has exactly n characters, so the counts are exact
    for (const [m, n] of [[8, 96], [32, 512]]) {
      const p = { shape: 'dna', n, [KEY]: String(m) };
      const x = input('search', n, 'dna', SEED, { [KEY]: String(m) });
      const tried = await read('brute-force-search', claim('Alignments tried', p));
      expect(tried.reason).toBeUndefined();
      expect(tried.value, `alignments n − m + 1 at m ${m}`).toBe(n - m + 1);
      const hashes = await read('rabin-karp', claim('Hash updates', p));
      expect(hashes.reason).toBeUndefined();
      expect(hashes.value, `hash updates 2m + (n − m) at m ${m}`).toBe(2 * m + n - m);
      for (const id of SEARCH) {
        const r = await read(id, claim('Matches', p));
        expect(r.reason, id).toBeUndefined();
        expect(r.value, `${id} matches at m ${m}`).toBe(findAll(x.text, x.pattern).length);
      }
    }
  }, 120_000);
});
