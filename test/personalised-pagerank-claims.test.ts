// Where personalised-pagerank's claims get their figures (catalogue/entries/personalised-pagerank.md,
// read on the plate by test/claims.test.ts and here). The fixed point is one linear solve by
// Gaussian elimination with the subject as the teleport vector (test/support/analysis-oracles.ts),
// never the power iteration the plate runs; the bounds are derived below; the graph is the
// plate's input at the claim's seed, the subject its suggested source g.s.
import { expect } from 'vitest';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as ppr } from '../src/kernels/graph/personalised-pagerank';
import {
  claimsAgainst, graphAt, pagerankSolve, paramsOf, roundingMargin, seedsOf, top, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'personalised-pagerank';
const kernel = ppr as GraphKernel;
/** The plate's stop rule and round cap (src/kernels/graph/_pagerank.ts). */
const TOL = 1e-12;
const CAP = 1000;

const solved = (c: Parameters<Check>[0], seed: number) => {
  const g = graphAt(kernel, c, seed);
  const d = Number(paramsOf(kernel, c).damping);
  const tele = new Array<number>(g.n).fill(0);
  tele[g.s] = 1;
  return { g, d, x: pagerankSolve(g, d, tele), err: (TOL * d) / (1 - d) };
};

/** The scores stay a probability vector (as on pagerank): their sum is 1 within 1e-6. */
const sumsToOne: Check = (c) => {
  expect(c.expect, c.id).toEqual({ number: 2, value: 1, tolerance: 1e-6 });
};

/**
 * The subject keeps what it teleports to itself. Its score is x_s = (1 − d) + d·(what flows back
 * to it along edges, and from dangling vertices along the teleport vector), all of it
 * non-negative, so x_s ≥ 1 − d; the scores are non-negative and sum to one, so x_s ≤ 1. Printed to
 * four decimals, rounding keeps both ends: the range is [1 − d, 1].
 */
const subjectBound: Check = (c) => {
  const d = Number(paramsOf(kernel, c).damping);
  expect(c.expect, c.id).toEqual({ range: [Number((1 - d).toFixed(4)), 1] });
  for (const seed of seedsOf(c)) {
    const { g, x } = solved(c, seed);
    expect(x[g.s]).toBeGreaterThanOrEqual(1 - d - 1e-12);
    expect(x[g.s]).toBeLessThanOrEqual(1 + 1e-12);
  }
};

/** The subject's own score, from the solve, to the four decimals printed. */
const subjectSolve: Check = (c) => {
  for (const seed of seedsOf(c)) {
    const { g, x, err } = solved(c, seed);
    expect(roundingMargin(x[g.s], 4)).toBeGreaterThan(err);
    expect(c.expect, c.id).toEqual({ value: Number(x[g.s].toFixed(4)) });
  }
};

/** The rounds bound of pagerank's claims, derived there (test/pagerank-claims.test.ts) for any
 * teleport vector: the first change is d (S t − t), at most 2d, and each later one at most d
 * times the one before, so the run stops by the first k with 2 d^k below 1e-12. */
const roundsBound: Check = (c) => {
  const d = Number(paramsOf(kernel, c).damping);
  const k = Math.ceil(Math.log(TOL / 2) / Math.log(d));
  expect(2 * d ** k).toBeLessThan(TOL);
  expect(k).toBeLessThan(CAP);
  expect(c.expect, c.id).toEqual({ range: [1, k] });
};

/** The vertex closest to the subject (the subject excluded) and its score, from the solve, with
 * the margins the stopped iteration needs (as on pagerank). */
const closest = (number: 1 | 2): Check => (c) => {
  for (const seed of seedsOf(c)) {
    const { g, x, err } = solved(c, seed);
    const t = top(x, g.s);
    expect(t.gap).toBeGreaterThan(2 * err);
    if (number === 1) expect(c.expect, c.id).toEqual({ value: t.v });
    else {
      expect(roundingMargin(t.value, 4)).toBeGreaterThan(err);
      expect(c.expect, c.id).toEqual({ number: 2, value: Number(t.value.toFixed(4)) });
    }
  }
};

claimsAgainst(ID, {
  'scores-sum-to-one': sumsToOne,
  'subject-keeps-its-restart-share': subjectBound,
  'subject-keeps-its-restart-share-at-half-damping': subjectBound,
  'subject-keeps-its-restart-share-on-the-digraph': subjectBound,
  'subject-score-is-the-linear-solve': subjectSolve,
  'rounds-within-the-contraction-bound': roundsBound,
  'closest-is-the-linear-solve': closest(1),
  'closest-score-is-the-linear-solve': closest(2),
  'closest-is-the-linear-solve-at-seed-7': closest(1),
  'closest-score-is-the-linear-solve-at-seed-7': closest(2),
});
