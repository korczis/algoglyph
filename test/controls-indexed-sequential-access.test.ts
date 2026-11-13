// Indexed sequential access: the hot key range's width becomes a control (S2 C6). With "Inserts
// crowd into one key range" on, an insert drew its key from ⌊top · (0.4 + 0.05 u)⌋ for a uniform
// u; now from ⌊top · (0.4 + w u)⌋ for the control w, whose default 0.05 is the old width. It
// steers the running plate (no rebuild): only the inserts after a change use the new width.
// Checked: the control exists, it travels in a shared link, it bounds what the plate inserts as
// the key count says, it acts on future inserts only, and the plate reads at its default what
// it read before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PALETTES } from '../src/core/palette';
import type { Params, PlateContext, RangeParam, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import plate from '../src/plates/indexed-sequential-access/plate';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const KEY = 'band';
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const defaults = (): Params => Object.fromEntries(plate.params.map((d) => [d.key, d.value]));

/** Mount the plate on `params` and seed; frames are counted, never timed. */
function mount(params: Params, seed: number) {
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 640, height: 400, params, seed, rnd: mulberry32(seed), theme: 'dark', bg: [0, 0, 0],
    fg: [255, 255, 255], thumbnail: false, palette: () => PALETTES[0], stats: (r) => { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  const value = (label: string) => Number(rows.find((r) => r.label === label)?.value.replace(/,/g, ''));
  return { sim, value, rows: () => rows };
}

/** Distinct keys a hot insert can draw at width w: ⌊top (0.4 + w u)⌋ for u in [0, 1) takes the
 * values ⌊0.4 top⌋ .. ⌊(0.4 + w) top⌋, at most w · top + 2 of them, and the loaded keys are
 * below top ≤ 8n (src/plates/_shared/sorted-search/search.ts sortedKeys). */
const hotKeys = (w: number, n: number) => Math.floor(w * 8 * n) + 2;

describe('indexed sequential access: hot range width', () => {
  it('is a range control steering the running plate, the old width its default', () => {
    const d = plate.params.find((x) => x.key === KEY);
    expect(d).toMatchObject({ kind: 'range', label: 'Hot range width', min: 0.01, max: 0.5, step: 0.01, value: 0.05 });
    expect((d as RangeParam).rebuild, 'it changes future inserts, the plate keeps running').toBeFalsy();
  });

  it('round-trips through a shared link', () => {
    const defs = plate.params;
    for (const w of [0.01, 0.13, 0.5]) {
      expect(parse(defs, serialise(defs, { ...defaults(), [KEY]: w }, 7)), `${w}`).toEqual({ seed: 7, params: { [KEY]: w } });
    }
  });

  it('inserts no more keys than its width holds', () => {
    const pace = plate.params.find((x) => x.key === 'pace') as RangeParam;
    for (const seed of [1, 42, 4242]) {
      for (const w of [0.01, 0.02, 0.05]) {
        const n = 160;
        const p = mount({ ...defaults(), [KEY]: w, pace: pace.max, inserts: 1 }, seed);
        for (let f = 0; f < 600; f++) p.sim.draw();
        const ins = p.value('Inserted since the load');
        expect(ins, `seed ${seed} w=${w}`).toBeLessThanOrEqual(hotKeys(w, n));
        expect(p.value('Keys stored')).toBe(n + ins);
      }
      // the widest band is not the binding limit: the plate stops inserting at three times the load
      const wide = mount({ ...defaults(), [KEY]: 0.5, pace: pace.max, inserts: 1 }, seed);
      for (let f = 0; f < 600; f++) wide.sim.draw();
      expect(wide.value('Inserted since the load'), `seed ${seed}`).toBeGreaterThan(hotKeys(0.05, 160));
    }
  });

  it('acts on the inserts after a change only, without a rebuild', () => {
    const pace = plate.params.find((x) => x.key === 'pace') as RangeParam;
    const params = { ...defaults(), [KEY]: 0.01, pace: pace.max, inserts: 1 };
    const p = mount(params, 42);
    for (let f = 0; f < 600; f++) p.sim.draw();
    const before = p.value('Inserted since the load');
    expect(before, 'the narrow band holds few keys').toBeLessThanOrEqual(hotKeys(0.01, 160));
    params[KEY] = 0.5;
    for (let f = 0; f < 600; f++) p.sim.draw();
    const after = p.value('Inserted since the load');
    // the keys inserted before the change stay, and the wide band takes many more than 0.05 holds
    expect(after).toBeGreaterThan(hotKeys(0.05, 160));
    expect(p.value('Keys stored')).toBe(160 + after);
  });
});

describe('indexed sequential access at its default is what it was before the control', () => {
  // recorded on the code before the control existed (S5 779097a)
  const READOUTS = 'cae064cd2b1cacb2';
  const PARAMS = 'fe014494ef0e32c7';

  const run = () => {
    const rows: unknown[] = [];
    for (const seed of [1, 42, 4242]) {
      for (const hot of [true, false]) {
        const p = mount({ ...defaults(), hot }, seed);
        for (let f = 0; f < 600; f++) { p.sim.draw(); if (f % 100 === 99) rows.push(p.rows().map((r) => r.value)); }
      }
    }
    return rows;
  };

  it('reads the same at its default as before, the default given', () => {
    expect(hash(run())).toBe(READOUTS);
  });

  it('offers the same controls as before, the new one aside', () => {
    expect(hash(plate.params.filter((d) => d.key !== KEY))).toBe(PARAMS);
  });
});
