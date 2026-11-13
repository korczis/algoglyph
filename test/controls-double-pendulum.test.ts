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

const KEY = 'theta';
/** A claim that reads `readout` once the run has settled, judging nothing. */
const probe = (readout: string, params: Params): Claim => ({
  id: 'probe', statement: 'a control test reading', readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params },
});

// The small-angle oracle for m1 = m2, l1 = l2 = l: two normal modes, ω∓² = (2 ∓ √2)g/l, the
// slow one (1, √2) and the fast one (1, −√2). Released at rest from (θ, θ), the angles are
// a·(1, √2) + b·(1, −√2) with a = (2 + √2)/4, b = (2 − √2)/4, and the two modes carry the
// fractions a²/(a² + b²) and b²/(a² + b²) of the oscillation energy (both have vᵀKv = 4g).
// RK4 on a mode of frequency ω multiplies its energy by |R(iωh)|² = 1 − (ωh)⁶/72 + (ωh)⁸/576 a
// step, R(z) = 1 + z + z²/2 + z³/6 + z⁴/24, so after n steps the drift is
// Σ w_k (1 − |R(iω_k h)|^(2n)), below n(ω₊h)⁶/72.
const G = 9.81;
const R2 = (y: number) => (1 - (y * y) / 2 + y ** 4 / 24) ** 2 + (y - y ** 3 / 6) ** 2;
const W_FAST = Math.sqrt((2 + Math.SQRT2) * G);
const W_SLOW = Math.sqrt((2 - Math.SQRT2) * G);
function smallAngleDrift(h: number, n: number): { linear: number; bound: number } {
  const a = (2 + Math.SQRT2) / 4;
  const b = (2 - Math.SQRT2) / 4;
  const fast = (b * b) / (a * a + b * b);
  const linear = fast * (1 - R2(W_FAST * h) ** n) + (1 - fast) * (1 - R2(W_SLOW * h) ** n);
  return { linear, bound: (n * (W_FAST * h) ** 6) / 72 };
}

describe('double-pendulum: theta, "Release angle (°)"', () => {
  it('is a range 1 … 179 by 1, 120 (the old default) by default', async () => {
    const d = (await loadPlate(ID))!.params.find((x) => x.key === KEY);
    expect(d).toMatchObject({ kind: 'range', label: 'Release angle (°)', min: 1, max: 179, step: 1,
      value: 120, rebuild: true });
  });

  it('round-trips through a shared link, down to 1°', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [1, 5, 29]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('the oracle: the bound is n(ω₊h)⁶/72 = 1.67e-10 at dt 2 ms over 10 s, the drift 4.79e-12', () => {
    const { linear, bound } = smallAngleDrift(0.002, 5000);
    expect(W_FAST * 0.002).toBeCloseTo(0.0115747, 6);
    expect(bound).toBeCloseTo(1.6699e-10, 13);
    expect(linear).toBeCloseTo(4.794e-12, 14);
    expect(linear).toBeLessThan(bound);
  });

  it('drives the readout: at 1°, one pendulum, 10 s, the drift is the small-angle one', async () => {
    // the swing E0 − E_min at 1° is ½·3g·θ² ≈ 4.48e-3 J, against |E| ≈ 29.4 J: each energy
    // evaluation rounds by about an ulp of 29.4 (3.6e-15 J), 7.9e-13 of the swing, so the drift
    // is read to within a few of those (4 ulp: 3.2e-12), as well as the bound n(ω₊h)⁶/72
    const swing = 1.5 * G * (Math.PI / 180) ** 2;
    const ulps = (4 * 2 ** -52 * 32) / swing;
    for (const [dt, n] of [[2, 5000], [5, 2000]] as const) {
      const r = await read(ID, probe(DRIFT, { count: 1, [KEY]: 1, dt, runs: 10 }));
      expect(r.reason).toBeUndefined();
      const { linear, bound } = smallAngleDrift(dt / 1000, n);
      // the readout is in per cent; the nonlinearity at 1° shifts the frequencies by O(θ²) = 3e-4
      // and the readout prints three digits (0.5 %)
      expect(r.value!, `dt ${dt} ms`).toBeLessThan(100 * bound);
      const tol = 100 * (ulps + 0.01 * linear);
      expect(Math.abs(r.value! - 100 * linear), `dt ${dt} ms: ${r.value} against ${100 * linear}`)
        .toBeLessThanOrEqual(tol);
    }
  });
});
