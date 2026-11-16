// Where effective-ownership's claims get their figures (catalogue/entries/effective-ownership.md,
// read on the plate by test/claims.test.ts and here). The effective shares are one linear solve by
// Gaussian elimination (test/support/analysis-oracles.ts), never the rounds the plate iterates;
// the longest ownership chain is a longest-path recursion over Kahn's order of the acyclic input;
// the graph is the plate's input at the claim's seed, the target its suggested g.t.
import { expect } from 'vitest';
import type { Claim } from '../src/core/claims';
import type { Graph } from '../src/engines/graph/graph';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as ownership } from '../src/kernels/graph/effective-ownership';
import {
  claimsAgainst, graphAt, roundingMargin, seedsOf, solve, top, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'effective-ownership';
const kernel = ownership as GraphKernel;
/** The plate's stop rule: no share moves by this much in a round. */
const STOP = 1e-12;

/** The holdings' largest column sum: the most of one company its holders own together. */
const mostHeld = (g: Graph) => {
  const into = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) into[g.ev[e]] += g.w[e];
  return Math.max(...into);
};

/**
 * e = W e + e_t outside the target, e(t) = 1: (I − W') e = e_t with W' the holdings minus the
 * target's own (the plate never scans them). The plate iterates z ↦ W' z on the changes; with no
 * company held above c < 1 in all (the largest column sum), ‖W' z‖₁ ≤ c ‖z‖₁, so its last change
 * below 1e-12 in every entry leaves it within n · 1e-12 · c / (1 − c) of the solve in L1.
 */
function solved(c: Claim, seed: number) {
  const g = graphAt(kernel, c, seed);
  const A = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 1 : 0)));
  for (let e = 0; e < g.m; e++) if (g.eu[e] !== g.t) A[g.eu[e]][g.ev[e]] -= g.w[e];
  const b = new Array<number>(g.n).fill(0);
  b[g.t] = 1;
  const held = mostHeld(g);
  expect(held, 'no company is held in full').toBeLessThan(1);
  return { g, e: solve(A, b), err: (g.n * STOP * held) / (1 - held) };
}

/** The largest effective owner and its share in percent to one decimal, from the solve, with a
 * clear lead and a margin from a rounding boundary beyond the iterate's error. */
const largest = (number: 1 | 2): Check => (c) => {
  for (const seed of seedsOf(c)) {
    const { g, e, err } = solved(c, seed);
    const t = top(e, g.t);
    expect(t.gap).toBeGreaterThan(2 * err);
    if (number === 1) expect(c.expect, c.id).toEqual({ value: t.v });
    else {
      expect(err, 'within 1e-9 of the solve').toBeLessThan(1e-9);
      expect(roundingMargin(100 * t.value, 1)).toBeGreaterThan(100 * err);
      expect(c.expect, c.id).toEqual({ number: 2, value: Number((100 * t.value).toFixed(1)) });
    }
  }
};

/**
 * On an acyclic input round k adds, to every owner, the products of shares along its paths of
 * exactly k edges into the target, all positive: so round k changes something while some path
 * has k edges, and the first round to change nothing is one after the longest chain L. The
 * smallest change a round k ≤ L makes is at least the smallest share to the power k, which must
 * clear the 1e-12 stop rule for the run not to stop early. Rounds = L + 1; the edges examined are
 * every holding but the target's own, each round: (L + 1)(m − outdeg t).
 */
function chain(g: Graph): number {
  const indeg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) indeg[g.ev[e]]++;
  const order: number[] = [];
  for (let v = 0; v < g.n; v++) if (!indeg[v]) order.push(v);
  for (let i = 0; i < order.length; i++) {
    for (const e of g.out[order[i]]) if (--indeg[g.ev[e]] === 0) order.push(g.ev[e]);
  }
  expect(order.length, 'the input is acyclic').toBe(g.n);
  const len = new Array<number>(g.n).fill(-Infinity);
  len[g.t] = 0;
  for (let i = order.length - 1; i >= 0; i--) {
    const v = order[i];
    if (v !== g.t) for (const e of g.out[v]) len[v] = Math.max(len[v], len[g.ev[e]] + 1);
  }
  const L = Math.max(...len.filter(Number.isFinite));
  expect(Math.min(...g.w) ** L, 'the longest chain clears the stop rule').toBeGreaterThan(STOP);
  return L;
}

const sameAtEverySeed = (c: Claim, figure: (g: Graph) => number): number => {
  const all = seedsOf(c).map((seed) => figure(graphAt(kernel, c, seed)));
  expect(new Set(all).size, `${c.id}: one figure at every seed (${all.join(', ')})`).toBe(1);
  return all[0];
};

const roundsAfterTheChain: Check = (c) => {
  expect(c.expect, c.id).toEqual({ value: sameAtEverySeed(c, (g) => chain(g) + 1) });
};

const scansPerRound: Check = (c) => {
  const value = sameAtEverySeed(c, (g) => (chain(g) + 1) * (g.m - g.out[g.t].length));
  expect(c.expect, c.id).toEqual({ value });
};

claimsAgainst(ID, {
  'largest-owner-is-the-linear-solve': largest(1),
  'largest-share-is-the-linear-solve': largest(2),
  'largest-owner-is-the-linear-solve-at-seed-7': largest(1),
  'largest-share-is-the-linear-solve-at-seed-7': largest(2),
  'largest-share-is-the-linear-solve-without-cross-holdings': largest(2),
  'rounds-stop-after-the-longest-chain': roundsAfterTheChain,
  'every-holding-scanned-each-round': scansPerRound,
  'every-holding-scanned-each-round-at-seed-7': scansPerRound,
});
