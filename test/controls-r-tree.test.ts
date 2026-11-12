// The R-tree's controls (src/kernels/geometry/r-tree.ts): each one exists with its range, survives
// a shared link, and drives what the plate reads out. Counted or read from the run's state, never
// timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { makeInput } from '../src/engines/geometry/input';
import { record } from '../src/engines/geometry/trace';
import { kernel, type RNode } from '../src/kernels/geometry/r-tree';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const def = (key: string): ParamDef | undefined => (kernel.params ?? []).find((d) => d.key === key);

/** The height bounds of an R-tree of n points with at most M and at least m entries per node:
 * M^h ≥ n (fewest levels) and 2·m^(h − 1) ≤ n (most levels: the root has two children, every
 * other node at least m entries). */
function heightBounds(n: number, M: number, m: number): [number, number] {
  let lo = 1;
  while (M ** lo < n) lo++;
  let hi = 1;
  while (2 * m ** hi <= n) hi++;
  return [lo, hi];
}

/** The fewest entries of any node below the root, and the tree's height. */
function shape(root: RNode): { least: number; height: number } {
  let least = Infinity;
  let height = 0;
  const walk = (nd: RNode, d: number) => {
    const size = nd.leaf ? nd.items.length : nd.kids.length;
    if (d > 0) least = Math.min(least, size);
    if (nd.leaf) height = Math.max(height, d + 1); else for (const k of nd.kids) walk(k, d + 1);
  };
  walk(root, 0);
  return { least, height };
}

const claim = (readout: string, expect: Claim['expect'], params: Record<string, number>): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params } });

describe('r-tree: fill', () => {
  it('is a range 0.2 … 0.5 in steps of 0.05, default 0.4 (m = ⌊0.4 M⌋, the fixed fraction before)', () => {
    const d = def('fill') as RangeParam | undefined;
    expect(d?.kind).toBe('range');
    expect({ min: d?.min, max: d?.max, step: d?.step, value: d?.value }).toEqual({ min: 0.2, max: 0.5, step: 0.05, value: 0.4 });
  });

  it('keeps the quadratic split feasible: 2m ≤ M + 1, so both groups of a split reach m, at every M and fill', () => {
    const M = def('M') as RangeParam;
    const fill = def('fill') as RangeParam;
    for (let k = M.min; k <= M.max; k += M.step) {
      for (let f = fill.min; f <= fill.max + 1e-9; f += fill.step) {
        const m = Math.max(2, Math.floor(k * Number(f.toFixed(10))));
        expect(2 * m, `M=${k} fill=${f}`).toBeLessThanOrEqual(k + 1);
      }
    }
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate('r-tree'))!.params;
    for (const v of [0.2, 0.35, 0.5]) {
      expect(parse(defs, serialise(defs, { fill: v }, 5)), `fill=${v}`).toEqual({ seed: 5, params: { fill: v } });
    }
  });

  it('sets the minimum fill the tree keeps: at fill 0.5 and M = 6 every node below the root holds at least 3', () => {
    for (const seed of [4242, 7, 1]) {
      for (const shapeName of ['uniform', 'clustered']) {
        const input = makeInput('points', shapeName, 150, seed, { q: 30 });
        const t = record(kernel, input, { q: 30, M: 6, fill: 0.5 }, seed, false);
        const res = t.outcome.result as { root: RNode; m: number };
        expect(res.m).toBe(3);
        const s = shape(res.root);
        expect(s.least, `${shapeName} seed=${seed}`).toBeGreaterThanOrEqual(3);
        const [lo, hi] = heightBounds(150, 6, 3);
        expect(s.height).toBeGreaterThanOrEqual(lo);
        expect(s.height).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('drives the Tree height readout: at fill 0.5 (m = 3) it reads within [3, 4]', async () => {
    expect(heightBounds(150, 6, 3)).toEqual([3, 4]);
    const r = await read('r-tree', claim('Tree height', { range: [3, 4] }, { fill: 0.5 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBeGreaterThanOrEqual(3);
    expect(r.value).toBeLessThanOrEqual(4);
  }, 120_000);
});

describe('r-tree: M (height bounds across the range, at n = 150 and m = max(2, ⌊0.4 M⌋))', () => {
  it('derives the bounds the claims state', () => {
    expect(heightBounds(150, 4, 2)).toEqual([4, 7]);
    expect(heightBounds(150, 6, 2)).toEqual([3, 7]);
    expect(heightBounds(150, 10, 4)).toEqual([3, 4]);
    expect(heightBounds(150, 16, 6)).toEqual([2, 3]);
  });
});
