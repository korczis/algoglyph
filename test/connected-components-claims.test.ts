// Where connected-components' claims get their figures (catalogue/entries/connected-components.md,
// read on the plate by test/claims.test.ts and again here through the instrument). Every
// expectation is computed in this file from the graph the claim's run draws: the components by
// breadth-first search (never the depth-first labelling the plate runs), the bound from the edge
// count alone.
import { expect } from 'vitest';
import { kernel } from '../src/kernels/graph/connected-components';
import {
  claimsAgainstOracles, components, componentSizes, type Oracle,
} from './support/connectivity-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const count: Oracle = (g) => ({ value: components(g) });
const largest: Oracle = (g) => ({ value: Math.max(...componentSizes(g)) });

claimsAgainstOracles('connected-components', kernel, {
  'components-on-islands': count,
  'largest-on-islands': largest,
  'components-on-islands-at-seed-7': count,
  'components-on-islands-at-400': count,
  'components-on-random': count,
  'largest-on-random': largest,
  'geometric-is-connected': count,
  'grid-is-connected': count,
  // n isolated vertices are n components, and adding an edge merges at most two of them into
  // one, so after m edges at least n − m remain (and never more than n): a hard bound from the
  // edge count, whatever the edges are
  'sparse-random-components-are-bounded': (g) => {
    expect(components(g)).toBeGreaterThanOrEqual(g.n - g.m);
    return { range: [g.n - g.m, g.n] };
  },
  'dense-random-is-connected': count,
  'every-edge-scanned-twice-on-islands': (g) => ({ value: 2 * g.m }),
  'every-vertex-labelled': () => ({ against: 'Labelled', against_number: 2, tolerance: 0 }),
});
