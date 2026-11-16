// Where louvain-leiden's claims get their figures (catalogue/entries/louvain-leiden.md, read on the
// plate by test/claims.test.ts and here). The bound is the modularity of the partition the run
// starts from, every vertex alone, by Newman's formula over the edge lists
// (test/support/analysis-oracles.ts); the graph is the plate's input at the claim's seed.
import { expect } from 'vitest';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as louvain } from '../src/kernels/graph/louvain-leiden';
import {
  claimsAgainst, expectSimple, graphAt, newmanQ, seedsOf, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'louvain-leiden';
const kernel = louvain as GraphKernel;

/**
 * Modularity Q lies in [Q(singletons), 1]. The run starts with every vertex alone, Q = −Σ (k_v/2m)².
 * Local moving takes a node to another community only when the gain beats staying by more than
 * 1e-12 (src/kernels/graph/louvain-leiden.ts), so every move raises Q; contracting a level keeps
 * the partition and so its Q; and Leiden's refinement only chooses how to contract, the next level
 * starting from the unrefined communities. Q never falls, and no partition's Q reaches 1. Printed
 * to three decimals, rounding keeps the lower end: the range is [Q(singletons) to three
 * decimals, 1], the same at every seed the claim names.
 */
const aboveSingletons: Check = (c) => {
  const all = seedsOf(c).map((seed) => {
    const g = graphAt(kernel, c, seed);
    expectSimple(g);
    return Number(newmanQ(g, Array.from({ length: g.n }, (_, v) => v)).toFixed(3));
  });
  expect(new Set(all).size, `${c.id}: one lower end at every seed (${all.join(', ')})`).toBe(1);
  expect(c.expect, c.id).toEqual({ range: [all[0], 1] });
};

claimsAgainst(ID, {
  'modularity-never-below-the-singletons': aboveSingletons,
  'modularity-never-below-the-singletons-for-louvain': aboveSingletons,
  'modularity-never-below-the-singletons-on-the-grid': aboveSingletons,
});
