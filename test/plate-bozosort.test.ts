// Bozosort's plate: the step-wise mirror against the wasm kernel (output, outcome, counters,
// step clock), the Markov-chain theory against a brute-force chain over every permutation and
// against many seeded runs, the inversion bookkeeping against recounting, the repair's bound,
// and the plate headless at every extreme setting.
import { describe, expect, it } from 'vitest';
import { calm } from '../src/core/pace';
import plate from '../src/plates/bozosort/plate';
import { bozoChain, bozoRun, countInversions, expectedSwaps, KERNEL_ATTEMPTS } from '../src/plates/bozosort/bozosort';
import { input, isSorted, runSeed } from '../src/plates/_shared/sort-input/input';
import { factorial, solve } from '../src/plates/_shared/theory/combinatorics';
import { extremes, headless, kernelRun, lead } from './support/esoteric';

/** The pace that runs `k` kernel steps a frame (the old speed select's values). */
const steps = (k: number) => k / calm('stream');

function permutationsOf(n: number): number[][] {
  if (n === 0) return [[]];
  return permutationsOf(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n, ...p.slice(i)]));
}

/** Expected swaps by brute force: the walk's chain over all n! arrangements, solved directly. */
function bruteHitting(n: number): Map<string, number> {
  const perms = permutationsOf(n);
  const at = new Map(perms.map((p, i) => [p.join(','), i]));
  const N = perms.length;
  const A = perms.map(() => new Array<number>(N).fill(0));
  const b = new Array<number>(N).fill(0);
  perms.forEach((p, r) => {
    A[r][r] += 1;
    if (isSorted(p)) return;
    b[r] = 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const q = p.slice();
        [q[i], q[j]] = [q[j], q[i]];
        A[r][at.get(q.join(','))!] -= 1 / (n * n);
      }
    }
  });
  const h = solve(A, b);
  return new Map(perms.map((p, i) => [p.join(','), h[i]]));
}

describe('bozosort mirror against the wasm kernel', () => {
  it('ends with the kernel\'s output, outcome and counts', () => {
    for (const shape of ['random', 'reversed', 'nearly-sorted', 'few-unique'] as const) {
      for (const n of [0, 1, 2, 4, 6]) {
        for (let k = 0; k < 5; k++) {
          const seed = runSeed(17, k * 13 + n);
          const keys = input(shape, n, seed);
          const r = bozoRun(keys, seed, 'any', KERNEL_ATTEMPTS);
          const outcome = r.stepper.finish();
          const w = kernelRun('bozosort', keys, seed);
          expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
          expect(r.keys).toEqual(Array.from(w.output));
          const c = r.stepper.t.counts;
          expect([c.cmp, c.swap, c.write, c.read]).toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
          expect(r.stepper.t.steps).toBe(w.counted);
        }
      }
    }
  });

  it('stops where the kernel stops at a step limit', () => {
    const keys = input('reversed', 8, 2);
    const r = bozoRun(keys, 2, 'any', KERNEL_ATTEMPTS, 500);
    const w = kernelRun('bozosort', keys, 2, 500);
    expect(r.stepper.finish()).toBe(w.outcome);
    expect(r.stepper.t.steps).toBe(w.counted);
  });
});

describe('bozosort theory', () => {
  it('the cycle-type chain equals the brute-force chain on every permutation of 3 and 4', () => {
    for (const n of [3, 4]) {
      const brute = bruteHitting(n);
      for (const p of permutationsOf(n)) expect(expectedSwaps(p), p.join(',')).toBeCloseTo(brute.get(p.join(','))!, 8);
    }
    expect(expectedSwaps([1, 2, 3])).toBe(0);
    expect(bozoChain(2).get('2')).toBeCloseTo(2, 12); // a two-cycle: each step fixes it with p = 1/2
  });

  it('the measured mean swaps of many runs agrees with the chain within four standard errors', () => {
    const xs: number[] = [];
    let expected = 0;
    for (let k = 0; k < 500; k++) {
      const seed = runSeed(23, k);
      const keys = input('random', 4, seed);
      const r = bozoRun(keys, seed);
      expect(r.stepper.finish()).toBe('sorted');
      xs.push(r.state.swaps);
      expected += expectedSwaps(keys);
    }
    expected /= xs.length;
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
    expect(Math.abs(mean - expected)).toBeLessThan(4 * sd / Math.sqrt(xs.length));
    // the walk's expectation is of order n!, as the analysis says
    expect(expected).toBeGreaterThan(factorial(4) / 2);
  });

  it('the inversion bookkeeping equals a recount after every run', () => {
    for (let k = 0; k < 40; k++) {
      const seed = runSeed(29, k);
      const keys = input('random', 6, seed);
      const r = bozoRun(keys, seed);
      r.stepper.finish();
      expect(r.state.inversions).toBe(countInversions(r.keys));
      expect(r.state.inversions).toBe(0);
      expect(r.state.better + r.state.worse + r.state.idle).toBe(r.state.swaps);
    }
  });

  it('the repair sorts with at most as many swaps as the input has inversions', () => {
    for (let k = 0; k < 40; k++) {
      const seed = runSeed(31, k);
      const keys = input('random', 8, seed);
      const r = bozoRun(keys, seed, 'inversion');
      expect(r.stepper.finish()).toBe('sorted');
      expect(isSorted(r.keys)).toBe(true);
      expect(r.state.swaps).toBeLessThanOrEqual(countInversions(keys));
      expect(r.state.worse).toBe(0);
    }
  });
});

describe('bozosort plate', () => {
  it('runs headless at every extreme setting', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, { pace: steps(16384), ...params });
      h.frames(60);
      expect(Object.keys(h.stats()).length, JSON.stringify(params)).toBeGreaterThan(5);
    }
  });

  it('finishes runs at the old default of 16 steps a frame and charts their mean against the chain', () => {
    // the old default speed: the calm default (ADR 0008) finishes a run every few seconds
    const h = headless(plate, { pace: steps(16) });
    h.frames(2400);
    const runs = lead(h.stats()['completed runs']);
    expect(runs).toBeGreaterThan(5);
    const c = h.chart()!;
    const [m, e] = c.series;
    let sum = 0;
    let exp = 0;
    for (let k = 0; k < runs; k++) {
      const seed = runSeed(4242, k);
      const keys = input('random', 5, seed);
      const r = bozoRun(keys, seed);
      r.stepper.finish();
      sum += r.state.swaps;
      exp += expectedSwaps(keys);
    }
    expect(m.points[m.points.length - 1]).toEqual([runs, expect.closeTo(sum / runs, 9)]);
    expect(e.points[e.points.length - 1][1]).toBeCloseTo(exp / runs, 9);
  });
});
