// The shared test of the scaling plates (stooge sort, slowsort): the explicit-stack mirror
// against the wasm kernel on every shape and many sizes, at a step limit too; the exact
// recurrence against the kernel's own counts; and the plate run headless, its readouts and chart
// against independently counted values. Each plate's own test file calls it.
import { expect, it } from 'vitest';
import type { PlateCode } from '../../src/core/plate';
import type { ScalingRun } from '../../src/plates/_shared/scaling-plate/scaling-plate';
import { sortingNow } from '../../src/plates/_shared/kernel-mirror/wasm';
import { input, isSorted, runSeed, SHAPES } from '../../src/plates/_shared/sort-input/input';
import { extremes, headless, kernelRun, lead } from './esoteric';
import { calm } from '../../src/core/pace';

export interface Subject {
  kernel: string;
  plate: PlateCode;
  run(keys: readonly number[], seed?: number, maxSteps?: number): ScalingRun;
  recurrence(n: number): number;
  sizes: number[];
  /** The largest n whose full run the test replays. */
  replayMax: number;
}

export function scalingSuite(s: Subject): void {
  it('the mirror ends with the kernel\'s output, outcome and counts on every shape', () => {
    for (const shape of SHAPES) {
      for (const n of s.sizes) {
        const seed = runSeed(3, n);
        const keys = input(shape, n, seed);
        const r = s.run(keys, seed);
        const outcome = r.stepper.finish();
        const w = kernelRun(s.kernel, keys, seed);
        expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
        expect(outcome).toBe('sorted');
        expect(r.keys).toEqual(Array.from(w.output));
        expect(r.keys).toEqual([...keys].sort((a, b) => a - b));
        const c = r.stepper.t.counts;
        expect([c.cmp, c.swap, c.write, c.read]).toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
        expect(r.stepper.t.steps).toBe(w.counted);
        expect(r.calls.pending).toEqual([]);
      }
    }
  });

  it('stops exactly where the kernel stops at a step limit', () => {
    for (const limit of [1, 50, 999]) {
      const keys = input('random', 40, 9);
      const r = s.run(keys, 9, limit);
      const w = kernelRun(s.kernel, keys, 9, limit);
      expect(r.stepper.finish()).toBe(w.outcome);
      expect(w.outcome).toBe('truncated');
      expect(r.stepper.t.steps).toBe(w.counted);
      expect(r.stepper.t.counts.cmp).toBe(w.counts.cmp);
    }
  });

  it('the exact recurrence equals the kernel\'s comparisons for every n, whatever the input', () => {
    for (let n = 0; n <= Math.max(...s.sizes); n++) {
      for (const shape of ['random', 'sorted', 'reversed'] as const) {
        expect(kernelRun(s.kernel, input(shape, n, n), 1).counts.cmp, `n=${n} ${shape}`).toBe(s.recurrence(n));
      }
    }
  });

  it('the plate runs headless at every extreme setting', async () => {
    sortingNow();
    await new Promise((r) => setTimeout(r, 0));
    for (const params of extremes(s.plate)) {
      const h = headless(s.plate, { pace: 16384 / calm('stream'), ...params });
      h.frames(40);
      const st = h.stats();
      expect(lead(st['comparisons, counted live']), JSON.stringify(params)).toBeGreaterThan(0);
    }
  });

  it('counts live up to the recurrence, verifies the result and charts the kernel\'s sweep', async () => {
    sortingNow();
    await new Promise((r) => setTimeout(r, 0));
    const n = s.replayMax;
    const h = headless(s.plate, { n, pace: 16384 / calm('stream') });
    // run 1 to its end: its readouts are the kernel's counts on the same input
    for (let f = 0; f < 4000 && !h.stats().result; f++) h.frames(1);
    const st = h.stats();
    expect(st.result).toBe('ascending, verified');
    const keys = input('random', n, runSeed(4242, 0));
    const w = kernelRun(s.kernel, keys, runSeed(4242, 0));
    expect(lead(st['comparisons, counted live'])).toBe(s.recurrence(n));
    expect(lead(st['swaps, counted live'])).toBe(w.counts.swap);
    expect(st['kernel (wasm) on this input']).toBe(`${w.counts.cmp.toLocaleString('en-US')} comparisons, ${w.counts.swap.toLocaleString('en-US')} swaps`);
    const r = s.run(keys);
    r.stepper.finish();
    expect(isSorted(r.keys)).toBe(true);
    h.frames(n + 4);
    const chart = h.chart()!;
    const kernel = chart.series.find((x) => x.name.includes('kernel (wasm)'))!;
    expect(kernel.points.length).toBeGreaterThan(Math.min(n, 20) - 3);
    for (const [m, cmp] of kernel.points) expect(cmp).toBe(s.recurrence(m));
    const theory = chart.series.find((x) => x.name.startsWith('exact recurrence'))!;
    expect(theory.points[theory.points.length - 1]).toEqual([n, s.recurrence(n)]);
  });
}
