// How often the new version is edited becomes a control (S2 A6): the seeded pair made one edit
// (delete one or two tokens, insert one or two, or replace one) per 5 tokens, k = round(n / 5);
// now k = round(n / e) for the control e, 5 the default, the same expression at 5. The range is
// 5 to 12, fewer edits only: at e = 4 down to 2 the counted work at the plate's largest input
// (48 tokens) grows past the default's heaviest, 1.4 to 3.9 times (rule 5). Checked: the control
// exists with its old default, it travels in a shared link, and at every setting D = N + M − 2·LCS
// for an LCS computed by an independent dynamic programme, with D ≤ 2k and LCS ≥ N − 2k.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/myers-diff';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'myers-diff';
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel as StringKernel as never);
};
const SEED = 4242;
const SETTINGS = [5, 6, 7, 8, 9, 10, 11, 12];

/** The longest common subsequence's length, by the textbook dynamic programme. */
function lcs(a: string[], b: string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[b.length];
}
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params } });

describe('myers-diff: tokens per edit', () => {
  it('is a range control, the old 5 its default', () => {
    const d = plate().params.find((x) => x.key === 'every') as RangeParam | undefined;
    expect(d).toMatchObject({ kind: 'range', label: 'Tokens per edit', min: 5, max: 12, step: 1, value: 5, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [6, 12]) expect(parse(defs, serialise(defs, { ...d, every: v }, 7))).toEqual({ seed: 7, params: { every: v } });
  });

  it('finds D = N + M − 2·LCS within 2k edits, at every setting', () => {
    for (const every of SETTINGS) {
      for (const shape of KINDS.versions.shapes.map((s) => s.value)) {
        for (const n of [4, 14, 31, 48]) {
          for (const seed of [1, 2, 3, SEED]) {
            const x = input('versions', n, shape, seed, { every });
            const k = Math.max(1, Math.round(n / every));
            const tag = `every ${every} ${shape} n=${n} seed=${seed}`;
            const r = trace(kernel, x, { every }).result as { d: number };
            const L = lcs(x.a, x.b);
            expect(r.d, tag).toBe(x.a.length + x.b.length - 2 * L);
            expect(r.d, tag).toBeLessThanOrEqual(2 * k);
            expect(L, tag).toBeGreaterThanOrEqual(x.a.length - 2 * k);
            expect(L, tag).toBeLessThanOrEqual(Math.min(x.a.length, x.b.length));
          }
        }
      }
    }
  });

  it('never makes the plate heavier than its default at 48 tokens', () => {
    const work = (every: number) => Math.max(...[1, 2, 3, 5, 8, SEED].flatMap((seed) => ['letters', 'lines'].map((shape) => {
      const t = trace(kernel, input('versions', 48, shape, seed, { every }), {});
      return t.counts[0] + t.counts[1];
    })));
    const top = work(5);
    for (const every of SETTINGS) expect(work(every), `every ${every}`).toBeLessThanOrEqual(top);
  });

  it('drives the plate\'s readouts', async () => {
    for (const [every, n] of [[12, 48], [8, 48]]) {
      const x = input('versions', n, 'letters', SEED, { every });
      const r = await read(ID, claim('Edit distance D', { n, every }));
      expect(r.reason).toBeUndefined();
      expect(r.value, `every ${every}`).toBe(x.a.length + x.b.length - 2 * lcs(x.a, x.b));
      const l = await read(ID, claim('Longest common subsequence', { n, every }));
      expect(l.value, `every ${every}`).toBe(lcs(x.a, x.b));
    }
  });
});
