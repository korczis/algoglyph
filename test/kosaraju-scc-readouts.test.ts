// kosaraju-scc's readouts (wave 7a). D2: the engine's groups readout is labelled
// "Strong components" (the kernel's names.groups), and the kernel's own report added a second row
// with the same label and value: a claim reads only the first row with its label, so a settled
// plate's labels must be unique. The engine's row stays (the replay's count of components, live
// as they are painted); the report keeps the largest component.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/kosaraju-scc';
import {
  claimGraph, entryClaims, mutualClasses, repeatedLabels, settledRows,
} from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['digraph', {}], ['dag', { shape: 'dag' }], ['ownership', { shape: 'ownership' }],
  ['digraph at 300', { n: 300 }], ['digraph at 6', { n: 6 }],
];

describe('kosaraju-scc: a settled plate publishes each readout label once (D2)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('kosaraju-scc', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Strong components');
      expect(rows.map((r) => r.label)).toContain('Largest');
    });
  }
});

// The entry's claims, from the plate's readouts; their literals are computed here independently:
// the strong components as the classes of mutual reachability, by a breadth-first search from
// every vertex (never a depth-first search, as either pass runs), the edges examined as twice the
// input's edge count (the first pass scans each vertex's in-edges, the second its out-edges, and
// every edge is one vertex's in-edge and another's out-edge).
describe('kosaraju-scc claims, from an independent computation', () => {
  it('states the classes of mutual reachability and 2m at each setting it claims', () => {
    const claims = entryClaims('kosaraju-scc');
    let checked = 0;
    for (const c of claims) {
      if (c.expect.value === undefined) continue;
      const g = claimGraph(kernel, c);
      const cls = mutualClasses(g);
      const sizes = new Map<number, number>();
      for (const k of cls) sizes.set(k, (sizes.get(k) ?? 0) + 1);
      const want: Record<string, number> = {
        'Strong components': sizes.size,
        Largest: Math.max(...sizes.values()),
        'Edges examined': 2 * g.m,
      };
      expect(c.expect.value, c.id).toBe(want[c.readout]);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('finds one component per vertex on every layered DAG of the sweep', () => {
    for (const n of [6, 70, 300]) for (const seed of [DEFAULT_SEED, 7, 1, 2, 3]) {
      expect(new Set(mutualClasses(makeGraph('dag', n, seed, 16 / 9))).size).toBe(n);
    }
  });
});
