// gray-scott (wave 6). The plate always dropped V into the dish, so it could only show patterns;
// two controls let it show the uniform state they grow from. `drops` (on by default) seeds the
// drops; off, it still draws their random numbers, so every later draw is the same. `dv` (0 by
// default) adds a small uniform V to every cell. With no drops the field is uniform, the
// Laplacian vanishes, and each cell follows the plate's explicit Euler step (dt = 1) alone:
// v' = v − (f + k)·v + u·v², u' = u − u·v² + f·(1 − u). About (u, v) = (1, 0) the linear part
// is v' = (1 − (f + k))·v, so the perturbation decays as (1 − dt(f + k))^steps.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type Plate, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { PRESETS } from '../src/plates/gray-scott/grayscott';
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

/**
 * The perturbation's prediction after `n` steps of preset `p` and its derived interval. The
 * linear rate r = 1 − (f + k). The quadratic term u·v² only adds (u stays exactly 1: u·v² <
 * 2^−25 rounds away in float32 for v ≤ 1e-4), so v_n = ε·rⁿ·Π(1 + v_m/r) ≥ ε·rⁿ, and the product
 * is below e^(c(1+c)) with c = Σ v_m/r ≤ ε/(r(1 − r)). Each step rounds to float32 (2^−24 at
 * most), ε itself too; the readout prints four significant digits.
 */
function decay(p: { f: number; k: number }, eps: number, n: number) {
  const r = 1 - (p.f + p.k);
  const e32 = Math.fround(eps);
  const at = e32 * r ** n;
  const c = eps / (r * (1 - r));
  const round = (n + 1) * 2 ** -24;
  return { r, at, lo: at * (1 - round), hi: at * (1 + Math.expm1(c * (1 + c)) + round) };
}
/** x cut to four significant digits, down or up: a printed reading of a value in [lo, hi] lies
 * in [down(lo), up(hi)]. */
function digits(x: number, up: boolean): number {
  const unit = 10 ** (Math.floor(Math.log10(x)) - 3);
  return (up ? Math.ceil(x / unit) : Math.floor(x / unit)) * unit;
}

describe('gray-scott: dv, "Uniform V perturbation"', () => {
  it('is a range 0 … 0.01 by 0.0001, 0 by default, that rebuilds', async () => {
    const d = (await loadPlate(ID))!.params.find((x) => x.key === 'dv');
    expect(d).toMatchObject({ kind: 'range', label: 'Uniform V perturbation', min: 0, max: 0.01,
      step: 0.0001, value: 0, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.0001, 0.005, 0.01]) {
      expect(parse(defs, serialise(defs, { ...d, dv: v }, 7))).toEqual({ seed: 7, params: { dv: v } });
    }
  });

  it('at 0 (the default) the run is the one it was: the same readouts as with no dv key', async () => {
    const plain = await mount({});
    const explicit = await mount({ dv: 0 });
    expect(explicit.frames(30)).toEqual(plain.frames(30));
  });

  it('drives the readout: with no drops, mean V decays as ε(1 − (f + k))^steps', async () => {
    for (const [preset, n] of [['coral', 50], ['mitosis', 100], ['chaos', 200]] as const) {
      const p = PRESETS[preset];
      const { lo, hi } = decay(p, 1e-4, n);
      const r = await read(ID, probe(MEAN, { preset, drops: false, dv: 0.0001, runs: n }));
      expect(r.reason).toBeUndefined();
      const v = r.value!;
      expect(v, `${preset}, ${n} steps: ${r.text}`).toBeGreaterThanOrEqual(digits(lo, false) * (1 - 1e-12));
      expect(v, `${preset}, ${n} steps: ${r.text}`).toBeLessThanOrEqual(digits(hi, true) * (1 + 1e-12));
    }
  });
});
