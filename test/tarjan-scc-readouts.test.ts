// tarjan-scc's readouts (wave 7a). D2: the engine's groups readout is labelled
// "Strong components" (the kernel's names.groups), and the kernel's own report added a second row
// with the same label and value: a claim reads only the first row with its label, so a settled
// plate's labels must be unique. The engine's row stays (the replay's count of components, live
// as they are painted); the report keeps the largest component.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph } from '../src/engines/graph/graph';
import { trace } from '../src/engines/graph/trace';
import { kernel, type SccResult } from '../src/kernels/graph/tarjan-scc';
import {
  claimGraph, entryClaims, mutualClasses, repeatedLabels, settledRows,
} from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['digraph', {}], ['dag', { shape: 'dag' }], ['ownership', { shape: 'ownership' }],
  ['digraph at 300', { n: 300 }], ['digraph at 6', { n: 6 }],
];

describe('tarjan-scc: a settled plate publishes each readout label once (D2)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('tarjan-scc', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Strong components');
      expect(rows.map((r) => r.label)).toContain('Largest');
    });
  }
});

// G3. The notes: "Components come out in reverse topological order: no component has an edge into
// one popped after it." The plate counts those edges, so a claim can read 0 off the plate. A
// component is popped only when its root finishes, after the search has left every vertex the
// root reaches, so each component reached from it is already popped (Tarjan 1972; the stack
// invariant): no edge can point into a later one.
const LATER = 'Edges into a later-popped component';

describe('tarjan-scc counts the edges into a later-popped component (G3)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`reads 0 on the ${what}, seed ${seed}`, async () => {
      const rows = await settledRows('tarjan-scc', set as never, seed);
      const row = rows.find((r) => r.label === LATER);
      expect(row, rows.map((r) => r.label).join(' | ')).toBeDefined();
      expect(row?.value).toBe('0');
    });
  }

  it('counts every edge between components when the pop order is reversed', () => {
    const g = makeGraph('digraph', 70, DEFAULT_SEED, 16 / 9);
    const comp = (trace(kernel, g, { s: g.s, t: g.t, p: {} }).result as SccResult).comp;
    const k = Math.max(...comp) + 1;
    let between = 0;
    for (let e = 0; e < g.m; e++) if (comp[g.eu[e]] !== comp[g.ev[e]]) between++;
    expect(between).toBeGreaterThan(0);
    const reversed = { comp: comp.map((c) => k - 1 - c) };
    const rows = kernel.report?.(reversed, g, { s: g.s, t: g.t, p: {} }) ?? [];
    expect(rows.find((r) => r.label === LATER)?.value).toBe(String(between));
  });
});

// The entry's claims, from the plate's readouts; their literals are computed here independently:
// the strong components as the classes of mutual reachability, by a breadth-first search from
// every vertex (never the depth-first search the plate runs).
describe('tarjan-scc claims, from an independent computation', () => {
  it('states the classes of mutual reachability at each setting it claims', () => {
    let checked = 0;
    for (const c of entryClaims('tarjan-scc')) {
      if (c.expect.value === undefined || c.readout === LATER) continue;
      const sizes = new Map<number, number>();
      for (const k of mutualClasses(claimGraph(kernel, c))) sizes.set(k, (sizes.get(k) ?? 0) + 1);
      const want: Record<string, number> = {
        'Strong components': sizes.size, Largest: Math.max(...sizes.values()),
      };
      expect(c.expect.value, c.id).toBe(want[c.readout]);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });
});
