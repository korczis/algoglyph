// The settle signal of a stream plate (src/plates/_shared/settle/settle.ts): an integrator or a
// cellular automaton never ends a run, so the claims instrument (ADR 0007) could not tell when
// to read it ("did not settle within 20000 frames"). The same `runs` control as the plates that
// restart stops it, counting a run as one block of the plate's own unit (a simulated second, a
// step, a generation); `completed runs` counts the blocks, and the plate's per-frame loop is
// clamped so that it stops exactly on the k-th block however many units a frame steps. At 0, the
// default, nothing is clamped: the default run is the one it was, checked within one run.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type Plate, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import {
  rk4 as pendulumStep, type Pendulum, type State,
} from '../src/plates/double-pendulum/dynamics';
import {
  COMPLETED_RUNS, LAST_COMPLETED_RUN, RUNS_KEY, RunCounter, runsParam, StreamStop,
} from '../src/plates/_shared/settle/settle';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

/** A claim that reads `readout` once the run has settled, judging nothing. */
const probe = (readout: string, params: Params): Claim => ({
  id: 'settle', statement: `the ${readout} readout once settled`, readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params },
});

/** Reads `readout` of plate `id` at the claims instrument's settle, failing on any reason. */
async function settled(id: string, readout: string, params: Params): Promise<string> {
  const r = await read(id, probe(readout, params));
  expect(r.reason, `${id} ${JSON.stringify(params)}`).toBeUndefined();
  return r.text as string;
}

/** Plate `id` mounted headless (drawing stubbed) at `width`, its defaults overridden. */
async function mount(id: string, over: Params, drop: string[] = [], width = 800) {
  const plate = (await loadPlate(id)) as Plate;
  const params: Params = { ...defaults(plate), ...over };
  for (const k of drop) delete params[k];
  let rows: Stat[] = [];
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width, height: Math.round(width / plate.aspect), params, seed: DEFAULT_SEED,
    rnd: mulberry32(DEFAULT_SEED),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  return {
    params,
    frame(): Record<string, string> {
      sim.draw();
      return Object.fromEntries(rows.map((r) => [r.label, r.value]));
    },
  };
}

/** The readouts of `id` frame by frame, without the settle row. */
async function trace(id: string, over: Params, frames: number, drop: string[] = []) {
  const m = await mount(id, over, drop);
  const out: Record<string, string>[] = [];
  for (let f = 0; f < frames; f++) {
    const { [COMPLETED_RUNS]: _, ...rest } = m.frame();
    out.push(rest);
  }
  return out;
}

/**
 * The checks every stream plate passes: its `runs` control is the shared one in its unit, 0 by
 * default, and survives the URL; and the stop is inert until it is reached, so a run with no
 * `runs` at all, one at 0 and one at the control's top (never reached here) read the same,
 * frame by frame: the default run is the one it was.
 */
function common(id: string, unit: string, max: number, frames: number) {
  it(`has the shared runs control in ${unit}, 0 by default, through the URL`, async () => {
    const plate = (await loadPlate(id)) as Plate;
    const d = plate.params.find((x) => x.key === RUNS_KEY);
    expect(d).toMatchObject({ ...runsParam({ unit, max }), hint: expect.any(String) });
    if (d?.kind !== 'range') return;
    expect(d.hint).toMatch(new RegExp(`^0: never stop\\. k: stop after k ${unit}`));
    const q = serialise(plate.params, { ...defaults(plate), [RUNS_KEY]: 7 }, 4242);
    expect(parse(plate.params, q).params[RUNS_KEY]).toBe(7);
  });

  it('is inert until reached: no runs, runs 0 and runs at its top read the same', async () => {
    const none = await trace(id, {}, frames, [RUNS_KEY]);
    expect(await trace(id, { [RUNS_KEY]: 0 }, frames)).toEqual(none);
    expect(await trace(id, { [RUNS_KEY]: max }, frames)).toEqual(none);
  });
}

describe('the stream form of the settle signal', () => {
  it('leaves the restarting plates\' control as it was', () => {
    expect(runsParam()).toEqual({
      kind: 'range', key: RUNS_KEY, label: 'Stop after runs', min: 0, max: 1000, step: 1, value: 0,
      hint: '0: never stop. k: hold the plate on its k-th completed run, '
        + 'so its readouts stay still.',
    });
  });

  it('is the same `runs` control, its label naming the unit of a run', () => {
    const d = runsParam({ unit: 'simulated s', max: 600 });
    expect(d).toMatchObject({
      kind: 'range', key: RUNS_KEY, label: 'Stop after (simulated s)', min: 0, max: 600, step: 1,
      value: 0,
    });
    expect(d.hint).toMatch(/^0: never stop\. k: stop after k simulated s/);
  });

  it('at 0, the default, never clamps a frame and counts the blocks run', () => {
    const params: Params = { [RUNS_KEY]: 0 };
    const s = new StreamStop(params, 10);
    for (let f = 0; f < 50; f++) {
      const n = s.allow(7);
      expect(n).toBe(7);
      s.advance(n);
    }
    expect(s.elapsed).toBe(350);
    expect(s.count).toBe(35);
    expect(s.stopped).toBe(false);
    expect(s.rows()).toEqual([{ label: COMPLETED_RUNS, value: '35' }]);
  });

  it('stops exactly on the k-th block whatever a frame asks, and holds it', () => {
    const params: Params = { [RUNS_KEY]: 3 };
    const s = new StreamStop(params, 10);
    const taken: number[] = [];
    for (let f = 0; f < 10; f++) {
      const n = s.allow(4);
      taken.push(n);
      s.advance(n);
    }
    // seven frames of 4 reach 28; the eighth would pass 30, so it is clamped to the 2 left
    expect(taken).toEqual([4, 4, 4, 4, 4, 4, 4, 2, 0, 0]);
    expect(s.elapsed).toBe(30);
    expect(s.stopped).toBe(true);
    expect(s.rows()).toEqual([{ label: COMPLETED_RUNS, value: '3 of 3, stopped' }]);
  });

  it('reads the limit live: raised, it runs on; it never allows more than a frame asks', () => {
    const params: Params = { [RUNS_KEY]: 1 };
    const s = new StreamStop(params, 5);
    s.advance(s.allow(9));
    expect(s.elapsed).toBe(5);
    expect(s.allow(9)).toBe(0);
    params[RUNS_KEY] = 4;
    expect(s.stopped).toBe(false);
    expect(s.allow(9)).toBe(9);
    expect(s.allow(30)).toBe(15);
    s.advance(15);
    expect(s.count).toBe(4);
    s.reset();
    expect(s.elapsed).toBe(0);
    expect(s.count).toBe(0);
  });

  it('shows the count as a restarting plate shows its completed runs: one signal', () => {
    for (const k of [0, 2, 5]) {
      const params: Params = { [RUNS_KEY]: k };
      const runs = new RunCounter(params);
      const blocks = new StreamStop(params, 3);
      for (let i = 0; i < 2; i++) {
        runs.complete('x');
        blocks.advance(blocks.allow(3));
      }
      const row = runs.rows().find((r) => r.label === COMPLETED_RUNS);
      expect(blocks.rows()).toEqual([row]);
      expect(blocks.rows().some((r) => r.label === LAST_COMPLETED_RUN)).toBe(false);
    }
  });
});

/** The fan's lower-arm spread after `steps` RK4 steps of `h` s each, replayed independently. */
function fanSpread(count: number, spread: number, thetaDeg: number, steps: [number, number][]) {
  const k: Pendulum = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 };
  const theta = (thetaDeg * Math.PI) / 180;
  let fan = Array.from({ length: count }, (_, i): State => {
    const u = count === 1 ? 0 : i / (count - 1) - 0.5;
    return [theta, theta + u * spread, 0, 0];
  });
  for (const [n, h] of steps) {
    for (let s = 0; s < n; s++) fan = fan.map((x) => pendulumStep(x, k, h));
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of fan) {
    const a = Math.atan2(Math.sin(x[1] - fan[0][1]), Math.cos(x[1] - fan[0][1]));
    lo = Math.min(lo, a);
    hi = Math.max(hi, a);
  }
  return `${(hi - lo).toExponential(2)} rad`;
}

describe('double-pendulum stops at a simulated second', () => {
  const fan = { count: 2, spread: '1e-4', theta: 120 };
  common('double-pendulum', 'simulated s', 1000, 120);

  it('settles at 10 s with dt 2 ms: 5000 steps, read exactly there', async () => {
    const p = { ...fan, [RUNS_KEY]: 10 };
    expect(await settled('double-pendulum', 'simulated time', p)).toBe('10.00 s');
    expect(await settled('double-pendulum', COMPLETED_RUNS, p)).toBe('10 of 10, stopped');
    expect(await settled('double-pendulum', 'lower-arm spread', p))
      .toBe(fanSpread(2, 1e-4, 120, [[5000, 0.002]]));
  });

  it('lands on the second when dt does not divide it: the last step is cut', async () => {
    // 6666 steps of 1.5 ms reach 9.999 s; a 6667th would pass 10 s, so it is cut to 1 ms
    const p = { ...fan, dt: 1.5, substeps: 7, [RUNS_KEY]: 10 };
    const exact = fanSpread(2, 1e-4, 120, [[6666, 0.0015], [1, 0.001]]);
    // the readout tells the exact stop from one step short of it and from one step past it
    expect(exact).not.toBe(fanSpread(2, 1e-4, 120, [[6666, 0.0015]]));
    expect(exact).not.toBe(fanSpread(2, 1e-4, 120, [[6667, 0.0015]]));
    expect(await settled('double-pendulum', 'lower-arm spread', p)).toBe(exact);
    expect(await settled('double-pendulum', 'simulated time', p)).toBe('10.00 s');
  });
});
