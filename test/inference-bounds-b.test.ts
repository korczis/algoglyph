// Every exact count the inference wing's second half states in a bound (catalogue/entries/*.md,
// ADR 0006 §4), driven at several settings and compared with what the kernel counts as
// evaluations. Asymptotic bounds (pareto-front's O(n log n) comparisons) are not checked here.
import { describe, expect, it } from 'vitest';
import { trace } from '../src/engines/stochastic/trace';
import { kernel as shapley } from '../src/kernels/stochastic/shapley-values';
import { kernel as sobol } from '../src/kernels/stochastic/sobol-indices';
import { kernel as tornado, NAMES } from '../src/kernels/stochastic/tornado-sensitivity';

describe('inference (b): exact bounds against counted runs', () => {
  it('shapley-values: 2ᵈ + m(d + 1) model evaluations', () => {
    for (const d of [2, 3, 5, 6]) {
      for (const m of [20, 200, 600]) {
        for (const seed of [1, 4242]) {
          expect(trace(shapley, { d, m }, seed).evals).toBe(2 ** d + m * (d + 1));
        }
      }
    }
  });

  it('sobol-indices: N(d + 2) model evaluations, d = 3 (Ishigami) or 4 (additive)', () => {
    for (const [model, d] of [['ishigami', 3], ['additive', 4]] as const) {
      for (const n of [200, 1000, 4000]) {
        for (const seed of [1, 4242]) {
          expect(trace(sobol, { model, n }, seed).evals).toBe(n * (d + 2));
        }
      }
    }
  });

  it('tornado-sensitivity: 13d + 1 + n model evaluations for d inputs and n joint runs', () => {
    const d = NAMES.length;
    for (const n of [500, 2000, 8000]) {
      for (const seed of [1, 4242]) {
        // 1 base case, 2d swings, 11d spider-plot points, n joint Monte Carlo runs
        expect(trace(tornado, { n }, seed).evals).toBe(13 * d + 1 + n);
      }
    }
  });
});
