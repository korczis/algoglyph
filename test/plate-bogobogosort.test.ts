// Bogobogosort's plate: the step-wise mirror against the wasm kernel, the derived expectation
// against brute-force averaging over every input and against many seeded runs, and the plate
// headless at every extreme setting.
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/bogobogosort/plate';
import { bbsRun, expectedShuffles, KERNEL_SHUFFLES } from '../src/plates/bogobogosort/bogobogosort';
import { input, isSorted, runSeed } from '../src/plates/_shared/sort-input/input';
import { factorial } from '../src/plates/_shared/theory/combinatorics';
import { extremes, headless, kernelRun, lead } from './support/esoteric';

function permutationsOf(n: number): number[][] {
  if (n === 0) return [[]];
  return permutationsOf(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n, ...p.slice(i)]));
}

describe('bogobogosort mirror against the wasm kernel', () => {
  it('ends with the kernel\'s output, outcome and counts', () => {
    for (const shape of ['random', 'reversed', 'few-unique', 'sorted'] as const) {
      for (const n of [0, 1, 2, 3, 5, 7]) {
        for (let k = 0; k < 5; k++) {
          const seed = runSeed(41, k * 7 + n);
          const keys = input(shape, n, seed);
          const r = bbsRun(keys, seed, KERNEL_SHUFFLES);
          const outcome = r.stepper.finish();
          const w = kernelRun('bogobogosort', keys, seed);
          expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
          expect(r.keys).toEqual(Array.from(w.output));
          const c = r.stepper.t.counts;
          expect([c.cmp, c.swap, c.write, c.read]).toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
          expect(r.stepper.t.steps).toBe(w.counted);
        }
      }
    }
  });

  it('gives up where the kernel gives up', () => {
    const keys = input('reversed', 9, 8);
    const r = bbsRun(keys, 8, KERNEL_SHUFFLES);
    expect(r.stepper.finish()).toBe('truncated');
    expect(kernelRun('bogobogosort', keys, 8).outcome).toBe('truncated');
    expect(r.state.shuffles).toBe(KERNEL_SHUFFLES);
  });
});

describe('bogobogosort theory', () => {
  it('averaged over every input of n distinct keys it expects n! − 1 shuffles', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const all = permutationsOf(n);
      const mean = all.reduce((s, p) => s + expectedShuffles(p), 0) / all.length;
      expect(mean).toBeCloseTo(factorial(n) - 1, 9);
    }
    expect(expectedShuffles([1, 2, 3, 4])).toBe(0);
    expect(expectedShuffles([2, 1])).toBe(2);
  });

  it('the mean of many runs on one input agrees with its expectation within four standard errors', () => {
    for (const keys of [[3, 1, 2, 4], [4, 3, 2, 1], [1, 2, 4, 3]]) {
      const xs: number[] = [];
      for (let k = 0; k < 500; k++) {
        const r = bbsRun(keys, runSeed(43, k));
        expect(r.stepper.finish()).toBe('sorted');
        expect(isSorted(r.keys)).toBe(true);
        expect(r.state.level.reduce((s, x) => s + x, 0)).toBe(r.state.shuffles);
        xs.push(r.state.shuffles);
      }
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
      expect(Math.abs(mean - expectedShuffles(keys)), keys.join(',')).toBeLessThan(4 * sd / Math.sqrt(xs.length));
    }
  });
});

describe('bogobogosort plate', () => {
  it('runs headless at every extreme setting', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, { speed: '16384', ...params });
      h.frames(60);
      expect(Object.keys(h.stats()).length, JSON.stringify(params)).toBeGreaterThan(5);
    }
  });

  it('finishes runs at its defaults, the chart\'s mean equals the same runs replayed', () => {
    const h = headless(plate);
    h.frames(2400);
    const runs = lead(h.stats()['finished runs']);
    expect(runs).toBeGreaterThan(5);
    const [m, e] = h.chart()!.series;
    let sum = 0;
    let exp = 0;
    for (let k = 0; k < runs; k++) {
      const seed = runSeed(4242, k);
      const keys = input('random', 5, seed);
      const r = bbsRun(keys, seed);
      r.stepper.finish();
      sum += r.state.shuffles;
      exp += expectedShuffles(keys);
    }
    expect(m.points[m.points.length - 1][1]).toBeCloseTo(sum / runs, 9);
    expect(e.points[e.points.length - 1][1]).toBeCloseTo(exp / runs, 9);
  });
});
