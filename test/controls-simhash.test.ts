// SimHash's fingerprint width becomes a control (S2 B6). A fingerprint was 64 bits; now it is
// B = 16, 32 or 64 bits for the control, 64 its default, the low B of the same 64 feature bits.
// Checked: the control exists, it travels in a shared link, it drives the readouts (B votes per
// distinct word and B bits compared per pair, exactly; every distance within [0, B]; a
// fingerprint of B bits is the first B bits of the 64-bit one, so its distance never exceeds
// the 64-bit distance), and the kernel's default trace is what it was before the control.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel, type SimhashResult } from '../src/kernels/string/simhash';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'simhash';
const KEY = 'bits';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.documents.size.value;

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, string> } });
const words = (text: string) => new Set(text.toLowerCase().split(/\s+/).filter(Boolean)).size;

describe('simhash: fingerprint bits', () => {
  it('is a select control with the old constant 64 as its default', () => {
    const d = plate().params.find((x) => x.key === KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Fingerprint bits', value: '64', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(['16', '32', '64']);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const b of ['16', '32']) expect(parse(defs, serialise(defs, { ...d, [KEY]: b }, 7)), b).toEqual({ seed: 7, params: { [KEY]: b } });
  });

  it('votes B times per distinct word, compares B bits per pair, and keeps every distance within B', () => {
    for (const n of [2, N, 12]) {
      for (const seed of [1, 2, 3, SEED]) {
        const x = input('documents', n, '', seed);
        const k = x.docs.length;
        const wide = trace(kernel, x, { [KEY]: '64' }).result as SimhashResult;
        for (const B of [16, 32, 64]) {
          const t = trace(kernel, x, { [KEY]: String(B) });
          const r = t.result as SimhashResult;
          const at = `B=${B} n=${n} seed=${seed}`;
          expect(t.counts[0], at).toBe(B * x.docs.reduce((a, doc) => a + words(doc.text), 0));
          expect(t.counts[1], at).toBe((B * k * (k - 1)) / 2);
          for (const [i, p] of r.prints.entries()) {
            expect(p.length, at).toBe(B);
            expect(p, `${at} doc ${i}: the low B bits of the 64-bit print`).toEqual(wide.prints[i].slice(0, B));
          }
          for (let i = 0; i < k; i++) {
            for (let j = 0; j < k; j++) {
              expect(r.distance[i][j], at).toBeLessThanOrEqual(Math.min(B, wide.distance[i][j]));
              expect(r.distance[i][j], at).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    for (const B of [16, 32]) {
      const out = await read(ID, claim('Mean distance, different stories', { [KEY]: String(B) }));
      expect(out.reason).toBeUndefined();
      expect(out.value!, `B=${B}`).toBeLessThan(B / 2);
      const copies = await read(ID, claim('Mean distance, copies of one story', { [KEY]: String(B) }));
      expect(copies.reason).toBeUndefined();
      expect(copies.value!).toBeLessThanOrEqual(B);
      const votes = await read(ID, claim('Bit votes', { [KEY]: String(B) }));
      const x = input('documents', N, '', SEED);
      expect(votes.value).toBe(B * x.docs.reduce((a, doc) => a + words(doc.text), 0));
    }
  });
});

describe('simhash at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): every event and count
  const TRACES = '1440fe2d891108e7';

  it('records the same trace, with the default passed or absent', () => {
    const runs = (extra: Params) => [2, N, 12].flatMap((n) => [1, SEED].map((seed) => {
      const t = trace(kernel, input('documents', n, '', seed), extra);
      return [n, seed, t.counts, hash(t.events.toArray())];
    }));
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ [KEY]: '64' })).toEqual(absent);
  }, 120_000);
});
