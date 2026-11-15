// Where euler-tour's claims get their figures (catalogue/entries/euler-tour.md, read on the plate
// by test/claims.test.ts and again here through the instrument). Every claim rests on the input
// being connected with every degree even (Euler's condition for a closed tour), checked here by
// breadth-first search and a degree count over the Graph's edge lists at each seed the claim
// names, never by walking a tour; the scan counts are 2m from the edge count alone.
import { expect } from 'vitest';
import type { Graph } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/euler-tour';
import { claimsAgainstOracles, components, degrees, type Oracle } from './support/connectivity-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

function eulerian(g: Graph): void {
  expect(components(g), 'the input is connected').toBe(1);
  expect(degrees(g).filter((d) => d % 2), 'every degree is even').toEqual([]);
}

/** Connected with even degrees: a closed tour through every edge exists, and the splicing emits
 * each walked edge once, so the Tour's two numbers agree. */
const everyEdge: Oracle = (g) => {
  eulerian(g);
  return { against: 'Tour', against_number: 2, tolerance: 0 };
};

/** Every vertex's edge list is read through once and each edge lies in two lists. */
const twiceEach: Oracle = (g) => {
  eulerian(g);
  return { value: 2 * g.m };
};

claimsAgainstOracles('euler-tour', kernel, {
  'every-edge-in-the-tour': everyEdge,
  'every-edge-in-the-tour-at-200': everyEdge,
  'every-edge-in-the-tour-at-6': everyEdge,
  'every-vertex-exhausted': (g) => {
    eulerian(g);
    return { against: 'Exhausted', against_number: 2, tolerance: 0 };
  },
  'every-edge-scanned-twice': twiceEach,
  'every-edge-scanned-twice-at-200': twiceEach,
});
