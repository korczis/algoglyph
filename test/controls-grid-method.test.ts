// The grid method's controls (src/kernels/geometry/grid-method.ts): each one exists with its
// range, survives a shared link, and drives what the plate reads out. Counted or read from the
// run's state, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { makeInput } from '../src/engines/geometry/input';
import { record, type Input } from '../src/engines/geometry/trace';
import { kernel } from '../src/kernels/geometry/grid-method';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SEEDS = [4242, 7, 1];
const def = (key: string): ParamDef | undefined => (kernel.params ?? []).find((d) => d.key === key);

/** The grid rebuilt independently: cells of side √(perCell · area / n), perCell points each on
 * average; the cells the query rectangle overlaps, the points in them and the points inside it. */
function expected(input: Input, perCell: number) {
  const pts = input.points;
  const B = input.box;
  const R = input.rect;
  const side = Math.sqrt(((B.x1 - B.x0) * (B.y1 - B.y0) * perCell) / Math.max(1, pts.length));
  const nx = Math.max(1, Math.ceil((B.x1 - B.x0) / side));
  const ny = Math.max(1, Math.ceil((B.y1 - B.y0) / side));
  const ix = (x: number) => Math.min(nx - 1, Math.max(0, Math.floor((x - B.x0) / side)));
  const iy = (y: number) => Math.min(ny - 1, Math.max(0, Math.floor((y - B.y0) / side)));
  const cells = (ix(R.x1) - ix(R.x0) + 1) * (iy(R.y1) - iy(R.y0) + 1);
  const inCells = pts.filter((p) => ix(p.x) >= ix(R.x0) && ix(p.x) <= ix(R.x1)
    && iy(p.y) >= iy(R.y0) && iy(p.y) <= iy(R.y1)).length;
  const inside = pts.map((p, i) => [p, i] as const)
    .filter(([p]) => p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1).map(([, i]) => i);
  // the rectangle's sides are q % of the field's, times 0.7 … 1.3 (makeInput), and a span of
  // length d covers ⌊d / side⌋ + 1 or + 2 cells
  return { side, nx, ny, cells, inCells, inside, R };
}

/** The cells-visited bound at query size q % and n points: from the rectangle's extreme sides. */
function cellBound(n: number, q: number, perCell: number): [number, number] {
  const W = 1600; const H = 1000;
  const side = Math.sqrt((W * H * perCell) / n);
  const nx = Math.ceil(W / side); const ny = Math.ceil(H / side);
  const span = (len: number, lo: number, hi: number, cap: number): [number, number] =>
    [Math.min(cap, Math.floor((len * lo) / side) + 1), Math.min(cap, Math.floor((len * hi) / side) + 2)];
  const [xl, xh] = span((W * q) / 100, 0.7, 1.3, nx);
  const [yl, yh] = span((H * q) / 100, 0.7, 1.3, ny);
  return [xl * yl, xh * yh];
}

const claim = (readout: string, params: Record<string, number>): Claim =>
  ({ id: 'probe', statement: '', readout, expect: { above: -1 }, setup: { params } });

describe('grid-method: perCell', () => {
  it('is a range 2 … 32 in steps of 1, default 2 (the two points per cell fixed before)', () => {
    const d = def('perCell') as RangeParam | undefined;
    expect(d?.kind).toBe('range');
    expect({ min: d?.min, max: d?.max, step: d?.step, value: d?.value }).toEqual({ min: 2, max: 32, step: 1, value: 2 });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate('grid-method'))!.params;
    for (const v of [3, 8, 32]) {
      expect(parse(defs, serialise(defs, { perCell: v }, 5)), `perCell=${v}`).toEqual({ seed: 5, params: { perCell: v } });
    }
  });

  it('buckets every point once, visits exactly the overlapped cells, tests exactly their points, finds the brute-force answer', () => {
    for (const shape of ['uniform', 'clustered', 'lattice']) {
      for (const n of [1, 50, 200, 1500]) {
        for (const q of [5, 30, 80]) {
          for (const perCell of [2, 3, 8, 32]) {
            for (const seed of SEEDS) {
              const input = makeInput('points', shape, n, seed, { q });
              const x = expected(input, perCell);
              const t = record(kernel, input, { q, perCell }, seed, false);
              const at = `${shape} n=${n} q=${q} perCell=${perCell} seed=${seed}`;
              expect(t.counts.bucket, at).toBe(input.points.length);
              expect(t.counts.cell, at).toBe(x.cells);
              expect(t.counts.test, at).toBe(x.inCells);
              const found = (t.outcome.result as { inside: number[] }).inside.slice().sort((a, b) => a - b);
              expect(found, at).toEqual(x.inside);
              if (input.points.length === n) {
                const [lo, hi] = cellBound(n, q, perCell);
                expect(t.counts.cell, at).toBeGreaterThanOrEqual(lo);
                expect(t.counts.cell, at).toBeLessThanOrEqual(hi);
              }
            }
          }
        }
      }
    }
  });

  it('derives the bounds and grid sizes the claims state, at n = 200 and q = 30', () => {
    expect(cellBound(200, 30, 2)).toEqual([6, 30]);
    expect(cellBound(200, 30, 8)).toEqual([2, 12]);
    expect(cellBound(200, 30, 32)).toEqual([1, 6]);
    const nx = (perCell: number) => Math.ceil(1600 / Math.sqrt((1600 * 1000 * perCell) / 200));
    expect([nx(2), nx(8), nx(32)]).toEqual([13, 7, 4]);
  });

  it('drives the readouts: at 32 points per cell the grid reads 4 columns, and the query its brute-force answer', async () => {
    const input = makeInput('points', 'uniform', 200, 4242, { q: 30 });
    const x = expected(input, 32);
    const grid = await read('grid-method', claim('Grid', { perCell: 32 }));
    expect(grid.reason).toBeUndefined();
    expect(grid.value).toBe(4);
    const found = await read('grid-method', claim('Points in the rectangle', { perCell: 32 }));
    expect(found.value).toBe(x.inside.length);
    const tested = await read('grid-method', claim('Points tested', { perCell: 32 }));
    expect(tested.value).toBe(x.inCells);
    const bucketed = await read('grid-method', claim('Points bucketed', { perCell: 32 }));
    expect(bucketed.value).toBe(200);
  }, 120_000);
});
