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
import { settledRows } from './support/digraph-oracles';
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
