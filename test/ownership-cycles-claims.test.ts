// Where ownership-cycles' claims get their figures (catalogue/entries/ownership-cycles.md, read on
// the plate by test/claims.test.ts and again here through the instrument). Every expectation is
// computed in this file from the graph the claim's run draws, never by DFS colouring: acyclicity
// by Kahn's peeling, the strong components as the classes of mutual reachability, by a
// breadth-first search from every vertex (test/support/connectivity-oracles.ts).
//
// The bounds on the plate's two cycle counts, for any depth-first search of a digraph without
// self-loops. Let C be a strong component with |C| >= 2 and m_C edges inside it, and r its vertex
// the search enters first. (1) Every vertex of C is a descendant of r (all of C is white and
// reachable from r when r is entered), and the tree path from r to it stays inside C, so the
// search tree restricted to C is a tree: |C| − 1 of C's edges are tree edges. (2) Some u in C,
// u ≠ r, has an edge into r (C is strongly connected and has a second vertex); u is a descendant
// of r, so r is still grey when that edge is scanned: a back edge inside C, whose cycle runs along
// the tree path from r to u, at least two vertices of C. (3) A back edge u → v has v an ancestor
// of u, so v reaches u and u reaches v: it lies inside one strong component. Hence, with k such
// components covering V vertices: k <= cycles closed <= Σ (m_C − |C| + 1), and every vertex on a
// found cycle lies in one of them (3), at least two per component (2): 2k <= on a cycle <= V.
import { expect } from 'vitest';
import { kernel } from '../src/kernels/graph/ownership-cycles';
import {
  between, claimsAgainstOracles, cyclicComponents, unpeeled, type Oracle,
} from './support/connectivity-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const acyclic: Oracle = (g) => {
  expect(unpeeled(g), 'Kahn peels every vertex').toBe(0);
  expect(cyclicComponents(g).count).toBe(0);
  return { value: 0 };
};

const cyclesClosed: Oracle = (g) => {
  const k = cyclicComponents(g);
  expect(unpeeled(g), 'Kahn leaves a vertex behind: a cycle exists').toBeGreaterThan(0);
  return between(k.count, k.rank);
};

const onACycle: Oracle = (g) => {
  const k = cyclicComponents(g);
  return between(2 * k.count, k.vertices);
};

claimsAgainstOracles('ownership-cycles', kernel, {
  'every-out-edge-once': () => ({ against: 'Graph', against_number: 2, tolerance: 0 }),
  'every-out-edge-once-on-the-digraph': () => ({ against: 'Graph', against_number: 2, tolerance: 0 }),
  'every-vertex-finished': () => ({ against: 'Black (finished)', against_number: 2, tolerance: 0 }),
  'the-dag-is-acyclic': acyclic,
  'no-cross-holdings-no-cycle': acyclic,
  'cycles-closed-on-ownership': cyclesClosed,
  'cycles-closed-at-twelve-cross-holdings': cyclesClosed,
  'cycles-closed-on-the-digraph': cyclesClosed,
  'companies-on-a-found-cycle-on-ownership': onACycle,
  'companies-on-a-found-cycle-on-the-digraph': onACycle,
});
