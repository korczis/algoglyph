// topological-sort's readouts (wave 7a). G4: "Every edge then runs from an earlier place to a
// later one." The plate counts the edges that point backward in its order, so a claim can read 0
// off the plate: a vertex finishes only after every vertex it points to has finished (on a DAG a
// successor is never still on the stack), and the k-th to finish takes place n − 1 − k, so each
// edge's head is placed after its tail.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph } from '../src/engines/graph/graph';
import { trace } from '../src/engines/graph/trace';
import { kernel, type TopoResult } from '../src/kernels/graph/topological-sort';
import {
  claimGraph, entryClaims, reachability, settledRows,
} from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const BACKWARD = 'Edges pointing backward';
const SETTINGS: [string, Record<string, unknown>][] = [
  ['layered DAG', {}], ['signed DAG', { shape: 'signed-dag' }],
  ['reasoning graph', { shape: 'reasoning' }],
  ['layered DAG at 300', { n: 300 }], ['layered DAG at 6', { n: 6 }],
];

describe('topological-sort counts the edges pointing backward in its order (G4)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`reads 0 on the ${what}, seed ${seed}`, async () => {
      const rows = await settledRows('topological-sort', set as never, seed);
      const row = rows.find((r) => r.label === BACKWARD);
      expect(row, rows.map((r) => r.label).join(' | ')).toBeDefined();
      expect(row?.value).toBe('0');
    });
  }

  it('counts every edge when the order is reversed', () => {
    const g = makeGraph('dag', 60, DEFAULT_SEED, 16 / 9);
    const order = (trace(kernel, g, { s: g.s, t: g.t, p: {} }).result as TopoResult).order;
    const opts = { s: g.s, t: g.t, p: {} };
    const rows = kernel.report?.({ order: [...order].reverse() }, g, opts) ?? [];
    expect(rows.find((r) => r.label === BACKWARD)?.value).toBe(String(g.m));
  });
});

// The entry's claims, from the plate's readouts; the literal of place 0 is computed here
// independently. The searches start, in index order, at each vertex no earlier search reached; a
// vertex is reached by an earlier search exactly when some smaller-numbered vertex reaches it
// (that vertex was itself reached by, or was, an earlier root). So the roots are the vertices no
// smaller-numbered vertex reaches, by a breadth-first search from every vertex; the last of them
// starts the last search, finishes last and takes place 0.
describe('topological-sort claims, from an independent computation', () => {
  it('states the last root at place 0 at each setting it claims', () => {
    let checked = 0;
    for (const c of entryClaims('topological-sort')) {
      if (c.readout !== 'Order') continue;
      const g = claimGraph(kernel, c);
      const reach = reachability(g);
      let last = -1;
      for (let v = 0; v < g.n; v++) if (!reach.slice(0, v).some((row) => row[v])) last = v;
      expect(c.expect.value, c.id).toBe(last);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('finds every input of the sweep acyclic, so 0 backward edges is the claim on each', () => {
    for (const shape of ['dag', 'signed-dag', 'reasoning'] as const) {
      for (const n of [6, 60, 300]) for (const seed of [DEFAULT_SEED, 7, 1, 2, 3]) {
        const g = makeGraph(shape, n, seed, 16 / 9);
        const reach = reachability(g);
        const edges = Array.from({ length: g.m }, (_, e) => e);
        const cyclic = edges.filter((e) => reach[g.ev[e]][g.eu[e]]);
        expect(cyclic, `${shape} ${n} ${seed}`).toEqual([]);
      }
    }
  });
});
