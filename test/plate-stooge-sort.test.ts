// Stooge sort's plate against the wasm kernel and its recurrence (test/support/scaling.ts), and
// the master theorem's exponent as the limit of the recurrence's growth.
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/stooge-sort/plate';
import { STOOGE_EXPONENT, stoogeComparisons, stoogeRun } from '../src/plates/stooge-sort/stooge';
import { scalingSuite } from './support/scaling';

describe('stooge sort plate', () => {
  scalingSuite({
    kernel: 'stooge-sort', plate, run: stoogeRun, recurrence: stoogeComparisons,
    sizes: [0, 1, 2, 3, 4, 7, 16, 27, 50], replayMax: 30,
  });

  it('grows as n^(log 3 / log 1.5): the count triples whenever n grows by half', () => {
    expect(STOOGE_EXPONENT).toBeCloseTo(2.7095, 4);
    // for even n, 1.5n keys split into calls on exactly n keys, so C(1.5n) = 3·C(n) + 1
    for (const n of [4, 6, 64, 96, 144, 216, 324, 486]) {
      expect(stoogeComparisons(1.5 * n)).toBe(3 * stoogeComparisons(n) + 1);
    }
    // 64 · 1.5^6 = 729: six such steps multiply the count by about 3^6
    const ratio = Math.log(stoogeComparisons(729) / stoogeComparisons(64)) / Math.log(729 / 64);
    expect(ratio).toBeCloseTo(STOOGE_EXPONENT, 2);
  });
});
