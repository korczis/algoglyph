// Where articulation-points' claims get their figures (catalogue/entries/articulation-points.md,
// read on the plate by test/claims.test.ts and again here through the instrument). Every
// expectation is computed in this file from the graph the claim's run draws, never by a
// depth-first search with low points as the plate runs: cut vertices by deleting each vertex and
// counting the components by breadth-first search, edges on a cycle by deleting each edge, the
// blocks by the block-cut identity (test/support/connectivity-oracles.ts).
import { expect } from 'vitest';
import type { Graph } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/articulation-points';
import {
  blocksByIdentity, claimsAgainstOracles, components, cutVertices, cutVerticesOnCycles, degrees,
  type Oracle,
} from './support/connectivity-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const cutCount: Oracle = (g) => ({ value: cutVertices(g).filter(Boolean).length });

/** A forest: each tree on k vertices has k − 1 edges, so m = n − c exactly when there is no cycle. */
const isForest = (g: Graph) => g.m === g.n - components(g);

claimsAgainstOracles('articulation-points', kernel, {
  'no-cut-vertex-on-the-geometric': cutCount,
  'cut-vertices-by-removal-on-random': cutCount,
  'cut-vertices-by-removal-on-islands': cutCount,
  'cut-vertices-by-removal-on-islands-at-300': cutCount,
  'cut-vertices-on-a-cycle-on-islands': (g) => ({ value: cutVerticesOnCycles(g) }),
  'blocks-by-the-block-cut-identity-on-islands': (g) => ({ value: blocksByIdentity(g) }),
  // every edge of a forest is a bridge, so each is a block of its own and blocks = m, which the
  // claim reads against the Graph readout's edge count
  'a-forest-is-all-blocks-of-one-edge': (g) => {
    expect(isForest(g), 'the input is a forest').toBe(true);
    expect(blocksByIdentity(g)).toBe(g.m);
    return { against: 'Graph', against_number: 2, tolerance: 0 };
  },
  // in a tree, deleting a vertex of degree d leaves d pieces, so it separates exactly when d >= 2
  'a-forest-cuts-at-every-inner-vertex': (g) => {
    expect(isForest(g), 'the input is a forest').toBe(true);
    return { value: degrees(g).filter((d) => d >= 2).length };
  },
  'tree-spans-the-geometric': (g) => {
    expect(components(g), 'the geometric input is connected').toBe(1);
    return { against: 'Graph', offset: -1, tolerance: 0 };
  },
  'forest-on-random': (g) => ({ value: g.n - components(g) }),
  // the scan skips only the edge a vertex was reached by: one per tree edge, n − c of them
  'scans-skip-the-edge-in': (g) => ({ value: 2 * g.m - g.n + components(g) }),
  'scans-skip-the-edge-in-on-islands': (g) => ({ value: 2 * g.m - g.n + components(g) }),
});
