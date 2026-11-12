// Run-length encoding's split of a long run becomes reachable (S2 A3, the owner's decision F2).
// Scanline runs were 1 + ⌊Exp(mean 6)⌋ symbols, so a run over 255 never occurred and the split the
// article describes was never drawn. Two controls: the mean of that exponential part (default 6,
// the same random numbers in the same order), up to 400, where runs over 255 are common; and the
// count's width, 8 bits (255, the default), 4 (15) or 2 (3). Checked: both exist with their old
// defaults, they travel in a shared link, and at every setting the pairs are exactly
// Σ ⌈L / MAX⌉ over the text's maximal runs L, their counts sum to n, and the comparisons are
// n − 1 less one for every pair cut at the limit before the text's end.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/run-length-encoding';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'run-length-encoding';
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel as StringKernel as never);
};
const SEED = 4242;
const MAX = { 8: 255, 4: 15, 2: 3 } as Record<string, number>;

/** The text's maximal runs, by a regular expression (an independent reading). */
const runs = (text: string) => (text.match(/(.)\1*/gs) ?? []).map((r) => r.length);
const pairsOf = (text: string, max: number) => runs(text).reduce((s, L) => s + Math.ceil(L / max), 0);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params } });

describe('run-length-encoding: mean run', () => {
  it('is a range control, the old mean 6 its default', () => {
    const d = plate().params.find((x) => x.key === 'meanRun') as RangeParam | undefined;
    expect(d).toMatchObject({ kind: 'range', label: 'Mean run', min: 1, max: 400, step: 1, value: 6, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [1, 40, 400]) expect(parse(defs, serialise(defs, { ...d, meanRun: v }, 7))).toEqual({ seed: 7, params: { meanRun: v } });
  });

  it('draws runs over 255 at a mean of 400, never at 6', () => {
    const long = (mean: number) => [1, 2, 3, 5, 8, SEED].reduce((s, seed) =>
      s + runs(input('text', 1024, 'runs', seed, { meanRun: mean }).text).filter((L) => L > 255).length, 0);
    expect(long(6)).toBe(0);
    expect(long(400)).toBeGreaterThan(0);
  });

  it('drives the plate\'s readouts', async () => {
    const x = input('text', 1024, 'runs', SEED, { meanRun: 400 });
    const want = pairsOf(x.text, 255);
    // a run over 255 is split: more pairs than runs
    expect(want).toBeGreaterThan(runs(x.text).length);
    const r = await read(ID, claim('Pairs emitted', { n: 1024, meanRun: 400 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(want);
  }, 60_000);
});

describe('run-length-encoding: count width', () => {
  it('is a select control, 8 bits its default', () => {
    const d = plate().params.find((x) => x.key === 'countBits') as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Count width', value: '8', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(['8', '4', '2']);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of ['4', '2']) expect(parse(defs, serialise(defs, { ...d, countBits: v }, 7))).toEqual({ seed: 7, params: { countBits: v } });
  });

  it('emits Σ ⌈L / MAX⌉ pairs whose counts sum to n, at every setting of both controls', () => {
    for (const bits of ['8', '4', '2']) {
      const max = MAX[bits];
      for (const mean of [1, 6, 40, 400]) {
        for (const shape of ['runs', 'prose', 'repetitive']) {
          for (const n of [16, 120, 1024]) {
            for (const seed of [1, SEED]) {
              const x = input('text', n, shape, seed, { meanRun: mean });
              const t = trace(kernel, x, { countBits: bits, meanRun: mean });
              const out = t.result as [number, string][];
              const tag = `${bits} bits mean ${mean} ${shape} n=${n} seed=${seed}`;
              expect(out.length, tag).toBe(pairsOf(x.text, max));
              expect(out.reduce((s, [c]) => s + c, 0), tag).toBe(x.text.length);
              expect(out.map(([c, s]) => s.repeat(c)).join(''), tag).toBe(x.text);
              expect(Math.max(...out.map(([c]) => c)), tag).toBeLessThanOrEqual(max);
              const cut = out.slice(0, -1).filter(([c]) => c === max).length;
              expect(t.counts[0], tag).toBe(x.text.length - 1 - cut);
            }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const x = input('text', 120, 'runs', SEED);
    for (const bits of ['4', '2']) {
      const r = await read(ID, claim('Pairs emitted', { countBits: bits }));
      expect(r.reason).toBeUndefined();
      expect(r.value, bits).toBe(pairsOf(x.text, MAX[bits]));
      const o = await read(ID, claim('Output / input', { countBits: bits }));
      // a pair is a count of `bits` and a symbol of 8, the total rounded up to whole bytes
      expect(o.value, bits).toBe(Math.ceil((pairsOf(x.text, MAX[bits]) * (Number(bits) + 8)) / 8));
    }
  }, 60_000);
});
