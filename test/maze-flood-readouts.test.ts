// maze-flood's readouts (wave 7a, G7). The carve is a spanning tree of the grid's cells, so once it
// is done the plate's passages readout reads cells − 1: a tree on V vertices has V − 1 edges. It
// counts the passages carved so far (each cell's east and south openings, so each passage once),
// and the claims compare it with the cells readout.
import { describe, expect, it } from 'vitest';
import { holds, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'maze-flood';

const against = (params: Record<string, string | number>, seed = 4242): Claim => ({
  id: 'probe', statement: 'passages minus cells is −1', readout: 'passages',
  expect: { against: 'cells', offset: -1, tolerance: 0 }, setup: { params, seed },
});

describe('maze-flood: the passages readout (G7)', () => {
  for (const generator of ['backtracker', 'prim']) {
    it(`reads cells − 1 once the ${generator} maze is carved`, async () => {
      for (const cell of [8, 32, 48]) for (const seed of [7, 4242]) {
        const c = against({ generator, cell }, seed);
        const r = await read(ID, c);
        expect(r.reason, `${generator} cell ${cell} seed ${seed}`).toBeUndefined();
        expect(holds(c, r.value as number), `${generator} cell ${cell} seed ${seed}: ${r.text}`).toBe(true);
      }
    });
  }
});
