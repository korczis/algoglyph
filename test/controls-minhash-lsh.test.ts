// MinHash's shingle length becomes a control (S2 B5). A document was its set of word
// 3-shingles; now of word k-shingles for the control k (1 to 5), 3 its default. Checked: the
// control exists, it travels in a shared link, it drives the readouts (each document's set is
// its distinct k-shingles, counted here independently, and the hash evaluations are b·r times
// their sum exactly; the mean estimate error stays below the sampling bound 1/(2√(b·r)), which
// does not depend on the shingle length), and the kernel's default trace is what it was before.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel, type MinhashResult } from '../src/kernels/string/minhash-lsh';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'minhash-lsh';
const KEY = 'shingle';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.documents.size.value;

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);

/** Distinct word k-shingles of a text, written here (a text shorter than k is one shingle). */
function distinct(text: string, k: number): number {
  const w = text.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '));
  return out.size || (w.length ? 1 : 0);
}

describe('minhash-lsh: shingle length', () => {
  it('is a range control with the old constant 3 as its default', () => {
    const d = plate().params.find((x) => x.key === KEY);
    expect(d).toMatchObject({ kind: 'range', label: 'Shingle length (words)', min: 1, max: 5, step: 1, value: 3, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const k of [1, 2, 5]) expect(parse(defs, serialise(defs, { ...d, [KEY]: k }, 7)), `${k}`).toEqual({ seed: 7, params: { [KEY]: k } });
  });

  it('hashes each document\'s distinct k-shingles b·r times, at every setting', () => {
    const d = plate().params.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the plate declares the control').toBeDefined();
    for (const k of settings(d!)) {
      for (const n of [2, N, 12]) {
        for (const seed of [1, 2, SEED]) {
          for (const [bands, rows] of [[8, 4], [2, 1]]) {
            const x = input('documents', n, '', seed);
            const t = trace(kernel, x, { bands, rows, [KEY]: k });
            const r = t.result as MinhashResult;
            const sizes = x.docs.map((doc) => distinct(doc.text, k));
            const at = `k=${k} n=${n} seed=${seed} ${bands}x${rows}`;
            expect(r.shingles.map((s) => s.length), at).toEqual(sizes);
            expect(t.counts[0], at).toBe(bands * rows * sizes.reduce((a, b) => a + b, 0));
            expect(t.counts[1], at).toBe(bands * x.docs.length);
          }
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const x = input('documents', N, '', SEED);
    for (const k of [1, 5]) {
      const h = await read(ID, claim('Hash evaluations', { [KEY]: k }));
      expect(h.reason).toBeUndefined();
      expect(h.value, `k=${k}`).toBe(32 * x.docs.reduce((a, doc) => a + distinct(doc.text, k), 0));
      // the sampling bound for k = b·r = 32 functions, whatever the shingle length
      const e = await read(ID, claim('Mean estimate error', { [KEY]: k }));
      expect(e.reason).toBeUndefined();
      expect(e.value!, `k=${k}`).toBeLessThan(1 / (2 * Math.sqrt(32)));
    }
  });
});

describe('minhash-lsh at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): every event and count
  const TRACES = 'fdd5900c3e42c2bc';

  it('records the same trace, with the default passed or absent', () => {
    const runs = (extra: Params) => [2, N, 12].flatMap((n) => [1, SEED].map((seed) => {
      const t = trace(kernel, input('documents', n, '', seed), { bands: 8, rows: 4, ...extra });
      return [n, seed, t.counts, hash(t.events.toArray())];
    }));
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ [KEY]: 3 })).toEqual(absent);
  }, 120_000);
});
