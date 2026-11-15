// Where spreading-activation's claims get their figures (catalogue/entries/spreading-activation.md,
// read on the plate by test/claims.test.ts and here). At threshold 0 the activations are one linear
// solve, (I − dP) a = s, by Gaussian elimination (test/support/analysis-oracles.ts), never the
// rounds of pulses the plate fires; the total is the geometric series; the graph is the plate's
// input at the claim's seed, the seed vertex its suggested g.s.
import { expect } from 'vitest';
import type { Claim } from '../src/core/claims';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as spreading } from '../src/kernels/graph/spreading-activation';
import {
  claimsAgainst, componentCount, graphAt, paramsOf, precisionMargin, seedsOf, solve, top,
  type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'spreading-activation';
const kernel = spreading as GraphKernel;
/** The plate's cut: a round whose largest pulse is below this ends the run. */
const CUT = 1e-13;

/**
 * At threshold 0 every vertex holding a pulse fires and passes d of it along its edges in
 * proportion to their weights, P[v][u] = w(u, v) / strength(u), so the activations are the series
 * s + dPs + d²P²s + … = (I − dP)⁻¹ s, and their total the geometric series 1 / (1 − d): P moves
 * mass without losing any. The run stops once the largest pulse is below the cut, holding at most
 * n of them, so the tail it leaves is below n · 1e-13 · d / (1 − d), and every figure must sit
 * farther than that from a rounding boundary of its printed precision.
 */
function solved(c: Claim, seed: number) {
  const p = paramsOf(kernel, c);
  expect(Number(p.threshold), `${c.id}: the solve is the run at threshold 0`).toBe(0);
  const d = Number(p.decay);
  const g = graphAt(kernel, c, seed);
  expect(g.directed).toBe(false);
  const strength = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) { strength[g.eu[e]] += g.w[e]; strength[g.ev[e]] += g.w[e]; }
  const A = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 1 : 0)));
  for (let e = 0; e < g.m; e++) {
    const [u, v, w] = [g.eu[e], g.ev[e], g.w[e]];
    A[v][u] -= (d * w) / strength[u];
    A[u][v] -= (d * w) / strength[v];
  }
  const b = new Array<number>(g.n).fill(0);
  b[g.s] = 1;
  return { g, d, a: solve(A, b), tail: (g.n * CUT * d) / (1 - d) };
}

/** The total activation at threshold 0: the series 1 / (1 − d) to the four significant figures
 * printed, which the solve's sum confirms. */
const series: Check = (c) => {
  const totals = seedsOf(c).map((seed) => {
    const { a, d, tail } = solved(c, seed);
    const want = 1 / (1 - d);
    expect(Math.abs(a.reduce((x, y) => x + y, 0) - want)).toBeLessThan(1e-9);
    expect(precisionMargin(want, 4)).toBeGreaterThan(tail);
    return Number(want.toPrecision(4));
  });
  expect(new Set(totals).size).toBe(1);
  expect(c.expect, c.id).toEqual({ value: totals[0] });
};

/** Above threshold 0 a pulse below the threshold dies, taking its share of every later round with
 * it, so the total falls short of 1 / (1 − d); printed to four significant figures it is then at
 * most the series' own four-figure value, below the series to five. */
const belowSeries: Check = (c) => {
  const d = Number(paramsOf(kernel, c).decay);
  expect(Number(paramsOf(kernel, c).threshold)).toBeGreaterThan(0);
  const want = 1 / (1 - d);
  expect(Number(want.toPrecision(4))).toBeLessThan(Number(want.toPrecision(5)));
  expect(c.expect, c.id).toEqual({ below: Number(want.toPrecision(5)) });
};

/** The most activated vertex (the seed vertex excluded) and its activation, three significant
 * figures, from the solve: a clear lead and a margin from rounding beyond the tail. */
const most = (number: 1 | 2): Check => (c) => {
  for (const seed of seedsOf(c)) {
    const { g, a, tail } = solved(c, seed);
    const t = top(a, g.s);
    expect(t.gap).toBeGreaterThan(2 * tail);
    if (number === 1) expect(c.expect, c.id).toEqual({ value: t.v });
    else {
      expect(precisionMargin(t.value, 3)).toBeGreaterThan(tail);
      expect(c.expect, c.id).toEqual({ number: 2, value: Number(t.value.toPrecision(3)) });
    }
  }
};

/** At threshold 0 every vertex the seed's component holds receives a pulse and is settled when
 * the run ends; the input is connected, so Activated equals the Graph readout's vertex count. */
const everyVertex: Check = (c) => {
  for (const seed of seedsOf(c)) {
    solved(c, seed);
    expect(componentCount(graphAt(kernel, c, seed)), `${c.id}: connected at seed ${seed}`).toBe(1);
  }
  expect(c.expect, c.id).toEqual({ against: 'Graph', tolerance: 0 });
};

claimsAgainst(ID, {
  'total-is-the-geometric-series': series,
  'total-is-the-geometric-series-on-the-links': series,
  'total-is-the-geometric-series-at-the-top-decay': series,
  'total-is-the-geometric-series-at-low-decay': series,
  'a-threshold-loses-activation': belowSeries,
  'most-activated-is-the-linear-solve': most(1),
  'most-activation-is-the-linear-solve': most(2),
  'most-activated-is-the-linear-solve-at-seed-7': most(1),
  'most-activation-is-the-linear-solve-at-seed-7': most(2),
  'threshold-zero-activates-every-vertex': everyVertex,
});
