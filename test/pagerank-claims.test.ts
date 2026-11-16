// Where pagerank's claims get their figures (catalogue/entries/pagerank.md, read on the plate by
// test/claims.test.ts and here). The fixed point is one linear solve by Gaussian elimination
// (test/support/analysis-oracles.ts), never the power iteration the plate runs; the bounds are
// derived below for the plate's own variant; the graph is the plate's input at the claim's seed.
import { expect } from 'vitest';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as pagerank } from '../src/kernels/graph/pagerank';
import {
  claimsAgainst, graphAt, pagerankSolve, paramsOf, roundingMargin, seedsOf, top, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'pagerank';
const kernel = pagerank as GraphKernel;
/** The plate's stop rule (src/kernels/graph/_pagerank.ts) and its round cap. */
const TOL = 1e-12;
const CAP = 1000;

/** The scores are a probability vector in every round: a conserved quantity, printed to six
 * decimals, so 1 ± 1e-6 holds whatever the input and the damping. */
const sumsToOne: Check = (c) => {
  expect(c.expect, c.id).toEqual({ number: 2, value: 1, tolerance: 1e-6 });
};

/**
 * Rounds at most ⌈ln(TOL / 2) / ln d⌉. The round maps r to G r = (1 − d) t + d S r, where S moves
 * each score evenly along its out-edges (both ways when undirected) and a dangling vertex's along
 * the teleport vector t: S is column-stochastic, so on a zero-sum vector z, G z = d S z and
 * ‖S z‖₁ ≤ ‖z‖₁. The changes Δ_k = r_k − r_(k−1) are zero-sum, so ‖Δ_(k+1)‖₁ ≤ d ‖Δ_k‖₁; the first,
 * Δ_1 = G t − t = d (S t − t), is a difference of two probability vectors times d, at most 2d. So
 * round k changes the scores by at most 2 d^k, and the run stops at the first round whose change
 * is below TOL: by the first k with 2 d^k < TOL, which is ⌈ln(TOL / 2) / ln d⌉ whenever that ratio
 * is not an integer, and below the round cap. The claim's range is [1, that k].
 */
const roundsBound: Check = (c) => {
  const d = Number(paramsOf(kernel, c).damping);
  const k = Math.ceil(Math.log(TOL / 2) / Math.log(d));
  expect(2 * d ** k, `${c.id}: round ${k} is below the stop rule`).toBeLessThan(TOL);
  expect(k).toBeLessThan(CAP);
  expect(c.expect, c.id).toEqual({ range: [1, k] });
};

/**
 * The highest-ranked vertex and its score, from the solve. The plate stops with a last change
 * below TOL, so by the contraction above its scores lie within TOL · d / (1 − d) of the fixed
 * point in L1: the vertex must lead the runner-up by more than twice that, and the score printed
 * to four decimals must sit farther than that from a rounding boundary, for the literal to be
 * the solve's own.
 */
const highest = (number: 1 | 2): Check => (c) => {
  for (const seed of seedsOf(c)) {
    const g = graphAt(kernel, c, seed);
    const d = Number(paramsOf(kernel, c).damping);
    const err = (TOL * d) / (1 - d);
    const t = top(pagerankSolve(g, d, new Array<number>(g.n).fill(1 / g.n)));
    expect(t.gap, `${c.id}: the leader is clear`).toBeGreaterThan(2 * err);
    if (number === 1) {
      expect(c.expect, c.id).toEqual({ value: t.v });
    } else {
      expect(roundingMargin(t.value, 4), `${c.id}: away from a rounding boundary`).toBeGreaterThan(err);
      expect(c.expect, c.id).toEqual({ number: 2, value: Number(t.value.toFixed(4)) });
    }
  }
};

const checks: Record<string, Check> = {
  'scores-sum-to-one': sumsToOne,
  'scores-sum-to-one-at-low-damping': sumsToOne,
  'scores-sum-to-one-at-high-damping': sumsToOne,
  'rounds-within-the-contraction-bound': roundsBound,
  'rounds-within-the-contraction-bound-at-low-damping': roundsBound,
  'rounds-within-the-contraction-bound-at-high-damping': roundsBound,
  'highest-rank-is-the-linear-solve': highest(1),
  'highest-score-is-the-linear-solve': highest(2),
  'highest-rank-is-the-linear-solve-at-seed-7': highest(1),
  'highest-score-is-the-linear-solve-at-seed-7': highest(2),
};

claimsAgainst(ID, checks);
