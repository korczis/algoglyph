// The dynamic hash table's resize thresholds become controls (S2 C5): the table doubled once more
// than 1/2 full and halved below 1/8 full; now it doubles past the grow threshold g (1/2, the
// default, or 3/4) and halves below the shrink threshold s (1/8, the default, or 1/4), and a
// shrink threshold that is not below g / 2 is not used (the table would resize back and forth),
// so 1/4 takes effect only with g = 3/4. Checked: the controls exist with the old thresholds as
// their defaults, they travel in a shared link, the load factor never passes g after an insert,
// the rehashes are the count the doubling rule gives, they drive what the plate reads, and the
// plate at its defaults is what it was before the controls existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/hash/index';
import { KIND, OP, STRIDE, Table, apply, trace, type HashKernel } from '../src/engines/hash/table';
import { STREAMS, workload } from '../src/engines/hash/workload';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<HashKernel>('../src/kernels/hash/[!_]*.ts', { import: 'kernel', eager: true });
const ID = 'dynamic-hash-table';
const kernel = modules[`../src/kernels/hash/${ID}.ts`];
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
/** The plate's default keys inserted. */
const N = 96;
const SEED = 4242;
const MIN = 4;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const frac = (s: string) => { const [a, b] = s.split('/').map(Number); return a / b; };

/** Doublings while n keys go in: the table starts at 4 slots and doubles on the insert that takes
 * it past g · m, once per insert (the count grows by one and g · m ≥ 2), so it ends at the least
 * 4 · 2^k with n ≤ g · 4 · 2^k: k = max(0, ⌈lg(n / 4g)⌉). */
const doublings = (n: number, g: number) => Math.max(0, Math.ceil(Math.log2(n / (MIN * g)) - 1e-12));

/** Halvings while keys leave: below s · m (and above 4 slots) the table halves; s < g / 2. */
function halvings(n: number, g: number, s: number, deleted: number): { k: number; m: number } {
  let m = MIN * 2 ** doublings(n, g);
  let k = 0;
  for (let c = n - 1; c >= n - deleted; c--) if (m > MIN && c < s * m) { m /= 2; k++; }
  return { k, m };
}

const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, string> } });

describe('dynamic hash table: grow and shrink thresholds', () => {
  it('are two select controls, the old thresholds their defaults', () => {
    const defs = plate().params;
    expect(defs.find((d) => d.key === 'grow')).toMatchObject({ kind: 'select', label: 'Grow past load', value: '1/2', rebuild: true,
      options: [{ value: '1/2' }, { value: '3/4' }] });
    expect(defs.find((d) => d.key === 'shrink')).toMatchObject({ kind: 'select', label: 'Shrink below load', value: '1/8', rebuild: true,
      options: [{ value: '1/8' }, { value: '1/4' }] });
    expect(kernel.params?.map((d) => d.key)).toEqual(['grow', 'shrink']);
  });

  it('round-trip through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, grow: '3/4', shrink: '1/4' }, 7))).toEqual({ seed: 7, params: { grow: '3/4', shrink: '1/4' } });
    expect(parse(defs, serialise(defs, { ...d, grow: '3/4' }, 7))).toEqual({ seed: 7, params: { grow: '3/4' } });
  });

  it('keep the load factor at most g after every insert, and resize as often as counted', () => {
    for (const [grow, shrink] of [['1/2', '1/8'], ['3/4', '1/8'], ['3/4', '1/4'], ['1/2', '1/4']]) {
      const g = frac(grow);
      // a shrink threshold not below g / 2 is not used: the default 1/8 stands
      const s = frac(shrink) < g / 2 ? frac(shrink) : 1 / 8;
      for (const stream of STREAMS) {
        for (const n of [8, 31, N, 512]) {
          for (const del of [0, 90]) {
            for (const seed of [1, SEED]) {
              const t = trace(kernel, workload(stream, n, del, seed), { n, m: 1, pageSize: 4, opts: { grow, shrink } });
              const tb = new Table();
              let inserting = true;
              let grew = 0; let shrank = 0;
              for (let e = 0; e < t.length; e++) {
                const o = STRIDE * e;
                if (t.events[o] === OP.resize && tb.m > 0) {
                  if (t.events[o + 1] > tb.m) grew++; else shrank++;
                }
                apply(tb, t.events, e);
                if (t.events[o] === OP.end && t.events[o + 1] === KIND.insert) {
                  expect(tb.count / tb.m, `${grow} ${stream} n=${n}`).toBeLessThanOrEqual(g);
                }
                if (t.events[o] === OP.begin && t.events[o + 1] === KIND.remove) inserting = false;
                if (!inserting && t.events[o] === OP.end) expect(tb.m === MIN || tb.count >= s * tb.m, 'never below s once deleting').toBe(true);
              }
              expect(grew, `${grow} ${stream} n=${n}`).toBe(doublings(n, g));
              const deleted = Math.round((n * del) / 100);
              const h = halvings(n, g, s, deleted);
              expect(shrank, `${grow}/${shrink} ${stream} n=${n} del=${del}`).toBe(h.k);
              expect(t.counts.rehashes).toBe(doublings(n, g) + h.k);
              expect(tb.m).toBe(h.m);
            }
          }
        }
      }
    }
  }, 120_000);

  it('drive the plate\'s readouts', async () => {
    for (const grow of ['1/2', '3/4']) {
      const at = { deletes: 0, grow };
      const r = await read(ID, claim('Rehashes', at));
      expect(r.reason).toBeUndefined();
      expect(r.value, grow).toBe(doublings(N, frac(grow)));
      const a = await read(ID, claim('Load factor', at));
      expect(a.value!, grow).toBeLessThanOrEqual(frac(grow));
      expect((await read(ID, claim('Slots', at))).value, grow).toBe(MIN * 2 ** doublings(N, frac(grow)));
    }
    const s = await read(ID, claim('Slots', { deletes: 90, grow: '3/4', shrink: '1/4' }));
    expect(s.value).toBe(halvings(N, 0.75, 0.25, Math.round(N * 0.9)).m);
  }, 120_000);
});

describe('the dynamic hash table at its defaults is what it was before the threshold controls', () => {
  // recorded on the code before the controls existed (S5 779097a)
  const PARAMS = 'c331c5291f70e3e1';

  it('records the same trace, the defaults given or not', () => {
    for (const stream of STREAMS) {
      for (const n of [8, N, 512]) {
        for (const del of [0, 50, 90]) {
          for (const seed of [1, SEED]) {
            const steps = workload(stream, n, del, seed);
            const a = trace(kernel, steps, { n, m: 1, pageSize: 4 });
            const b = trace(kernel, steps, { n, m: 1, pageSize: 4, opts: { grow: '1/2', shrink: '1/8' } });
            expect(hash([Array.from(b.events.subarray(0, STRIDE * b.length)), b.counts]), `${stream} n=${n} del=${del}`)
              .toBe(hash([Array.from(a.events.subarray(0, STRIDE * a.length)), a.counts]));
          }
        }
      }
    }
  });

  it('offers the same controls as before, the new ones aside', () => {
    expect(hash(plate().params.filter((d) => !['band', 'grow', 'shrink'].includes(d.key)))).toBe(PARAMS);
  });

  it('reads the same at its defaults, the defaults given or not', async () => {
    for (const stream of ['uniform', 'adversarial']) {
      for (const readout of ['Keys stored', 'Slots', 'Load factor', 'Probes per search', 'Longest cluster', 'Rehashes',
        'Hash evaluations', 'Writes', 'Progress']) {
        const bare = await read(ID, claim(readout, { stream }));
        const given = await read(ID, claim(readout, { stream, grow: '1/2', shrink: '1/8' }));
        expect(given.text, `${stream} ${readout}`).toBe(bare.text);
      }
    }
  }, 120_000);
});
