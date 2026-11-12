// Every exact count the geometry wing states in a bound (catalogue/entries/*.md, ADR 0006 §4),
// driven at several settings and compared with what the kernel counts. Asymptotic bounds
// (O(n log n), O((n + k) log n)) are not checked here.
import { describe, expect, it } from 'vitest';
import { makeInput } from '../src/engines/geometry/input';
import { record, type Geo, type Input, type Pt } from '../src/engines/geometry/trace';
import { anchorIndex, angularOrder, grahamStack } from '../src/kernels/geometry/_hull';
import { kernel as ccw } from '../src/kernels/geometry/ccw-intersection';
import { kernel as dbscan } from '../src/kernels/geometry/dbscan';
import { kernel as generalSweep } from '../src/kernels/geometry/general-sweep';
import { kernel as giftWrapping } from '../src/kernels/geometry/gift-wrapping';
import { kernel as grahamScan } from '../src/kernels/geometry/graham-scan';
import { kernel as gridMethod } from '../src/kernels/geometry/grid-method';
import { kernel as interiorElimination } from '../src/kernels/geometry/interior-elimination';
import { kernel as kMeansPlusPlus } from '../src/kernels/geometry/k-means-plus-plus';
import { kernel as pointInPolygon } from '../src/kernels/geometry/point-in-polygon';

const SEEDS = [4242, 7, 1];
const POINT_SHAPES = ['uniform', 'clustered', 'circle', 'disk', 'lattice'];

/** A Geo that only counts orientation tests and pops (the frames graham's stack records as one). */
function countingGeo(input: Input): Geo & { orients: number; pops: number } {
  const g = {
    input, params: {}, rnd: () => 0, recording: true, orients: 0, pops: 0,
    count() {},
    orient(a: Pt, b: Pt, c: Pt) { g.orients++; return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); },
    dist2(a: Pt, b: Pt) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; },
    dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); },
    less(x: number, y: number) { return x < y; },
    base() {}, view() {}, last() {},
    frame(_make: () => unknown, note = '') { if (note.startsWith('pop')) g.pops++; },
  };
  return g;
}

function drain<T>(it: Generator<unknown, T>): T {
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

describe('geometry: exact bounds against counted runs', () => {
  it('ccw-intersection: four orientation tests for each of the n(n − 1)/2 pairs, 2n(n − 1)', () => {
    for (const shape of ['random', 'short', 'lattice-segments']) {
      for (const n of [2, 3, 17, 40, 200]) {
        for (const seed of SEEDS) {
          const input = makeInput('segments', shape, n, seed);
          const m = input.segments.length;
          const t = record(ccw, input, {}, seed, false);
          expect(m, `${shape} n=${n}`).toBe(n);
          expect(t.counts.orient, `${shape} n=${n} seed=${seed}`).toBe(2 * m * (m - 1));
          expect(t.counts.pairs).toBe((m * (m - 1)) / 2);
        }
      }
    }
  });

  it('dbscan: every point queried once, each query a scan of all n, so n queries and n² distances', () => {
    const settings = [{ eps: 45, minPts: 5 }, { eps: 12, minPts: 2 }, { eps: 140, minPts: 20 }];
    for (const shape of ['clustered', 'uniform', 'lattice']) {
      for (const n of [10, 50, 400]) {
        for (const params of settings) {
          for (const seed of SEEDS) {
            const input = makeInput('points', shape, n, seed);
            const m = input.points.length;
            const t = record(dbscan, input, params, seed, false);
            expect(t.counts.query, `${shape} n=${n} ${JSON.stringify(params)} seed=${seed}`).toBe(m);
            expect(t.counts.dist).toBe(m * m);
          }
        }
      }
    }
  });

  it('gift-wrapping: each of the h steps tests every point but its vertex and first candidate, h(n − 2)', () => {
    for (const shape of POINT_SHAPES) {
      for (const n of [3, 4, 30, 160, 500]) {
        for (const seed of SEEDS) {
          const input = makeInput('points', shape, n, seed);
          const m = input.points.length;
          const t = record(giftWrapping, input, {}, seed, false);
          const h = (t.outcome.result as Pt[]).length;
          expect(t.counts.orient, `${shape} n=${n} seed=${seed} h=${h}`).toBe(h * (m - 2));
        }
      }
    }
  });

  it('grid-method: n bucketings; a query visits exactly the cells it overlaps and tests their points', () => {
    for (const shape of ['uniform', 'clustered', 'lattice']) {
      for (const n of [1, 50, 200, 1500]) {
        for (const q of [5, 30, 80]) {
          for (const seed of SEEDS) {
            const input = makeInput('points', shape, n, seed, { q });
            const pts = input.points;
            const B = input.box;
            const R = input.rect;
            // the grid rebuilt independently: cells of side √(2·area/n), about two points each
            const side = Math.sqrt(((B.x1 - B.x0) * (B.y1 - B.y0) * 2) / Math.max(1, pts.length));
            const nx = Math.max(1, Math.ceil((B.x1 - B.x0) / side));
            const ny = Math.max(1, Math.ceil((B.y1 - B.y0) / side));
            const ix = (x: number) => Math.min(nx - 1, Math.max(0, Math.floor((x - B.x0) / side)));
            const iy = (y: number) => Math.min(ny - 1, Math.max(0, Math.floor((y - B.y0) / side)));
            const overlapped = (ix(R.x1) - ix(R.x0) + 1) * (iy(R.y1) - iy(R.y0) + 1);
            const inThem = pts.filter((p) => ix(p.x) >= ix(R.x0) && ix(p.x) <= ix(R.x1)
              && iy(p.y) >= iy(R.y0) && iy(p.y) <= iy(R.y1)).length;
            const t = record(gridMethod, input, { q }, seed, false);
            const at = `${shape} n=${n} q=${q} seed=${seed}`;
            expect(t.counts.bucket, at).toBe(pts.length);
            expect(t.counts.cell, at).toBe(overlapped);
            expect(t.counts.test, at).toBe(inThem);
          }
        }
      }
    }
  });

  it('general-sweep: 2n + k event pops, each pair scheduled once, at most 4(3n + 2k) orientation tests', () => {
    for (const shape of ['short', 'random']) {
      for (const n of [2, 10, 60, 300]) {
        for (const seed of SEEDS) {
          const input = makeInput('segments', shape, n, seed);
          const m = input.segments.length;
          const t = record(generalSweep, input, {}, seed, false);
          const found = t.outcome.result as [number, number][];
          const k = found.length;
          const at = `${shape} n=${n} seed=${seed} k=${k}`;
          // no pair is reported twice
          expect(new Set(found.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`)).size, at).toBe(k);
          expect(t.counts.found, at).toBe(k);
          expect(t.counts.pop, at).toBe(2 * m + k);
          // two neighbour tests per left end, one per right end, two per crossing: 4 orient calls each
          expect(t.counts.orient, at).toBeLessThanOrEqual(4 * (3 * m + 2 * k));
        }
      }
    }
  });

  it('graham-scan: the scan pops n − h points and makes at most 2(n − 2) orientation tests', () => {
    for (const shape of POINT_SHAPES) {
      for (const n of [3, 4, 30, 160, 500]) {
        for (const seed of SEEDS) {
          const input = makeInput('points', shape, n, seed);
          const pts = input.points;
          const m = pts.length;
          const o = pts[anchorIndex(pts)];
          const g = countingGeo(input);
          const order = angularOrder(g, o, pts);
          const sort = g.orients;
          const h = drain(grahamStack(g, o, order));
          const scan = g.orients - sort;
          const at = `${shape} n=${n} seed=${seed} h=${h.length}`;
          expect(g.pops, at).toBe(m - h.length);
          expect(scan, at).toBeLessThanOrEqual(2 * (m - 2));
          // the kernel's own count is the sort's and the scan's together, on the same hull
          const t = record(grahamScan, input, {}, seed, false);
          expect(t.counts.orient, at).toBe(sort + scan);
          expect((t.outcome.result as Pt[]).length, at).toBe(h.length);
        }
      }
    }
  });
});

// The second half of the wing: interior-elimination, k-means-plus-plus and point-in-polygon.

describe('geometry: exact bounds against counted runs (interior elimination, k-means++, inclusion)', () => {
  it('interior-elimination: the filter makes at most 4 orientation tests per point, exactly 4 per point eliminated', () => {
    for (const shape of POINT_SHAPES) {
      for (const n of [3, 4, 10, 160, 300]) {
        for (const seed of SEEDS) {
          const input = makeInput('points', shape, n, seed);
          const m = input.points.length;
          const t = record(interiorElimination, input, {}, seed, true);
          const at = `${shape} n=${n} seed=${seed}`;
          // every frame kept, so the last frame of the filter carries the filter's own counts
          expect(t.stride, at).toBe(1);
          const filter = t.frames.filter((f) => f.note === 'eliminate the interior');
          expect(filter.length, at).toBe(m);
          const { orient, eliminated } = filter[filter.length - 1].counts;
          expect(eliminated, at).toBe(t.counts.eliminated);
          expect(orient, at).toBeGreaterThanOrEqual(4 * eliminated);
          expect(orient, at).toBeLessThanOrEqual(4 * m);
        }
      }
    }
  });

  it('k-means-plus-plus: (k − 1)n distance computations to seed, then exactly nk per Lloyd iteration', () => {
    for (const shape of ['clustered', 'uniform', 'disk']) {
      for (const n of [10, 50, 400]) {
        for (const k of [2, 5, 12]) {
          for (const seed of SEEDS) {
            const input = makeInput('points', shape, n, seed, { k });
            const m = input.points.length;
            const kk = Math.min(m, k);
            const t = record(kMeansPlusPlus, input, { k }, seed, false);
            const at = `${shape} n=${n} k=${k} seed=${seed} iterations=${t.counts.iter}`;
            expect(t.counts.iter, at).toBeGreaterThanOrEqual(1);
            expect(t.counts.dist, at).toBe((kk - 1) * m + m * kk * t.counts.iter);
          }
        }
      }
    }
  });

  it('point-in-polygon: every query examines all m edges, n·m in all, with at most one orientation test each', () => {
    for (const shape of ['star', 'comb']) {
      for (const polygonM of [6, 28, 120]) {
        for (const n of [1, 60, 600]) {
          for (const seed of SEEDS) {
            const input = makeInput('polygon', shape, n, seed, { m: polygonM });
            // the comb has 4·round(m/4) vertices, so the count is taken from the polygon itself
            const edges = input.polygon.length;
            const t = record(pointInPolygon, input, { m: polygonM }, seed, false);
            const at = `${shape} m=${polygonM} (${edges} edges) n=${n} seed=${seed}`;
            expect(t.counts.edge, at).toBe(input.points.length * edges);
            expect(t.counts.orient, at).toBeLessThanOrEqual(t.counts.edge);
          }
        }
      }
    }
  });
});
