// The regular expression's nesting becomes a control (S2 A4): the seeded pattern was drawn as a
// tree of depth 3 (concatenation, alternation and *, + or ? over the letters a, b, c and '.');
// now its depth is 1 to 3, 3 the default, the same random numbers in the same order. Checked: the
// control exists with its old default, it travels in a shared link, and at every depth the match
// ends are those JavaScript's own RegExp finds over every (start, end) of the text (an
// independent engine), with at most m + 3 states active for a pattern of m characters.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { OP, trace, type StringKernel } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/regex-nfa';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'regex-nfa';
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel as StringKernel as never);
};
const SEED = 4242;

/** Every end e (0..n) of some match text[s..e), by JavaScript's RegExp anchored at both ends. */
function ends(pattern: string, text: string): number[] {
  const re = new RegExp(`^(?:${pattern})$`);
  const out: number[] = [];
  for (let e = 0; e <= text.length; e++) {
    for (let s = 0; s <= e; s++) if (re.test(text.slice(s, e))) { out.push(e); break; }
  }
  return out;
}
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params } });

describe('regex-nfa: pattern nesting', () => {
  it('is a range control, the old depth 3 its default', () => {
    const d = plate().params.find((x) => x.key === 'depth') as RangeParam | undefined;
    expect(d).toMatchObject({ kind: 'range', label: 'Pattern nesting', min: 1, max: 3, step: 1, value: 3, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [1, 2]) expect(parse(defs, serialise(defs, { ...d, depth: v }, 7))).toEqual({ seed: 7, params: { depth: v } });
  });

  it('finds the ends RegExp finds, with at most m + 3 states active, at every depth', () => {
    const longest = [0, 0, 0, 0];
    for (const depth of [1, 2, 3]) {
      for (const n of [8, 36, 120, 200]) {
        for (const seed of [1, 2, 3, 5, 8, 13, SEED]) {
          const x = input('regex', n, '', seed, { depth });
          const tag = `depth ${depth} n=${n} seed=${seed}: ${x.pattern}`;
          longest[depth] = Math.max(longest[depth], x.pattern.length);
          const t = trace(kernel, x, { depth });
          expect(t.result, tag).toEqual(ends(x.pattern, x.text));
          const m = x.pattern.length;
          const sizes = t.events.toArray().filter((e) => e.o === OP.plot && e.s === 'Active states').map((e) => Number(e.ss?.[0]));
          expect(Math.max(0, ...sizes), tag).toBeLessThanOrEqual(m + 3);
          expect(t.counts[0], tag).toBeLessThanOrEqual((m + 2) * x.text.length);
        }
      }
    }
    // a shallower tree is a shorter pattern
    expect(longest[1]).toBeLessThan(longest[3]);
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const n = KINDS.regex.size.value;
    for (const depth of [1, 2]) {
      const x = input('regex', n, '', SEED, { depth });
      const r = await read(ID, claim('Match ends', { depth }));
      expect(r.reason).toBeUndefined();
      expect(r.value, `depth ${depth}: ${x.pattern}`).toBe(ends(x.pattern, x.text).length);
    }
  });
});
