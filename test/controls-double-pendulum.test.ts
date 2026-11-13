// double-pendulum (wave 6). Defect D2: the energy drift was relative to E0, whose zero is the
// pivot's height, so at a release of 90° (E0 within a few µJ of 0) it read a thousand times the
// drift it reads at 120°. It is now relative to the oscillation energy E0 − E_min, E_min =
// −(m1 + m2)g·l1 − m2·g·l2 the energy hanging at rest, which is never near 0 for a pendulum in
// motion. Then the release angle's floor, 30°, comes down to 1°, where the small-angle theory
// (two normal modes) gives the drift an analytic bound.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type Plate, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { energy, rk4, type Pendulum, type State } from '../src/plates/double-pendulum/dynamics';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const ID = 'double-pendulum';
const DRIFT = 'energy drift (pendulum 1)';
const K: Pendulum = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 };
/** The energy hanging at rest, both arms straight down. */
const E_MIN = -(K.m1 + K.m2) * K.g * K.l1 - K.m2 * K.g * K.l2;

/** The plate mounted headless (drawing stubbed), its defaults overridden. */
async function mount(over: Params) {
  const plate = (await loadPlate(ID)) as Plate;
  const params: Params = { ...defaults(plate), ...over };
  let rows: Stat[] = [];
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: DEFAULT_SEED, rnd: mulberry32(DEFAULT_SEED),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  return (frames: number): Record<string, string> => {
    for (let f = 0; f < frames; f++) sim.draw();
    return Object.fromEntries(rows.map((r) => [r.label, r.value]));
  };
}

/** Pendulum 1 of the default fan (count 120, spread 1e-6) released at `deg`, after `steps`. */
function firstOfFan(deg: number, steps: number): { e0: number; e: number } {
  const th = (deg * Math.PI) / 180;
  let s: State = [th, th - 0.5e-6, 0, 0];
  const e0 = energy(s, K);
  for (let i = 0; i < steps; i++) s = rk4(s, K, 0.002);
  return { e0, e: energy(s, K) };
}

const drift = (text: string) => Number(text.replace(/ %$/, ''));

describe('double-pendulum D2: the energy drift is relative to the oscillation energy', () => {
  it('at a release of 90° (E0 near the pivot\'s zero), 9.6 s in, the drift is below 1e-5 %', async () => {
    // 600 frames of 8 steps of 2 ms; E0 of pendulum 1 is −g·sin(0.5e-6) ≈ −4.9e-6 J
    const { e0 } = firstOfFan(90, 0);
    expect(Math.abs(e0)).toBeLessThan(1e-5);
    const rows = (await mount({ theta: 90 }))(600);
    expect(rows['simulated time']).toBe('9.60 s');
    expect(drift(rows[DRIFT])).toBeLessThan(1e-5);
  });

  it('reads |E − E0| / (E0 − E_min), replayed independently, at 90° and 120°', async () => {
    expect(E_MIN).toBeCloseTo(-3 * 9.81, 12);
    for (const deg of [90, 120]) {
      const { e0, e } = firstOfFan(deg, 4800);
      const want = `${((100 * Math.abs(e - e0)) / (e0 - E_MIN)).toExponential(2)} %`;
      expect((await mount({ theta: deg }))(600)[DRIFT], `${deg}°`).toBe(want);
    }
  });
});
