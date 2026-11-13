// The fields Fellegi–Sunter compares become a control (S2 B4). Every pair was compared on all
// four fields (given name, surname, year, town); now the control picks all four (default), the
// given name and surname, or those and the year. Checked: the control exists, it travels in a
// shared link, it drives the readouts (field comparisons = f × pairs exactly, one EM update per
// pair in each iteration, precision and recall within [0, 1]), and the kernel's default trace
// is what it was before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { OP, trace } from '../src/engines/string/trace';
import { kernel, type FsResult } from '../src/kernels/string/fellegi-sunter';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'fellegi-sunter';
const KEY = 'fields';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.records.size.value;
/** The fields each setting compares. */
const COUNT: Record<string, number> = { all: 4, name: 2, nameyear: 3 };

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, string> } });
/** The stat a run published last under a label. */
const statOf = (t: ReturnType<typeof trace>, label: string) =>
  t.events.toArray().filter((e) => e.o === OP.stat && e.s === label).at(-1)?.ss?.[0];

describe('fellegi-sunter: fields compared', () => {
  it('is a select control with all four fields, the old constant, as its default', () => {
    const d = plate().params.find((x) => x.key === KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Fields compared', value: 'all', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(['all', 'name', 'nameyear']);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const f of ['name', 'nameyear']) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: f }, 7)), f).toEqual({ seed: 7, params: { [KEY]: f } });
    }
  });

  it('compares f fields of every pair, and precision and recall stay within [0, 1]', () => {
    for (const f of Object.keys(COUNT)) {
      for (const n of [4, N, 40]) {
        for (const seed of [1, 2, 3, SEED]) {
          const x = input('records', n, '', seed);
          const t = trace(kernel, x, { [KEY]: f });
          const r = t.result as FsResult;
          const k = x.records.length;
          const at = `${f} n=${n} seed=${seed}`;
          expect(r.pairs.length, at).toBe((k * (k - 1)) / 2);
          expect(t.counts[0], at).toBe(COUNT[f] * r.pairs.length);
          expect(t.counts[1], at).toBe(r.loglik.length * r.pairs.length);
          expect(r.m.length, at).toBe(COUNT[f]);
          for (const label of ['Precision', 'Recall']) {
            const v = Number(statOf(t, label));
            if (Number.isFinite(v)) { expect(v, `${at} ${label}`).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const k = input('records', N, '', SEED).records.length;
    for (const f of ['name', 'nameyear']) {
      const c = await read(ID, claim('Field comparisons', { [KEY]: f }));
      expect(c.reason).toBeUndefined();
      expect(c.value, f).toBe((COUNT[f] * k * (k - 1)) / 2);
      for (const label of ['Precision', 'Recall']) {
        const r = await read(ID, claim(label, { [KEY]: f }));
        expect(r.reason, `${f} ${label}`).toBeUndefined();
        expect(r.value!).toBeGreaterThanOrEqual(0);
        expect(r.value!).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('fellegi-sunter at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): the comparison phase's events and
  // counts, integers and strings only (the EM that follows stops on a log-likelihood, a log)
  const COMPARED = 'b1968dd3fb606034';

  it('records the same comparisons, and the same whole trace with the default passed or absent', () => {
    const runs = (extra: Params, whole: boolean) => [4, N, 40].flatMap((n) => [1, SEED].map((seed) => {
      const t = trace(kernel, input('records', n, '', seed), extra);
      const ev = t.events.toArray();
      // the first EM update ends the comparison phase
      const em = ev.findIndex((e) => e.o === OP.tick && e.i === 1);
      return whole ? [t.counts, hash(ev)] : [t.counts[0], hash(ev.slice(0, em).map((e) => [e.o, e.p, e.i, e.j, e.s, e.ss]))];
    }));
    expect(hash(runs({}, false))).toBe(COMPARED);
    expect(runs({ [KEY]: 'all' }, true)).toEqual(runs({}, true));
  }, 120_000);
});
