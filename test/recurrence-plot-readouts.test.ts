// recurrence-plot (catalogue/entries/recurrence-plot.md): "ε is set so that the chosen share of
// pairs recur". The threshold is the k-th smallest pair distance, k = floor(rate·M) of the
// M = n(n − 1)/2 pairs, so at least k pairs recur: every pair at or below the k-th distance. The
// plate once took ε as the square root of the k-th squared distance and compared each squared
// distance with ε², which rounds below it and drops pairs tied with the k-th (seed 7 `regime`:
// 3550 of 3588). Counted from the matrix the plate draws, never from its rounded readout.
import { describe, expect, it } from 'vitest';
import { kernel } from '../src/kernels/numeric/recurrence-plot';

const SERIES = ['regime', 'sine', 'logistic', 'lorenz', 'noise'];
const SEEDS = [4242, 7, 1, 2, 3];

/** The recurrent pairs (i < j) of the matrix the plate draws at the end of its run. */
function drawn(params: Record<string, string | number>, seed: number): { pairs: number; M: number } {
  const run = kernel.run({ seed, params } as never);
  const grid = run.steps[run.steps.length - 1].layers[0] as unknown as { kind: string; values: Float64Array; rows: number };
  expect(grid.kind).toBe('grid');
  const n = grid.rows;
  let pairs = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (grid.values[i * n + j] > 0) pairs++;
  return { pairs, M: (n * (n - 1)) / 2 };
}

describe('recurrence-plot: the threshold keeps every pair tied with the k-th distance', () => {
  for (const rate of [2, 8, 20]) {
    it(`at a ${rate}% target at least floor(rate·M) pairs recur, for every series and seed`, () => {
      for (const series of SERIES) for (const seed of SEEDS) {
        const { pairs, M } = drawn({ series, rate }, seed);
        expect(pairs, `${series} seed ${seed}: ${pairs} recurrent pairs of ${M}`).toBeGreaterThanOrEqual(Math.floor((rate / 100) * M));
      }
    });
  }
});
