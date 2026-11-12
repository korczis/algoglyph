// How often each side edits the ancestor becomes a control (S2 A7): ours and theirs each made
// k = round(n / 6) edits of the n ancestor lines; now k = round(n / e) for the control e, 6 the
// default, the same division (n × (1/6) would round differently at n = 6j + 3). The range is 6 to
// 12, fewer edits only: at e = 5 down to 2 the counted work at the plate's largest input (40
// lines) grows past the default's heaviest, 1.2 to 3.4 times (rule 5). Checked: the control
// exists with its old default, it travels in a shared link, and at every setting the merge keeps
// its invariants: conflicts at most the changed chunks, those at most 4k, the three versions
// partitioned in order, and a clean
// merge of a side that equals the ancestor being the other side.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { kernel, type MergeResult } from '../src/kernels/string/diff3-merge';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'diff3-merge';
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel as StringKernel as never);
};
const SEED = 4242;
const SETTINGS = [6, 7, 8, 9, 10, 11, 12];
const claim = (readout: string, params: Params, expect: Claim['expect'] = { value: 0 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params } });

describe('diff3-merge: lines per edit', () => {
  it('is a range control, the old 6 its default', () => {
    const d = plate().params.find((x) => x.key === 'every') as RangeParam | undefined;
    expect(d).toMatchObject({ kind: 'range', label: 'Lines per edit', min: 6, max: 12, step: 1, value: 6, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [7, 12]) expect(parse(defs, serialise(defs, { ...d, every: v }, 7))).toEqual({ seed: 7, params: { every: v } });
  });

  it('keeps the merge\'s invariants at every setting', () => {
    for (const every of SETTINGS) {
      for (const n of [4, 9, 12, 27, 40]) {
        for (const seed of [1, 2, 3, 5, 8, SEED]) {
          const x = input('merge', n, '', seed, { every });
          const tag = `every ${every} n=${n} seed=${seed}`;
          const r = trace(kernel, x, { every }).result as MergeResult;
          const changed = r.chunks.filter((c) => c.kind !== 'stable').length;
          expect(r.conflicts, tag).toBeLessThanOrEqual(changed);
          // each changed chunk holds a run of one side's edit script, and a side's k edits cost it at
          // most 2k edit steps: at most 4k changed chunks
          expect(changed, tag).toBeLessThanOrEqual(4 * Math.max(1, Math.round(n / every)));
          expect(r.conflicts, tag).toBe(r.chunks.filter((c) => c.kind === 'conflict').length);
          // the chunks partition all three versions, in order
          for (const side of ['base', 'ours', 'theirs'] as const) expect(r.chunks.flatMap((c) => c[side]), `${tag} ${side}`).toEqual(x[side]);
          // a merge with one side equal to the ancestor is the other side, conflict-free
          const clean = trace(kernel, { base: x.base, ours: x.base, theirs: x.theirs }).result as MergeResult;
          expect(clean.merged, tag).toEqual(x.theirs);
          expect(clean.conflicts, tag).toBe(0);
        }
      }
    }
  });

  it('never makes the plate heavier than its default at 40 lines', () => {
    const work = (every: number) => Math.max(...[1, 2, 3, 5, 8, SEED].map((seed) => {
      const t = trace(kernel, input('merge', 40, '', seed, { every }), {});
      return t.counts[0] + t.counts[1];
    }));
    const top = work(6);
    for (const every of SETTINGS) expect(work(every), `every ${every}`).toBeLessThanOrEqual(top);
  });

  it('drives the plate\'s readouts', async () => {
    for (const every of [6, 12]) {
      const x = input('merge', 40, '', SEED, { every });
      const r = trace(kernel, x, {}).result as MergeResult;
      const c = await read(ID, claim('Conflicts', { n: 40, every }));
      expect(c.reason).toBeUndefined();
      expect(c.value, `every ${every}`).toBe(r.conflicts);
      const d = await read(ID, claim('Conflicts', { n: 40, every }, { against: 'Changed chunks', below: 1 }));
      expect(d.value!, `every ${every}: conflicts − changed chunks`).toBeLessThanOrEqual(0);
    }
    // fewer edits per side at 12 than at 6: the line comparisons of the two diffs fall
    const cmp = async (every: number) => (await read(ID, claim('Line comparisons', { n: 40, every }))).value!;
    expect(await cmp(12)).toBeLessThan(await cmp(6));
  }, 60_000);
});
