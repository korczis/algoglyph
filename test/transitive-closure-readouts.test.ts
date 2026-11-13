// transitive-closure's claims (wave 7a), from the plate's readouts; their literals are computed
// here independently. Warshall's rounds write a cell only when it is first filled (the kernel's
// set() returns on a filled cell), and the filled cells end as the reachability relation with the
// diagonal, so the matrix writes are the pairs (i, j) with i reaching j: counted by a breadth-first
// search from every vertex, never by Warshall's rounds. The bounds [n + m, n²]: the first round
// writes the n diagonal cells and the m edges, distinct cells when the input has no loop and no
// repeated edge (checked here), and no cell is written twice.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph } from '../src/engines/graph/graph';
import { kernel } from '../src/kernels/graph/transitive-closure';
import { claimGraph, entryClaims, reachability } from './support/digraph-oracles';

const pairs = (reach: boolean[][]) => reach.reduce((s, row) => s + row.filter(Boolean).length, 0);

describe('transitive-closure claims, from an independent computation', () => {
  it('states the reachable pairs and the bounds at each setting it claims', () => {
    let checked = 0;
    for (const c of entryClaims('transitive-closure')) {
      if (c.readout !== 'Matrix writes') continue;
      const g = claimGraph(kernel, c);
      if (c.expect.value !== undefined) expect(c.expect.value, c.id).toBe(pairs(reachability(g)));
      if (c.expect.range) expect(c.expect.range, c.id).toEqual([g.n + g.m, g.n * g.n]);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('has no loop and no repeated edge on any input of the sweep: n + m cells start filled', () => {
    for (const shape of kernel.inputs) for (const n of [4, 24, 64]) {
      for (const seed of [DEFAULT_SEED, 7, 1, 2, 3]) {
        const g = makeGraph(shape, n, seed, 1);
        const cells = new Set<number>();
        for (let e = 0; e < g.m; e++) if (g.eu[e] !== g.ev[e]) cells.add(g.eu[e] * g.n + g.ev[e]);
        expect(cells.size, `${shape} ${n} ${seed}`).toBe(g.m);
      }
    }
  });
});
