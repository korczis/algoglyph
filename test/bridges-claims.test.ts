// Where bridges' claims get their figures (catalogue/entries/bridges.md, read on the plate by
// test/claims.test.ts and again here through the instrument). Every expectation is computed in
// this file from the graph the claim's run draws, never by low points as the plate runs: bridges
// by deleting each edge and counting the components by breadth-first search, the forest from the
// component count (test/support/connectivity-oracles.ts). And the notes' account of the inputs:
// the geometric one joins every vertex to its three nearest, the random one leaves vertices
// hanging by one edge.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/bridges';
import {
  bridgesByRemoval, claimsAgainstOracles, components, degrees, type Oracle,
} from './support/connectivity-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const bridgeCount = (g: Graph) => bridgesByRemoval(g).filter(Boolean).length;
const bridges: Oracle = (g) => ({ value: bridgeCount(g) });

claimsAgainstOracles('bridges', kernel, {
  'bridges-by-removal-on-random': bridges,
  'bridges-by-removal-on-islands': bridges,
  'bridges-by-removal-at-one-edge-per-vertex': bridges,
  'no-bridge-on-the-small-world': bridges,
  'no-bridge-on-the-geometric': bridges,
  // a forest (m = n − c) has no cycle, so deleting any edge splits its tree
  'every-edge-of-a-forest-is-a-bridge': (g) => {
    expect(g.m, 'the input is a forest').toBe(g.n - components(g));
    expect(bridgeCount(g)).toBe(g.m);
    return { against: 'Graph', against_number: 2, tolerance: 0 };
  },
  'forest-on-random': (g) => ({ value: g.n - components(g) }),
  'tree-edges-that-are-not-bridges-on-random': (g) => ({ value: g.n - components(g) - bridgeCount(g) }),
  'tree-spans-the-geometric': (g) => {
    expect(components(g), 'the geometric input is connected').toBe(1);
    return { against: 'Graph', offset: -1, tolerance: 0 };
  },
  'scans-skip-the-edge-in': (g) => ({ value: 2 * g.m - g.n + components(g) }),
});

describe('bridges: the inputs are as the notes describe them', () => {
  it('the geometric input hangs no vertex by one edge, and the random one does', () => {
    for (const seed of [DEFAULT_SEED, 7]) {
      expect(Math.min(...degrees(makeGraph('geometric', 70, seed, 16 / 9)))).toBeGreaterThanOrEqual(3);
      expect(degrees(makeGraph('random', 70, seed, 16 / 9)).filter((d) => d === 1).length).toBeGreaterThan(1);
    }
  });
});
