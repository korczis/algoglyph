// Where brandes-betweenness's claims get their figures (catalogue/entries/brandes-betweenness.md,
// read on the plate by test/claims.test.ts and here). Betweenness comes from the pair formula over
// a breadth-first search from every vertex (test/support/analysis-oracles.ts), never from the
// backward accumulation the plate runs; the counts from the graph's components and degrees; the
// graph is the plate's input at the claim's seed.
import { expect } from 'vitest';
import type { Claim } from '../src/core/claims';
import type { Graph } from '../src/engines/graph/graph';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as brandes } from '../src/kernels/graph/brandes-betweenness';
import {
  claimsAgainst, componentCount, expectSimple, graphAt, hops, neighbours, pairBetweenness,
  roundingMargin, seedsOf, top, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'brandes-betweenness';
const kernel = brandes as GraphKernel;
const graphsOf = (c: Claim): Graph[] => seedsOf(c).map((seed) => {
  const g = graphAt(kernel, c, seed);
  expectSimple(g);
  expect(g.directed).toBe(false);
  return g;
});
/** The one literal a claim states at each of its seeds: the same figure at every seed. */
const sameAtEverySeed = (c: Claim, figure: (g: Graph) => number): number => {
  const all = graphsOf(c).map(figure);
  expect(new Set(all).size, `${c.id}: one figure at every seed (${all.join(', ')})`).toBe(1);
  return all[0];
};

/** One round per source: the plate runs a search from every vertex and closes each with a round,
 * so Rounds equals the Graph readout's vertex count, whatever the input. */
const oneRoundPerSource: Check = (c) => {
  expect(c.expect, c.id).toEqual({ against: 'Graph', tolerance: 0 });
};

/** Each source's search dequeues every vertex of its component and scans that vertex's edge
 * list, so it scans twice the component's edges: Σ over components C of |C| · 2 m_C, which is
 * 2mn on a connected input. Components here by breadth-first search, edges by their ends. */
const scans: Check = (c) => {
  const value = sameAtEverySeed(c, (g) => {
    const next = neighbours(g);
    let sum = 0;
    for (let s = 0; s < g.n; s++) {
      const d = hops(next, s);
      for (let v = 0; v < g.n; v++) if (d[v] >= 0) sum += next[v].length;
    }
    if (componentCount(g) === 1) expect(sum).toBe(2 * g.m * g.n);
    return sum;
  });
  expect(c.expect, c.id).toEqual({ value });
};

/** Each shortest s–t path has d(s, t) − 1 interior vertices and a vertex's betweenness is its
 * share of the pair's paths, so the pair adds d(s, t) − 1 to the sum; the sum over every joined
 * pair, by breadth-first search from each vertex. Printed to four significant figures, an
 * integer below 10,000 prints exactly. */
const sum: Check = (c) => {
  const value = sameAtEverySeed(c, (g) => {
    const next = neighbours(g);
    let total = 0;
    for (let s = 0; s < g.n; s++) {
      const d = hops(next, s);
      for (let t = s + 1; t < g.n; t++) if (d[t] > 0) total += d[t] - 1;
    }
    const cb = pairBetweenness(g).reduce((a, x) => a + x, 0);
    expect(Math.abs(cb - total)).toBeLessThan(1e-6 * total);
    return total;
  });
  expect(value).toBeLessThan(10_000);
  expect(c.expect, c.id).toEqual({ value });
};

/** A vertex lies inside at most every pair of the other n − 1 vertices, all of whose shortest
 * paths it could carry: its betweenness is at most C(n − 1, 2). */
const atMostThePairs: Check = (c) => {
  const value = sameAtEverySeed(c, (g) => ((g.n - 1) * (g.n - 2)) / 2);
  expect(c.expect, c.id).toEqual({ number: 2, range: [0, value] });
};

/** The top broker and its betweenness by the pair formula, printed to one decimal: the leader
 * must be clear and the value away from a rounding boundary, beyond the sums' rounding error. */
const broker = (number: 1 | 2): Check => (c) => {
  const [g] = graphsOf(c);
  const t = top(pairBetweenness(g));
  expect(t.gap).toBeGreaterThan(1e-6);
  if (number === 1) expect(c.expect, c.id).toEqual({ value: t.v });
  else {
    expect(roundingMargin(t.value, 1)).toBeGreaterThan(1e-6);
    expect(c.expect, c.id).toEqual({ number: 2, value: Number(t.value.toFixed(1)) });
  }
};

/** The plate writes every vertex's betweenness once at the start, then, from each source s,
 * every vertex w ≠ s whose dependency is positive: one with a neighbour a hop farther from s,
 * which is how w comes to lie inside a shortest path from s. Counted by breadth-first search. */
const writes: Check = (c) => {
  const [g] = graphsOf(c);
  const next = neighbours(g);
  let count = g.n;
  for (let s = 0; s < g.n; s++) {
    const d = hops(next, s);
    for (let w = 0; w < g.n; w++) {
      if (w !== s && d[w] >= 0 && next[w].some((x) => d[x] === d[w] + 1)) count++;
    }
  }
  expect(c.expect, c.id).toEqual({ value: count });
};

claimsAgainst(ID, {
  'one-round-per-source': oneRoundPerSource,
  'one-round-per-source-on-a-disconnected-input': oneRoundPerSource,
  'every-edge-scanned-twice-from-every-source': scans,
  'every-edge-scanned-twice-from-every-source-at-seed-7': scans,
  'scans-stay-in-the-source-component': scans,
  'sum-is-the-interior-hops': sum,
  'sum-is-the-interior-hops-at-seed-7': sum,
  'sum-is-the-interior-hops-on-a-disconnected-input': sum,
  'top-broker-at-most-the-pairs': atMostThePairs,
  'top-broker-is-the-pair-formula': broker(1),
  'top-betweenness-is-the-pair-formula': broker(2),
  'top-broker-is-the-pair-formula-at-seed-7': broker(1),
  'top-betweenness-is-the-pair-formula-at-seed-7': broker(2),
  'writes-are-the-interior-vertices': writes,
});
