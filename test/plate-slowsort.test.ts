// Slowsort's plate against the wasm kernel and its recurrence (test/support/scaling.ts), its
// growth faster than any fixed power, and Broder and Stolfi's observation that it never adds an
// inversion.
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/slowsort/plate';
import { slowComparisons, slowRun } from '../src/plates/slowsort/slowsort';
import { input, inversions } from '../src/plates/_shared/sort-input/input';
import { items, Stepper, Tracer } from '../src/plates/_shared/kernel-mirror/tracer';
import { slowsort } from '../src/plates/slowsort/slowsort';
import { scalingSuite } from './support/scaling';

describe('slowsort plate', () => {
  scalingSuite({
    kernel: 'slowsort', plate, run: slowRun, recurrence: slowComparisons,
    sizes: [0, 1, 2, 3, 5, 8, 17, 32, 45], replayMax: 24,
  });

  it('the local exponent keeps rising: no fixed power of n bounds it', () => {
    const local = (n: number) => Math.log(slowComparisons(2 * n) / slowComparisons(n)) / Math.log(2);
    const seq = [8, 16, 32, 64, 128, 256].map(local);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    expect(slowComparisons(128)).toBeGreaterThan(1e6);
  });

  it('never increases the number of inversions', () => {
    const keys = input('random', 20, 5);
    const t = new Tracer(0);
    const a = items(keys);
    const c = { i: 0, j: -1, depth: 0, maxDepth: 0, pending: [] as number[] };
    const s = new Stepper(slowsort(t, a, c), t);
    let inv = inversions(a.key);
    while (!s.done) {
      s.advance(1);
      const now = inversions(a.key);
      expect(now).toBeLessThanOrEqual(inv);
      inv = now;
    }
    expect(inv).toBe(0);
  });
});
