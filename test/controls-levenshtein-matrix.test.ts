// The Levenshtein table's substitution cost becomes a control (S2 B3). A substitution cost 1
// implicitly; now it costs the control sub, 1 (default) or 2. Checked: the control exists, it
// travels in a shared link, it drives the readouts (at cost 2 a substitution is never cheaper
// than a deletion and an insertion, so D = |a| + |b| − 2·LCS(a, b), the LCS from an independent
// table here; at cost 1, ||a| − |b|| ≤ D ≤ max(|a|, |b|); (|a| + 1)(|b| + 1) cells either way),
// and the kernel's default trace is what it was before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/levenshtein-matrix';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'levenshtein-matrix';
const KEY = 'sub';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.pair.size.value;
const SHAPES = KINDS.pair.shapes.map((s) => s.value);

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, string> } });

/** Length of a longest common subsequence, by its own table (never the code under test). */
function lcs(a: string, b: string): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[b.length];
}
const pairs = () => SHAPES.flatMap((shape) => [4, N, 48].flatMap((n) => [1, 2, 3, 5, 8, SEED].map((seed) => input('pair', n, shape, seed))));
type R = { distance: number; script: string[] };

describe('levenshtein-matrix: substitution cost', () => {
  it('is a select control with the old implicit cost 1 as its default', () => {
    const d = plate().params.find((x) => x.key === KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Substitution cost', value: '1', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(['1', '2']);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, [KEY]: '2' }, 7))).toEqual({ seed: 7, params: { [KEY]: '2' } });
  });

  it('at cost 2 the distance is |a| + |b| − 2 LCS, at cost 1 within its bounds, the cells the same', () => {
    for (const x of pairs()) {
      const [la, lb] = [x.a.length, x.b.length];
      const two = trace(kernel, x, { [KEY]: '2' });
      const one = trace(kernel, x, { [KEY]: '1' });
      const at = `${x.a} / ${x.b}`;
      expect((two.result as R).distance, at).toBe(la + lb - 2 * lcs(x.a, x.b));
      const d1 = (one.result as R).distance;
      expect(d1, at).toBeGreaterThanOrEqual(Math.abs(la - lb));
      expect(d1, at).toBeLessThanOrEqual(Math.max(la, lb));
      for (const t of [one, two]) expect(t.counts, at).toEqual([(la + 1) * (lb + 1), la * lb]);
      // the edit script walked back is one cheapest: its edits cost the distance at either cost
      for (const [t, c] of [[one, 1], [two, 2]] as const) {
        const s = (t.result as R).script;
        expect(s.reduce((v, e) => v + (e[0] === '=' ? 0 : e[0] === '~' ? c : 1), 0), at).toBe((t.result as R).distance);
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    const x = input('pair', N, SHAPES[0], SEED);
    const d = await read(ID, claim('Distance', { [KEY]: '2' }));
    expect(d.reason).toBeUndefined();
    expect(d.value).toBe(x.a.length + x.b.length - 2 * lcs(x.a, x.b));
    const cells = await read(ID, claim('Cells written', { [KEY]: '2' }));
    expect(cells.value).toBe((x.a.length + 1) * (x.b.length + 1));
  });
});

describe('levenshtein-matrix at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (779097a): every event and count
  const TRACES = 'd6befbe37929ee98';

  it('records the same trace, with the default passed or absent', () => {
    const runs = (extra: Params) => pairs().map((x) => {
      const t = trace(kernel, x, extra);
      return [t.counts, hash(t.events.toArray())];
    });
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ [KEY]: '1' })).toEqual(absent);
  });
});
