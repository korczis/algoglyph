// The entropy map's stride becomes a control (S2 B9). The window of w bytes slid in steps of
// w/8; now in steps of w/8 (default), w/4, w/2 or w. Checked: the control exists, it travels in
// a shared link, it drives the readouts (nWin = ⌊(N − w)/s⌋ + 1 windows, and w + 2s(nWin − 1)
// histogram updates exactly, at most 2N; every window's entropy is the entropy of its bytes,
// counted here independently, and at most log2 w), and the kernel's default trace is what it was
// before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/entropy-map';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'entropy-map';
const KEY = 'stride';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.binary.size.value;
/** The step for each setting: the window divided by the option's value. */
const DIVISORS = ['8', '4', '2', '1'];

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, string> } });

/** Shannon entropy of a byte array in bits per byte, written here from its definition. */
function entropy(b: number[]): number {
  const f = new Map<number, number>();
  for (const x of b) f.set(x, (f.get(x) ?? 0) + 1);
  let h = 0;
  for (const c of f.values()) h -= (c / b.length) * Math.log2(c / b.length);
  return h;
}
/** The oracle's counts: windows and histogram updates for N bytes, window w, step s. */
const windows = (n: number, w: number, s: number) => Math.floor((n - w) / s) + 1;
const updates = (n: number, w: number, s: number) => w + 2 * s * (windows(n, w, s) - 1);

describe('entropy-map: stride', () => {
  it('is a select control with the old step w/8 as its default', () => {
    const d = plate().params.find((x) => x.key === KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Step', value: '8', rebuild: true });
    expect(d!.options.map((o) => [o.value, o.label])).toEqual([['8', 'w/8'], ['4', 'w/4'], ['2', 'w/2'], ['1', 'w']]);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of ['4', '2', '1']) expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), v).toEqual({ seed: 7, params: { [KEY]: v } });
  });

  it('counts w + 2s(nWin − 1) ≤ 2N updates and measures every window exactly, at every step', () => {
    for (const div of DIVISORS) {
      for (const window of ['64', '128', '256']) {
        for (const n of [4, N, 23]) {
          for (const seed of [1, SEED]) {
            const x = input('binary', n, '', seed);
            const w = Number(window); const s = w / Number(div);
            const t = trace(kernel, x, { window, [KEY]: div });
            const r = t.result as { offsets: number[]; entropy: number[] };
            const at = `w=${w} s=${s} n=${n} seed=${seed}`;
            const bytes = x.bytes.length;
            expect(t.counts[1], at).toBe(windows(bytes, w, s));
            expect(t.counts[0], at).toBe(updates(bytes, w, s));
            expect(t.counts[0], at).toBeLessThanOrEqual(2 * bytes);
            expect(r.offsets, at).toEqual(Array.from({ length: windows(bytes, w, s) }, (_, k) => k * s));
            r.offsets.forEach((o, k) => {
              expect(r.entropy[k], `${at} @${o}`).toBeCloseTo(entropy(x.bytes.slice(o, o + w)), 9);
              expect(r.entropy[k]).toBeLessThanOrEqual(Math.log2(w) + 1e-12);
            });
          }
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const bytes = input('binary', N, '', SEED).bytes.length;
    for (const div of ['4', '1']) {
      const s = 128 / Number(div);
      const u = await read(ID, claim('Histogram updates', { [KEY]: div }));
      expect(u.reason).toBeUndefined();
      expect(u.value, `s=${s}`).toBe(updates(bytes, 128, s));
      const k = await read(ID, claim('Windows measured', { [KEY]: div }));
      expect(k.value, `s=${s}`).toBe(windows(bytes, 128, s));
      const h = await read(ID, claim('Mean entropy, random', { [KEY]: div }));
      expect(h.reason).toBeUndefined();
      expect(h.value!).toBeLessThanOrEqual(7);
    }
  });
});

describe('entropy-map at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): the integer columns of every
  // event and the counts (the entropies themselves come from log2, a float compared within a run)
  const TRACES = 'b28c9049bda2a09c';

  it('records the same trace, with the default passed or absent', () => {
    const runs = (extra: Params, whole: boolean) => ['64', '128', '256'].flatMap((window) => [4, N].flatMap((n) => [1, SEED].map((seed) => {
      const t = trace(kernel, input('binary', n, '', seed), { window, ...extra });
      const ev = t.events.toArray();
      return [window, n, seed, t.counts, hash(whole ? ev : ev.map((e) => [e.o, e.p, e.i, e.j]))];
    })));
    expect(hash(runs({}, false))).toBe(TRACES);
    expect(runs({ [KEY]: '8' }, true)).toEqual(runs({}, true));
  });
});
