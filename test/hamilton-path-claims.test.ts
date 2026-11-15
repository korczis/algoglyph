// Where hamilton-path's claims get their figures (catalogue/entries/hamilton-path.md, read on the
// plate by test/claims.test.ts and again here through the instrument). Whether a Hamilton path
// exists is decided here without backtracking: by the subset dynamic programme over the vertex
// sets a path can cover (test/support/connectivity-oracles.ts), and on a grid too large for it by
// building the snake (rows walked alternately left and right) and checking it edge by edge. The
// degree counts come from the edge list. And the notes' remark that pruning does not always save
// work, read off the plate with the pruning on and off.
import { describe, expect, it } from 'vitest';
import type { Graph } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/hamilton-path';
import { read } from './support/claims';
import {
  claimsAgainstOracles, degrees, hamiltonPathExists, isHamiltonPath, type Oracle,
} from './support/connectivity-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

/** The grid's snake: its rows (vertices sharing a y, numbered row by row) walked alternately
 * left to right and right to left. */
function snake(g: Graph): number[] {
  const cols = g.y.filter((y) => y === g.y[0]).length;
  const rows = g.n / cols;
  expect(Number.isInteger(rows) && rows >= 2 && cols >= 2, 'a rectangular grid').toBe(true);
  return Array.from({ length: rows }, (_, r) => {
    const row = Array.from({ length: cols }, (_, c) => r * cols + c);
    return r % 2 ? row.reverse() : row;
  }).flat();
}

/** A path exists, so the search ends with every vertex on it: On the path − vertices = 0. */
const pathExists = (by: 'snake' | 'programme'): Oracle => (g) => {
  if (by === 'snake') expect(isHamiltonPath(g, snake(g)), 'the snake is a Hamilton path').toBe(true);
  if (g.n <= 24) expect(hamiltonPathExists(g), 'the subset programme finds a path').toBe(true);
  return { against: 'Graph', tolerance: 0 };
};

const noPath = (g: Graph) => expect(hamiltonPathExists(g), 'the subset programme finds no path').toBe(false);
const leaves = (g: Graph) => degrees(g).filter((d) => d === 1).length;

/** Three or more vertices of degree one (or one of degree zero): no path has room for them, and
 * the pruned search decides from the degree count alone. */
const decidedByDegrees = (g: Graph) => {
  expect(leaves(g) >= 3 || degrees(g).includes(0), 'three leaves or an isolated vertex').toBe(true);
  noPath(g);
};

claimsAgainstOracles('hamilton-path', kernel, {
  'the-grid-has-a-snake': pathExists('snake'),
  'the-largest-grid-has-a-snake': pathExists('snake'),
  'geometric-path-by-the-subset-programme': pathExists('programme'),
  'geometric-path-by-the-subset-programme-at-20': pathExists('programme'),
  'small-world-path-by-the-subset-programme': pathExists('programme'),
  'no-path-on-the-random-input': (g) => {
    noPath(g);
    return { value: 0 };
  },
  // a vertex of degree one is an end of any Hamilton path through it, so with one or two of them
  // (and none isolated) only they are tried as starts, and every failed start ends one round
  'two-leaves-two-starts': (g) => {
    noPath(g);
    expect(degrees(g).includes(0), 'no isolated vertex').toBe(false);
    expect(leaves(g)).toBeGreaterThan(0);
    expect(leaves(g)).toBeLessThanOrEqual(2);
    return { value: leaves(g) };
  },
  'three-leaves-decide-at-once': (g) => {
    decidedByDegrees(g);
    return { value: 0 };
  },
  'three-leaves-cost-one-scan-per-edge': (g) => {
    decidedByDegrees(g);
    return { against: 'Graph', against_number: 2, tolerance: 0 };
  },
  // unpruned, every vertex is a start, and with no path each one fails and ends a round
  'the-plain-search-tries-every-start': (g) => {
    noPath(g);
    return { against: 'Graph', tolerance: 0 };
  },
  'the-plain-search-finds-the-geometric-path': pathExists('programme'),
  'the-plain-search-finds-the-snake': pathExists('snake'),
});

describe('hamilton-path: pruning does not always save work (the notes)', () => {
  it('on the default grid the plain search examines fewer edges than the pruned one', async () => {
    const probe = (prune: boolean) => read('hamilton-path', {
      id: 'probe', statement: 'a reading for the notes', readout: 'Edges examined',
      expect: { range: [0, 1e12] }, setup: { params: { prune } },
    });
    const [on, off] = [await probe(true), await probe(false)];
    expect([on.reason, off.reason]).toEqual([undefined, undefined]);
    expect(off.value as number).toBeLessThan(on.value as number);
  });
});
