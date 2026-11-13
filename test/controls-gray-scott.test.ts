// gray-scott (wave 6). The plate always dropped V into the dish, so it could only show patterns;
// two controls let it show the uniform state they grow from. `drops` (on by default) seeds the
// drops; off, it still draws their random numbers, so every later draw is the same. `dv` (0 by
// default) adds a small uniform V to every cell (the next control).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type Plate, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const ID = 'gray-scott';
const MEAN = 'mean V';

const probe = (readout: string, params: Params): Claim => ({
  id: 'probe', statement: 'a control test reading', readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params },
});

/** The plate mounted headless, counting its random draws. */
async function mount(over: Params) {
  const plate = (await loadPlate(ID)) as Plate;
  const params: Params = { ...defaults(plate), ...over };
  let rows: Stat[] = [];
  let draws = 0;
  const rnd = mulberry32(DEFAULT_SEED);
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: DEFAULT_SEED, rnd: () => { draws++; return rnd(); },
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  return {
    get draws() { return draws; },
    frames(n: number): Record<string, string> {
      for (let f = 0; f < n; f++) sim.draw();
      return Object.fromEntries(rows.map((r) => [r.label, r.value]));
    },
  };
}

describe('gray-scott: drops, "Seed drops"', () => {
  it('is a toggle, on by default, that rebuilds', async () => {
    const d = (await loadPlate(ID))!.params.find((x) => x.key === 'drops');
    expect(d).toMatchObject({ kind: 'toggle', label: 'Seed drops', value: true, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, drops: false }, 7))).toEqual({ seed: 7, params: { drops: false } });
  });

  it('off, it draws the same random numbers and leaves (u, v) = (1, 0) exactly fixed', async () => {
    const on = await mount({});
    const off = await mount({ drops: false });
    expect(off.draws).toBe(on.draws);
    expect(on.draws).toBeGreaterThan(0);
    expect(off.frames(20)[MEAN]).toBe('0.0000');
    const r = await read(ID, probe(MEAN, { drops: false, runs: 200 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(0);
  });

  it('on (the default) the run is the one it was: the same readouts as with no drops key', async () => {
    const plain = await mount({});
    const explicit = await mount({ drops: true });
    expect(explicit.frames(30)).toEqual(plain.frames(30));
  });
});
