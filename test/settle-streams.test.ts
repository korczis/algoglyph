// The settle signal of a stream plate (src/plates/_shared/settle/settle.ts): an integrator or a
// cellular automaton never ends a run, so the claims instrument (ADR 0007) could not tell when
// to read it ("did not settle within 20000 frames"). The same `runs` control as the plates that
// restart stops it, counting a run as one block of the plate's own unit (a simulated second, a
// step, a generation); `completed runs` counts the blocks, and the plate's per-frame loop is
// clamped so that it stops exactly on the k-th block however many units a frame steps. At 0, the
// default, nothing is clamped: the default run is the one it was, checked within one run.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import {
  COMPLETED_RUNS, LAST_COMPLETED_RUN, RUNS_KEY, RunCounter, runsParam, StreamStop,
} from '../src/plates/_shared/settle/settle';

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
