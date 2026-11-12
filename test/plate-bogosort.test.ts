// Bogosort's plate: its step-wise mirror ends exactly where the wasm kernel ends (output,
// outcome, every counter and the step clock) for the same seed and input, its theory is the
// geometric mean the definition gives, and the plate runs headless at every extreme setting with
// readouts that equal independently counted values.
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/bogosort/plate';
import { bogoRun, expectedShuffles, KERNEL_ATTEMPTS } from '../src/plates/bogosort/bogosort';
import { input, isSorted, runSeed } from '../src/plates/_shared/sort-input/input';
import { factorial } from '../src/plates/_shared/theory/combinatorics';
import { extremes, headless, kernelRun, lead } from './support/esoteric';

const sorted = (a: readonly number[]) => [...a].sort((x, y) => x - y);

describe('bogosort mirror against the wasm kernel', () => {
  it('ends with the kernel\'s output, outcome and counts, for many seeds and shapes', () => {
    let finished = 0;
    for (const shape of ['random', 'reversed', 'few-unique', 'sorted'] as const) {
      for (const n of [0, 1, 2, 3, 5, 7]) {
        for (let k = 0; k < 6; k++) {
          const seed = runSeed(11, k * 31 + n);
          const keys = input(shape, n, seed);
          const r = bogoRun(keys, seed, KERNEL_ATTEMPTS);
          const outcome = r.stepper.finish();
          const w = kernelRun('bogosort', keys, seed);
          expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
          expect(r.keys).toEqual(Array.from(w.output));
          const c = r.stepper.t.counts;
          expect({ cmp: c.cmp, swap: c.swap, write: c.write, read: c.read })
            .toEqual({ cmp: w.counts.cmp, swap: w.counts.swap, write: w.counts.write, read: w.counts.read });
          expect(r.stepper.t.steps).toBe(w.counted);
          if (outcome === 'sorted') finished++;
        }
      }
    }
    expect(finished).toBeGreaterThan(50);
  });

  it('gives up exactly as the kernel does at its shuffle and step limits', () => {
    const keys = input('reversed', 9, 3);
    const r = bogoRun(keys, 3, KERNEL_ATTEMPTS);
    expect(r.stepper.finish()).toBe('truncated');
    const w = kernelRun('bogosort', keys, 3);
    expect(w.outcome).toBe('truncated');
    expect(r.stepper.t.counts.swap).toBe(w.counts.swap);
    expect(r.state.shuffles).toBe(KERNEL_ATTEMPTS);
    const short = bogoRun(keys, 5, KERNEL_ATTEMPTS, 200);
    const ws = kernelRun('bogosort', keys, 5, 200);
    expect(short.stepper.finish()).toBe(ws.outcome);
    expect(short.stepper.t.steps).toBe(ws.counted);
  });
});

describe('bogosort theory', () => {
  it('expects n! shuffles on an unsorted permutation, fewer with repeated keys, none when sorted', () => {
    expect(expectedShuffles([3, 1, 2, 4])).toBe(factorial(4));
    expect(expectedShuffles([1, 2, 3])).toBe(0);
    expect(expectedShuffles([2, 1, 1, 2])).toBe(6); // 4!/(2!·2!)
  });

  it('the measured mean of many uncapped runs agrees with n! within four standard errors', () => {
    const xs: number[] = [];
    for (let k = 0; k < 600; k++) {
      const seed = runSeed(5, k);
      const r = bogoRun(input('random', 4, seed), seed);
      expect(r.stepper.finish()).toBe('sorted');
      expect(isSorted(r.keys)).toBe(true);
      xs.push(r.state.shuffles);
    }
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
    // a random start is already sorted with probability 1/24, so the mean is 24 − 1
    expect(Math.abs(mean - 23)).toBeLessThan(4 * sd / Math.sqrt(xs.length));
  });
});

describe('bogosort plate', () => {
  it('runs headless at every extreme setting and its readouts are counted', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, { ...params, speed: params.speed ?? '16384' });
      h.frames(60);
      const s = h.stats();
      expect(Object.keys(s).length, JSON.stringify(params)).toBeGreaterThan(4);
      expect(lead(s['finished runs'])).toBeGreaterThanOrEqual(0);
    }
  });

  it('finishes runs at its defaults, each sorted, and charts measured against expected', () => {
    const h = headless(plate);
    h.frames(2400);
    const s = h.stats();
    const runs = lead(s['finished runs']);
    expect(runs).toBeGreaterThan(5);
    const c = h.chart()!;
    expect(c.series.map((x) => x.name)).toEqual(['mean shuffles per run (measured)', 'expected n!/Πmᵢ! per unsorted input']);
    const measured = c.series[0].points;
    expect(measured[measured.length - 1][0]).toBe(runs);
    // the plate's mean equals the mean of the same runs replayed independently
    const n = 5;
    let sum = 0;
    for (let k = 0; k < runs; k++) {
      const seed = runSeed(4242, k);
      const keys = input('random', n, seed);
      const r = bogoRun(keys, seed);
      r.stepper.finish();
      expect(r.keys).toEqual(sorted(keys));
      sum += r.state.shuffles;
    }
    expect(measured[measured.length - 1][1]).toBeCloseTo(sum / runs, 9);
  });
});
