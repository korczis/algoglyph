// Interior elimination's controls (src/kernels/geometry/interior-elimination.ts): each one exists
// with its options, survives a shared link, and drives what the plate reads out. Counted or read
// from the run's state, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { makeInput } from '../src/engines/geometry/input';
import { record, type Pt } from '../src/engines/geometry/trace';
import { kernel } from '../src/kernels/geometry/interior-elimination';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SEEDS = [4242, 7, 1];
const SHAPES = ['uniform', 'clustered', 'circle', 'disk', 'lattice'];
const FILTERS = ['diagonal', 'axis', 'octagon'];
const def = (key: string): ParamDef | undefined => (kernel.params ?? []).find((d) => d.key === key);
const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** The strict hull corners (Andrew's monotone chain), as keys: shares no code with the kernel. */
function hullKeys(pts: Pt[]): string[] {
  const s = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half(s.slice().reverse())].map((p) => `${p.x},${p.y}`).sort();
}

/** The distinct extremes a filter's polygon has, found independently of the kernel: the first
 * point of greatest value in each direction (ties go to the earlier point, as in the kernel). */
function cornerCount(pts: Pt[], filter: string): number {
  const dirs: [number, number][] = filter === 'axis'
    ? [[0, -1], [1, 0], [0, 1], [-1, 0]]
    : filter === 'diagonal'
      ? [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      : [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const picked = new Set<Pt>();
  for (const [dx, dy] of dirs) {
    let b = pts[0];
    for (const p of pts) if (dx * p.x + dy * p.y > dx * b.x + dy * b.y) b = p;
    picked.add(b);
  }
  return picked.size;
}

/** The filter's own counts: the last frame of the filter, every frame kept. */
function filterRun(shape: string, n: number, seed: number, filter: string) {
  const input = makeInput('points', shape, n, seed);
  const t = record(kernel, input, { filter }, seed, true);
  const frames = t.frames.filter((f) => f.note === 'eliminate the interior');
  return { input, t, frames, filter: frames[frames.length - 1]?.counts ?? { orient: 0, eliminated: 0 } };
}

const claim = (readout: string, params: Record<string, string>): Claim =>
  ({ id: 'probe', statement: '', readout, expect: { above: -1 }, setup: { params } });

describe('interior-elimination: filter', () => {
  it('is a select of the diagonal quadrilateral (default), the axis quadrilateral and the octagon', () => {
    const d = def('filter') as SelectParam | undefined;
    expect(d?.kind).toBe('select');
    expect(d?.value).toBe('diagonal');
    expect(d?.options.map((o) => o.value)).toEqual(FILTERS);
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate('interior-elimination'))!.params;
    for (const v of ['axis', 'octagon']) {
      expect(parse(defs, serialise(defs, { filter: v }, 5)), v).toEqual({ seed: 5, params: { filter: v } });
    }
  });

  it('keeps the hull exact and tests at most one orientation per corner and point, all of them per point eliminated', () => {
    for (const filter of FILTERS) {
      for (const shape of SHAPES) {
        for (const n of [3, 4, 10, 160, 300]) {
          for (const seed of SEEDS) {
            const { input, t, frames, filter: c } = filterRun(shape, n, seed, filter);
            const m = input.points.length;
            const k = cornerCount(input.points, filter);
            const at = `${filter} ${shape} n=${n} seed=${seed} k=${k}`;
            expect(t.stride, at).toBe(1);
            expect(frames.length, at).toBe(m);
            expect(k, at).toBeLessThanOrEqual(filter === 'octagon' ? 8 : 4);
            expect(c.eliminated, at).toBe(t.counts.eliminated);
            expect(c.orient, at).toBeLessThanOrEqual(k * m);
            if (k >= 3) expect(c.orient, at).toBeGreaterThanOrEqual(k * c.eliminated);
            const h = (t.outcome.result as Pt[]).map((p) => `${p.x},${p.y}`).sort();
            if (m >= 3) expect(h, at).toEqual(hullKeys(input.points));
          }
        }
      }
    }
  });

  it('eliminates nothing on a circle, whatever the filter: every point is a strict hull corner', () => {
    for (const filter of FILTERS) {
      for (const seed of SEEDS) expect(filterRun('circle', 160, seed, filter).t.counts.eliminated, `${filter} ${seed}`).toBe(0);
    }
  });

  it('the octagon contains both quadrilaterals, so on the same input it eliminates at least as many as either', () => {
    for (const shape of SHAPES) {
      for (const n of [10, 160, 300]) {
        for (const seed of SEEDS) {
          const e = Object.fromEntries(FILTERS.map((f) => [f, filterRun(shape, n, seed, f).t.counts.eliminated]));
          const at = `${shape} n=${n} seed=${seed} ${JSON.stringify(e)}`;
          expect(e.octagon, at).toBeGreaterThanOrEqual(e.diagonal);
          expect(e.octagon, at).toBeGreaterThanOrEqual(e.axis);
        }
      }
    }
  });

  it('drives the Points eliminated readout: the octagon reads at least the diagonal on the default uniform set', async () => {
    const diag = await read('interior-elimination', claim('Points eliminated', {}));
    const oct = await read('interior-elimination', claim('Points eliminated', { filter: 'octagon' }));
    expect(oct.reason).toBeUndefined();
    expect(oct.value).toBeGreaterThanOrEqual(diag.value as number);
    const circle = await read('interior-elimination', claim('Points eliminated', { filter: 'axis', shape: 'circle' }));
    expect(circle.reason).toBeUndefined();
    expect(circle.value).toBe(0);
  }, 120_000);

  it('the octagon runs its own corners: on the default uniform set it has more than 4 and makes more than 4n tests', () => {
    const { input, filter: c } = filterRun('uniform', 160, 4242, 'octagon');
    expect(cornerCount(input.points, 'octagon')).toBeGreaterThan(4);
    expect(c.orient).toBeGreaterThan(4 * input.points.length);
  });
});
