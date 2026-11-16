// Where label-propagation's claims get their figures (catalogue/entries/label-propagation.md, read
// on the plate by test/claims.test.ts and here). The bounds are derived below from the graph alone:
// its size, its smallest degree and its components by breadth-first search
// (test/support/analysis-oracles.ts); the graph is the plate's input at the claim's seed.
import { expect } from 'vitest';
import { trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel as lpa, type LabelsResult } from '../src/kernels/graph/label-propagation';
import {
  claimsAgainst, componentCount, graphAt, neighbours, paramsOf, seedsOf, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'label-propagation';
const kernel = lpa as GraphKernel;

/**
 * Labels in use lie in [components, ⌊n/2⌋]. Below: a label starts on one vertex and moves only
 * along an edge, so it never leaves its component, and every component holds at least one.
 * Above: the rounds stop when one changes nothing, and then every vertex holds a label that is
 * most common among its neighbours, held by at least one of them; with no isolated vertex every
 * label is therefore held by two vertices at least. The bound needs a run that stopped that way,
 * not at the round cap, which the kernel's own run is asked here (a precondition, not the figure).
 */
const labelBounds: Check = (c) => {
  const all = seedsOf(c).map((seed) => {
    const g = graphAt(kernel, c, seed);
    expect(Math.min(...neighbours(g).map((x) => x.length)), `${c.id}: no isolated vertex`).toBeGreaterThan(0);
    const r = trace(kernel, g, { s: g.s, t: g.t, p: paramsOf(kernel, c) }, seed).result as LabelsResult;
    expect(r.converged, `${c.id}: the rounds stop by themselves at seed ${seed}`).toBe(true);
    return `${componentCount(g)},${Math.floor(g.n / 2)}`;
  });
  expect(new Set(all).size, `${c.id}: one range at every seed (${all.join('; ')})`).toBe(1);
  const [lo, hi] = all[0].split(',').map(Number);
  expect(c.expect, c.id).toEqual({ range: [lo, hi] });
};

claimsAgainst(ID, {
  'labels-at-most-half-the-vertices': labelBounds,
  'labels-at-most-half-the-vertices-on-the-geometric-input': labelBounds,
  'labels-at-most-half-the-vertices-at-300': labelBounds,
  'labels-never-cross-components': labelBounds,
  'labels-never-cross-components-at-seed-7': labelBounds,
});
