// Standard blocking's key length becomes a control (S2 B8). The blocking key was the first three
// letters of the folded surname and the first of the given name; now the first `prefix` letters
// of the surname (1 to 6, default 3). Checked: the control exists (shown with standard blocking
// only), it travels in a shared link, it drives the readouts (the candidate pairs are exactly
// the pairs whose keys agree, Σ C(block, 2) counted here independently, never more than all
// n(n − 1)/2 pairs), and the kernel's default trace is what it was before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS, type Inputs } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel, type Candidates } from '../src/kernels/string/blocking-sorted-neighbourhood';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'blocking-sorted-neighbourhood';
const KEY = 'prefix';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.records.size.value;

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });

/** The pairs whose blocking keys agree, by the oracle's own key: the folded surname's first
 * p letters and the given name's first, A to Z only. */
function blockPairs({ records }: Inputs['records'], p: number): string[] {
  const up = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toUpperCase().replace(/[^A-Z]/g, '');
  const key = records.map((r) => `${up(r.surname).slice(0, p)}${up(r.given).slice(0, 1)}`);
  const out: string[] = [];
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) if (key[i] === key[j]) out.push(`${i},${j}`);
  return out;
}

describe('blocking-sorted-neighbourhood: surname letters in the key', () => {
  it('is a range control with the old constant 3 as its default, shown with standard blocking', () => {
    const d = plate().params.find((x) => x.key === KEY);
    expect(d).toMatchObject({ kind: 'range', label: 'Surname letters in the key', min: 1, max: 6, step: 1, value: 3, rebuild: true,
      when: { key: 'method', values: ['blocking'] } });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const p of [1, 4, 6]) {
      expect(parse(defs, serialise(defs, { ...d, method: 'blocking', [KEY]: p }, 7)), `${p}`)
        .toEqual({ seed: 7, params: { method: 'blocking', [KEY]: p } });
    }
  });

  it('pairs exactly the records whose keys agree, never more than all pairs, at every setting', () => {
    for (let p = 1; p <= 6; p++) {
      for (const n of [4, N, 60]) {
        for (const seed of [1, 2, 3, SEED]) {
          const x = input('records', n, '', seed);
          const t = trace(kernel, x, { method: 'blocking', [KEY]: p });
          const r = t.result as Candidates;
          const want = blockPairs(x, p);
          const at = `p=${p} n=${n} seed=${seed}`;
          expect(r.pairs.map((q) => q.join()).sort(), at).toEqual(want.sort());
          expect(t.counts[1], at).toBe(want.length);
          const k = x.records.length;
          expect(t.counts[1], at).toBeLessThanOrEqual((k * (k - 1)) / 2);
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const x = input('records', N, '', SEED);
    for (const p of [1, 6]) {
      const c = await read(ID, claim('Candidate pairs', { method: 'blocking', [KEY]: p }));
      expect(c.reason).toBeUndefined();
      expect(c.value, `p=${p}`).toBe(blockPairs(x, p).length);
    }
  });
});

describe('blocking-sorted-neighbourhood at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): every event and count
  const TRACES = 'f1ec0405f204d1e0';

  it('records the same trace in both methods, with the default passed or absent', () => {
    const runs = (extra: Params) => ['sorted', 'blocking'].flatMap((method) => [4, N, 60].flatMap((n) => [1, SEED].map((seed) => {
      const t = trace(kernel, input('records', n, '', seed), { method, ...extra });
      return [method, n, seed, t.counts, hash(t.events.toArray())];
    })));
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ [KEY]: 3 })).toEqual(absent);
  });
});
