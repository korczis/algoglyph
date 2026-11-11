// Every live geometry kernel of the catalogue, checked by one harness against references that
// share no code with the kernels: brute force, linear scans, closed forms and published values.
// A kernel is checked by the reference its `task` names (ADR 0004 §4).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { mulberry32 } from '../src/core/random';
import { fromPoints, makeInput } from '../src/engines/geometry/input';
import { record, type GeometryKernel, type Input, type Pt, type Seg, type Task } from '../src/engines/geometry/trace';

const modules = import.meta.glob<GeometryKernel>('../src/kernels/geometry/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'geometry' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/geometry/${id}.ts`];
const SEEDS = [1, 2, 3];

const key = (p: Pt) => `${p.x},${p.y}`;
const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const run = (k: GeometryKernel, input: Input, params: Record<string, number | string | boolean> = {}) =>
  record(k, input, params, 7);

/** Hull corners by brute force: a pair is a hull edge when no point lies right of it and the
 * points on its line lie between its ends; corners are the ends of such edges. O(n³). */
function bruteHull(pts: Pt[]): Set<string> {
  if (pts.length < 3) return new Set(pts.map(key));
  const out = new Set<string>();
  for (const a of pts) for (const b of pts) {
    if (a === b) continue;
    let ok = true;
    for (const c of pts) {
      if (c === a || c === b) continue;
      const o = cross(a, b, c);
      if (o < 0) { ok = false; break; }
      if (o === 0) {
        const t = (c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y);
        const l = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        if (t < 0 || t > l) { ok = false; break; }
      }
    }
    if (ok) { out.add(key(a)); out.add(key(b)); }
  }
  return out;
}

/** Whether two closed segments share a point, by solving for the parameters of the meeting
 * point (Cramer's rule), and by overlap of projections when they are parallel. */
function segmentsMeet(s: Seg, t: Seg): boolean {
  const r = { x: s.b.x - s.a.x, y: s.b.y - s.a.y };
  const q = { x: t.b.x - t.a.x, y: t.b.y - t.a.y };
  const w = { x: t.a.x - s.a.x, y: t.a.y - s.a.y };
  const d = r.x * q.y - r.y * q.x;
  const tn = w.x * q.y - w.y * q.x;
  const un = w.x * r.y - w.y * r.x;
  if (d !== 0) {
    const inside = (num: number) => (d > 0 ? num >= 0 && num <= d : num <= 0 && num >= d);
    return inside(tn) && inside(un);
  }
  const dir = Math.abs(r.x) + Math.abs(r.y) >= Math.abs(q.x) + Math.abs(q.y) ? r : q;
  if (!dir.x && !dir.y) return s.a.x === t.a.x && s.a.y === t.a.y;
  if ((t.a.x - s.a.x) * dir.y - (t.a.y - s.a.y) * dir.x !== 0) return false; // parallel lines
  const along = Math.abs(dir.x) >= Math.abs(dir.y) ? 'x' : 'y';
  const [s0, s1] = [Math.min(s.a[along], s.b[along]), Math.max(s.a[along], s.b[along])];
  const [t0, t1] = [Math.min(t.a[along], t.b[along]), Math.max(t.a[along], t.b[along])];
  return s0 <= t1 && t0 <= s1;
}

function allPairs(segs: Seg[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) if (segmentsMeet(segs[i], segs[j])) out.push(`${i},${j}`);
  return out;
}

const pairKeys = (pairs: [number, number][]) => pairs.map(([i, j]) => (i < j ? `${i},${j}` : `${j},${i}`)).sort();

/** Winding number by summing the signed angles the boundary sweeps around p. */
function winding(poly: Pt[], p: Pt): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]; const b = poly[(i + 1) % poly.length];
    sum += Math.atan2((a.x - p.x) * (b.y - p.y) - (a.y - p.y) * (b.x - p.x), (a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y));
  }
  return Math.round(sum / (2 * Math.PI));
}

type Check = (k: GeometryKernel, id: string) => void;

interface TreeNode { leaf: boolean; box: { x0: number; y0: number; x1: number; y1: number }; kids: TreeNode[]; items: number[] }

/** R-tree invariants: leaves at one depth, fill between m and M, every rectangle tight. */
function checkTree(root: TreeNode, pts: Pt[], M: number, m: number, id: string): void {
  const depths = new Set<number>();
  const seen: number[] = [];
  const walk = (nd: TreeNode, d: number, isRoot: boolean) => {
    const size = nd.leaf ? nd.items.length : nd.kids.length;
    expect(size, `${id} node fill`).toBeLessThanOrEqual(M);
    if (!isRoot) expect(size, `${id} node fill`).toBeGreaterThanOrEqual(m);
    const bs = nd.leaf ? nd.items.map((i) => ({ x0: pts[i].x, y0: pts[i].y, x1: pts[i].x, y1: pts[i].y })) : nd.kids.map((k) => k.box);
    expect(nd.box, `${id} tight rectangle`).toEqual({
      x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)),
      x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)),
    });
    if (nd.leaf) { depths.add(d); seen.push(...nd.items); } else for (const k of nd.kids) walk(k, d + 1, false);
  };
  walk(root, 0, true);
  expect(depths.size, `${id} leaves at one depth`).toBe(1);
  expect(seen.sort((a, b) => a - b)).toEqual(pts.map((_, i) => i));
}

/** Exact in-circle sign with integers: positive when d is inside the circle through a, b, c. */
function inCircleExact(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const B = (v: number) => BigInt(v);
  const [ax, ay, bx, by, cx, cy] = [B(a.x - d.x), B(a.y - d.y), B(b.x - d.x), B(b.y - d.y), B(c.x - d.x), B(c.y - d.y)];
  const det = (ax * ax + ay * ay) * (bx * cy - by * cx) - (bx * bx + by * by) * (ax * cy - ay * cx) + (cx * cx + cy * cy) * (ax * by - ay * bx);
  return det > 0n ? 1 : det < 0n ? -1 : 0;
}

/** Area of the convex hull, from its corners sorted by angle about their centroid. */
function hullArea(pts: Pt[]): number {
  const h = [...bruteHull(pts)].map((s) => { const [x, y] = s.split(',').map(Number); return { x, y }; });
  const cx = h.reduce((t, p) => t + p.x, 0) / h.length; const cy = h.reduce((t, p) => t + p.y, 0) / h.length;
  h.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  let a = 0;
  for (let i = 0; i < h.length; i++) a += cross({ x: 0, y: 0 }, h[i], h[(i + 1) % h.length]);
  return a / 2;
}

/** Seeded blobs whose centres are far apart compared with their spread. */
function blobs(k: number, per: number, seed: number): { pts: Pt[]; truth: number[] } {
  const rnd = mulberry32(seed);
  const pts: Pt[] = []; const truth: number[] = []; const seen = new Set<string>();
  for (let c = 0; c < k; c++) {
    const cx = 150 + (c % 4) * 420; const cy = 180 + Math.floor(c / 4) * 600;
    while (pts.length < (c + 1) * per) {
      const p = { x: Math.round(cx + (rnd() - 0.5) * 80), y: Math.round(cy + (rnd() - 0.5) * 80) };
      if (seen.has(key(p))) continue;
      seen.add(key(p)); pts.push(p); truth.push(c);
    }
  }
  return { pts, truth };
}

/** Labels describe the same partition as the truth (equal up to renaming). */
function samePartition(a: number[], b: number[]): boolean {
  const f = new Map<number, number>(); const r = new Map<number, number>();
  for (let i = 0; i < a.length; i++) {
    if (f.has(a[i]) && f.get(a[i]) !== b[i]) return false;
    if (r.has(b[i]) && r.get(b[i]) !== a[i]) return false;
    f.set(a[i], b[i]); r.set(b[i], a[i]);
  }
  return true;
}

const CHECKS: Partial<Record<Task, Check>> = {
  kmeans(k, id) {
    for (const seed of SEEDS) {
      for (const K of [2, 3, 5, 8]) {
        const { pts, truth } = blobs(K, 40, seed);
        const res = run(k, fromPoints(pts), { k: K }).outcome.result as { centres: Pt[]; labels: number[]; inertia: number[] };
        expect(samePartition(res.labels, truth), `${id} recovers ${K} separated blobs, seed ${seed}`).toBe(true);
        for (let i = 1; i < res.inertia.length; i++) expect(res.inertia[i], `${id} inertia never rises`).toBeLessThanOrEqual(res.inertia[i - 1] + 1e-6);
      }
      // on any input the result is a fixed point of Lloyd's step
      const input = makeInput('points', 'uniform', 300, seed);
      const res = run(k, input, { k: 6 }).outcome.result as { centres: Pt[]; labels: number[] };
      input.points.forEach((p, i) => {
        const d = res.centres.map((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2);
        expect(d[res.labels[i]], `${id} point ${i} is with its nearest centre`).toBeCloseTo(Math.min(...d), 6);
      });
      res.centres.forEach((c, j) => {
        const mine = input.points.filter((_, i) => res.labels[i] === j);
        if (!mine.length) return;
        expect(c.x).toBeCloseTo(mine.reduce((s, p) => s + p.x, 0) / mine.length, 6);
        expect(c.y).toBeCloseTo(mine.reduce((s, p) => s + p.y, 0) / mine.length, 6);
      });
    }
  },
  dbscan(k, id) {
    const cases: { pts: Pt[]; eps: number; minPts: number; truth?: number[] }[] = [];
    for (const seed of SEEDS) {
      const { pts, truth } = blobs(5, 50, seed);
      cases.push({ pts, eps: 40, minPts: 4, truth });
      for (const shape of ['clustered', 'uniform', 'lattice']) {
        for (const [eps, minPts] of [[30, 3], [45, 5], [90, 12]]) cases.push({ pts: makeInput('points', shape, 300, seed).points, eps, minPts });
      }
    }
    for (const c of cases) {
      const res = run(k, fromPoints(c.pts), { eps: c.eps, minPts: c.minPts }).outcome.result as { labels: number[] };
      const n = c.pts.length;
      const near = (i: number, j: number) => (c.pts[i].x - c.pts[j].x) ** 2 + (c.pts[i].y - c.pts[j].y) ** 2 <= c.eps * c.eps;
      const isCore = c.pts.map((_, i) => c.pts.filter((_, j) => near(i, j)).length >= c.minPts);
      // components of core points under the eps relation, by union-find
      const parent = c.pts.map((_, i) => i);
      const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (isCore[i] && isCore[j] && near(i, j)) parent[find(i)] = find(j);
      const coreIdx = c.pts.map((_, i) => i).filter((i) => isCore[i]);
      expect(samePartition(coreIdx.map((i) => res.labels[i]), coreIdx.map(find)), `${id} core clusters, eps ${c.eps}`).toBe(true);
      for (let i = 0; i < n; i++) {
        if (isCore[i]) continue;
        const owners = coreIdx.filter((j) => near(i, j)).map((j) => res.labels[j]);
        if (!owners.length) expect(res.labels[i], `${id} noise ${i}`).toBe(-1);
        else expect(owners, `${id} border ${i} joins a neighbouring core's cluster`).toContain(res.labels[i]);
      }
      if (c.truth) expect(samePartition(res.labels, c.truth), `${id} recovers separated blobs`).toBe(true);
    }
  },
  'closest-pair'(k, id) {
    for (const shape of ['uniform', 'clustered', 'circle', 'lattice']) {
      for (const n of [2, 3, 4, 5, 17, 100, 400]) {
        for (const seed of SEEDS) {
          const pts = makeInput('points', shape, n, seed).points;
          const got = run(k, fromPoints(pts)).outcome.result as { d: number; pair: [number, number] };
          let want = Infinity;
          for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) want = Math.min(want, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
          expect(got.d, `${id} ${shape} n=${n} seed=${seed}`).toBeCloseTo(want, 9);
          const [i, j] = got.pair;
          expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeCloseTo(want, 9);
        }
      }
    }
  },
  delaunay(k, id) {
    for (const shape of k.shapes ?? ['uniform']) {
      for (const n of [3, 4, 5, 12, 60, 250]) {
        for (const seed of SEEDS) {
          const pts = makeInput('points', shape, n, seed).points;
          const tris = (run(k, fromPoints(pts)).outcome.result as { triangles: [number, number, number][] }).triangles;
          const where = `${id} ${shape} n=${n} seed=${seed}`;
          const edges = new Map<string, number>();
          let area = 0;
          const used = new Set<number>();
          for (const [a, b, c] of tris) {
            expect(cross(pts[a], pts[b], pts[c]), `${where} counter-clockwise`).toBeGreaterThan(0);
            area += cross(pts[a], pts[b], pts[c]) / 2;
            for (const [u, v] of [[a, b], [b, c], [c, a]]) {
              expect(edges.has(`${u},${v}`), `${where} edge ${u}-${v} used twice the same way`).toBe(false);
              edges.set(`${u},${v}`, 1);
            }
            used.add(a); used.add(b); used.add(c);
            for (let d = 0; d < pts.length; d++) {
              if (d === a || d === b || d === c) continue;
              expect(inCircleExact(pts[a], pts[b], pts[c], pts[d]), `${where} point ${d} inside a circumcircle`).toBeLessThanOrEqual(0);
            }
          }
          expect(area, `${where} the triangles tile the hull`).toBeCloseTo(hullArea(pts), 6);
          expect(used.size, `${where} every point is a vertex`).toBe(pts.length);
        }
      }
    }
  },
  range(k, id) {
    for (const shape of ['uniform', 'clustered', 'lattice', 'circle']) {
      for (const n of [1, 2, 9, 60, 300]) {
        for (const q of [5, 30, 80]) {
          for (const seed of SEEDS) {
            const input = makeInput('points', shape, n, seed, { q });
            const params = { q, M: 5 };
            const res = run(k, input, params).outcome.result as { inside: number[]; nearest?: number; root?: TreeNode; M?: number; m?: number };
            const R = input.rect;
            const want = input.points.map((p, i) => [p, i] as const)
              .filter(([p]) => p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1).map(([, i]) => i);
            expect(res.inside.slice().sort((a, b) => a - b), `${id} ${shape} n=${n} q=${q} seed=${seed}`).toEqual(want);
            if (res.nearest !== undefined) {
              const d = (p: Pt) => Math.hypot(p.x - input.point.x, p.y - input.point.y);
              expect(d(input.points[res.nearest])).toBeCloseTo(Math.min(...input.points.map(d)), 9);
            }
            if (res.root) checkTree(res.root, input.points, res.M!, res.m!, `${id} ${shape} n=${n}`);
          }
        }
      }
    }
  },
  hexbin(k, id) {
    const SQ3 = Math.sqrt(3);
    for (const shape of ['uniform', 'clustered']) {
      for (const size of [12, 42, 100]) {
        const input = makeInput('points', shape, 500, 3);
        const res = run(k, input, { size }).outcome.result as { cells: [number, number][] };
        // the centres of a pointy-top lattice of radius `size`, searched by brute force near p
        input.points.forEach((p, i) => {
          let best = Infinity;
          const r0 = Math.round(p.y / (1.5 * size));
          for (let r = r0 - 2; r <= r0 + 2; r++) {
            const q0 = Math.round(p.x / (SQ3 * size) - r / 2);
            for (let q = q0 - 2; q <= q0 + 2; q++) best = Math.min(best, Math.hypot(p.x - SQ3 * size * (q + r / 2), p.y - 1.5 * size * r));
          }
          const [q, r] = res.cells[i];
          expect(Math.hypot(p.x - SQ3 * size * (q + r / 2), p.y - 1.5 * size * r), `${id} point ${i} size ${size}`).toBeCloseTo(best, 9);
        });
      }
    }
  },
  intersections(k, id) {
    const shapes = k.shapes ?? ['random', 'short', 'lattice-segments'];
    for (const shape of shapes) {
      for (const n of [2, 5, 20, 60]) {
        for (const seed of SEEDS) {
          const input = makeInput(k.input, shape, n, seed);
          const got = pairKeys(run(k, input).outcome.result as [number, number][]);
          expect(got, `${id} ${shape} n=${n} seed=${seed}`).toEqual(allPairs(input.segments).sort());
        }
      }
    }
  },
  inclusion(k, id) {
    for (const shape of ['star', 'comb']) {
      for (const m of [6, 20, 64]) {
        for (const seed of SEEDS) {
          const input = makeInput('polygon', shape, 200, seed, { m });
          const got = run(k, input, { m }).outcome.result as boolean[];
          const want = input.points.map((p) => winding(input.polygon, p) !== 0);
          expect(got, `${id} ${shape} m=${m} seed=${seed}`).toEqual(want);
          expect(want.some(Boolean) && want.some((x) => !x), 'the inputs have points both sides').toBe(true);
        }
      }
    }
  },
  'simple-polygon'(k, id) {
    for (const shape of ['uniform', 'clustered', 'circle', 'disk', 'lattice']) {
      for (const n of [3, 4, 9, 40, 150]) {
        for (const seed of SEEDS) {
          const input = makeInput('points', shape, n, seed);
          const path = run(k, input).outcome.result as Pt[];
          expect(new Set(path.map(key)), `${id} visits every point`).toEqual(new Set(input.points.map(key)));
          expect(path.length).toBe(input.points.length);
          const m = path.length;
          const edges: Seg[] = path.map((p, i) => ({ a: p, b: path[(i + 1) % m] }));
          for (let i = 0; i < m; i++) {
            for (let j = i + 1; j < m; j++) {
              const adjacent = j === i + 1 || (i === 0 && j === m - 1);
              if (!adjacent) {
                expect(segmentsMeet(edges[i], edges[j]), `${id} ${shape} n=${n} seed=${seed}: edges ${i} and ${j} cross`).toBe(false);
              } else if (m > 3) {
                // adjacent edges meet only at their common vertex: neither far end lies on the other edge
                const [e, f] = j === i + 1 ? [edges[i], edges[j]] : [edges[j], edges[i]];
                expect(segmentsMeet({ a: e.a, b: e.a }, f) || segmentsMeet({ a: f.b, b: f.b }, e), `${id} ${shape} n=${n} seed=${seed}: fold at ${i} of ${m}`).toBe(false);
              }
            }
          }
        }
      }
    }
  },
  hull(k, id) {
    for (const shape of ['uniform', 'clustered', 'circle', 'disk', 'lattice']) {
      for (const n of [1, 2, 3, 4, 7, 30, 120]) {
        for (const seed of SEEDS) {
          const input = makeInput('points', shape, n, seed);
          const h = run(k, input).outcome.result as Pt[];
          const want = bruteHull(input.points);
          expect(new Set(h.map(key)), `${id} ${shape} n=${n} seed=${seed}`).toEqual(want);
          expect(h.length, `${id} no repeated corner`).toBe(want.size);
          if (h.length >= 3) {
            for (let i = 0; i < h.length; i++) {
              expect(cross(h[i], h[(i + 1) % h.length], h[(i + 2) % h.length]), `${id} counter-clockwise`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
    // all collinear: the two ends
    const line = Array.from({ length: 9 }, (_, i) => ({ x: 100 + 10 * i, y: 50 + 5 * i }));
    expect(new Set((run(k, fromPoints(line)).outcome.result as Pt[]).map(key))).toEqual(new Set(['100,50', '180,90']));
  },
};

describe('geometry kernels', () => {
  it('every live geometry entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    const k = kernelOf(e.id);
    describe(e.id, () => {
      it('has a reference check for its task', () => {
        expect(CHECKS[k.task], `no reference for task ${k.task}`).toBeTypeOf('function');
      });
      it(`matches the independent reference for ${k.task}`, () => {
        CHECKS[k.task]?.(k, e.id);
      });
      it('counts its declared work and replays to its final counts', () => {
        const shape = (k.shapes ?? [])[0];
        const input = makeInput(k.input, shape ?? defaultShape(k), k.input === 'none' ? 0 : (k.n?.value ?? 50), 5);
        const params = Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));
        const t = record(k, input, params, 5);
        expect(t.frames.length).toBeGreaterThan(0);
        expect(t.frames[t.frames.length - 1].counts).toEqual(t.counts);
        expect(t.counts[k.counters[0][0]]).toBeGreaterThan(0);
      });
    });
  }
});

function defaultShape(k: GeometryKernel): string {
  return ({ points: 'uniform', segments: 'random', orthogonal: 'mixed', polygon: 'star', warehouse: 'warehouse', firms: 'firms', none: 'none' } as const)[k.input];
}
