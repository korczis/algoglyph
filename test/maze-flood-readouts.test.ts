// maze-flood's readouts (wave 7a, G7). The carve is a spanning tree of the grid's cells, so once it
// is done the plate's passages readout reads cells − 1: a tree on V vertices has V − 1 edges. It
// counts the passages carved so far (each cell's east and south openings, so each passage once),
// and the claims compare it with the cells readout.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
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

// The longest shortest path from the source has no independent exact value here: the only oracle
// is a re-carve with the plate's own generator (integrator decision (e)). It is claimed within hard
// bounds instead, derived from the canvas alone: the claims instrument draws on 800 by 500 (the
// plate's 16:10), so the grid is ⌊800 / cell⌋ by ⌊500 / cell⌋ cells with the source in its middle
// cell. A route moves one cell a step, so the farthest corner is at least its Manhattan distance
// away; a perfect maze is a tree, so no route has more than cells − 1 steps.
describe('maze-flood: the bounds the claims state, from the canvas alone', () => {
  const bounds = (cell: number) => {
    const cols = Math.max(4, Math.floor(800 / cell));
    const rows = Math.max(4, Math.floor(500 / cell));
    const sx = Math.floor(cols / 2); const sy = Math.floor(rows / 2);
    const corner = Math.max(...[[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]].map(([x, y]) => Math.abs(x - sx) + Math.abs(y - sy)));
    return [corner, cols * rows - 1];
  };

  it('pins each claimed range to the Manhattan corner and cells − 1', () => {
    const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
    const claims = model.entries.find((e) => e.id === ID)!.claims;
    const ranged = claims.filter((c) => c.readout === 'longest shortest path');
    expect(ranged.length).toBeGreaterThanOrEqual(3);
    for (const c of ranged) {
      const cell = Number(c.setup?.params?.cell ?? 32);
      expect(c.expect.range, `${c.id} at cell ${cell}`).toEqual(bounds(cell));
    }
    expect(bounds(32)).toEqual([19, 374]);
  });
});
