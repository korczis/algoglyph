// Every live geometry kernel of the catalogue, checked by one harness against references that
// share no code with the kernels: brute force, linear scans, closed forms and published values.
// A kernel is checked by the reference its `task` names (ADR 0004 §4).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type p5 from 'p5';
import { PALETTES } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine } from '../src/engines/geometry/index';
import { buildNow, Scaling, startBuild } from '../src/engines/geometry/build';
import { encode, fromEncoded, fromTrace } from '../src/engines/geometry/track';
import { krovak, krovakInverse, krovakSW } from '../src/kernels/geometry/_projections';
import { fromPoints, makeInput } from '../src/engines/geometry/input';
import { record, type GeometryKernel, type Input, type Pt, type Seg, type Task, type Warehouse } from '../src/engines/geometry/trace';

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

/** In-circle sign: positive when d is inside the circle through a, b, c. On the integer
 * coordinates of the inputs every product stays below 2^53, so the sign is exact. */
function inCircleExact(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const [ax, ay, bx, by, cx, cy] = [a.x - d.x, a.y - d.y, b.x - d.x, b.y - d.y, c.x - d.x, c.y - d.y];
  const det = (ax * ax + ay * ay) * (bx * cy - by * cx) - (bx * bx + by * by) * (ax * cy - ay * cx) + (cx * cx + cy * cy) * (ax * by - ay * bx);
  return Math.sign(det);
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

/** Great-circle distance from unit vectors (the chord), a formula independent of haversine. */
function chordKm(lat1: number, lon1: number, lat2: number, lon2: number, R: number): number {
  const v = (la: number, lo: number) => [Math.cos(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG)];
  const a = v(lat1, lon1); const b = v(lat2, lon2);
  const c = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return 2 * R * Math.asin(c / 2);
}
const DEG = Math.PI / 180;

/** Shortest walks in a single-block warehouse by Dijkstra over an explicit graph of aisle
 * segments and cross-aisle segments, then the best tour by trying every order of the picks. */
function bruteTour(w: Warehouse): number {
  const nodes: Pt[] = [];
  const id = (p: Pt) => { let i = nodes.findIndex((q) => q.x === p.x && q.y === p.y); if (i < 0) { nodes.push(p); i = nodes.length - 1; } return i; };
  const stops = [w.depot, ...w.picks.map((p) => ({ x: w.aisles[p.aisle], y: p.y }))].map(id);
  const edges: [number, number, number][] = [];
  w.aisles.forEach((x) => {
    const ys = [...new Set([0, w.length, ...nodes.filter((p) => p.x === x).map((p) => p.y)])].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) edges.push([id({ x, y: ys[i - 1] }), id({ x, y: ys[i] }), ys[i] - ys[i - 1]]);
  });
  for (const y of [0, w.length]) for (let i = 1; i < w.aisles.length; i++) edges.push([id({ x: w.aisles[i - 1], y }), id({ x: w.aisles[i], y }), w.aisles[i] - w.aisles[i - 1]]);
  const sp = (s: number) => {
    const d = nodes.map(() => Infinity); d[s] = 0;
    const done = new Set<number>();
    while (done.size < nodes.length) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || d[i] < d[u])) u = i;
      done.add(u);
      for (const [a, b, c] of edges) { if (a === u && d[u] + c < d[b]) d[b] = d[u] + c; if (b === u && d[u] + c < d[a]) d[a] = d[u] + c; }
    }
    return d;
  };
  const dist = stops.map((s) => { const d = sp(s); return stops.map((t) => d[t]); });
  let best = Infinity;
  const perm = (rest: number[], at: number, acc: number) => {
    if (acc >= best) return;
    if (!rest.length) { best = Math.min(best, acc + dist[at][0]); return; }
    rest.forEach((r, i) => perm([...rest.slice(0, i), ...rest.slice(i + 1)], r, acc + dist[at][r]));
  };
  perm(stops.map((_, i) => i).slice(1), 0, 0);
  return best;
}

const CHECKS: Partial<Record<Task, Check>> = {
  rings(k, id) {
    // published great-circle distances, to the kilometre, on the mean Earth radius
    const cities = { london: [51.5074, -0.1278], paris: [48.8566, 2.3522], newYork: [40.7128, -74.006] };
    const inp = makeInput('firms', 'firms', 0, 1);
    inp.centre = { lat: cities.london[0], lon: cities.london[1] };
    inp.firms = [cities.paris, cities.newYork, [51.5074, 179.8722], [-51.5074, 179.8722]].map(([lat, lon]) => ({ lat, lon, weight: 1 }));
    const r = run(k, inp).outcome.result as { distances: number[]; radius: number; rings: [number, number, number][] };
    expect(r.distances[0]).toBeGreaterThan(342); expect(r.distances[0]).toBeLessThan(345);
    expect(r.distances[1]).toBeGreaterThan(5565); expect(r.distances[1]).toBeLessThan(5575);
    // over the pole, and to the antipode: π R cos-free closed forms
    expect(r.distances[2]).toBeCloseTo(r.radius * (180 - 2 * 51.5074) * DEG, 6);
    expect(r.distances[3]).toBeCloseTo(r.radius * Math.PI, 6);
    for (const seed of SEEDS) {
      const input = makeInput('firms', 'firms', 80, seed);
      const res = run(k, input).outcome.result as { distances: number[]; radius: number; rings: [number, number, number][] };
      input.firms.forEach((f, i) => expect(res.distances[i], `${id} firm ${i}`).toBeCloseTo(chordKm(input.centre.lat, input.centre.lon, f.lat, f.lon, res.radius), 6));
      for (const [radius, count, h] of res.rings) {
        const w = input.firms.filter((_, i) => res.distances[i] <= radius).map((f) => f.weight);
        const tot = w.reduce((s, v) => s + v, 0);
        expect(count).toBe(w.length);
        expect(h, `${id} HHI at ${radius} km`).toBeCloseTo(w.reduce((s, v) => s + (100 * v / tot) ** 2, 0), 6);
      }
    }
    // the index's bounds: N equal firms give 10000 / N, one firm 10000
    const eq = makeInput('firms', 'firms', 0, 1);
    eq.firms = Array.from({ length: 8 }, (_, i) => ({ lat: eq.centre.lat + 0.01 * Math.cos(i), lon: eq.centre.lon + 0.01 * Math.sin(i), weight: 3 }));
    const rings = (run(k, eq).outcome.result as { rings: [number, number, number][] }).rings;
    expect(rings[rings.length - 1][2]).toBeCloseTo(10000 / 8, 6);
    eq.firms = eq.firms.slice(0, 1);
    expect((run(k, eq).outcome.result as { rings: [number, number, number][] }).rings[0][2]).toBeCloseTo(10000, 6);
  },
  projections(k, id) {
    const res = run(k, makeInput('none', 'none', 0, 1)).outcome.result as { nodes: { lat: number; h: number; k: number; angle: number }[][] };
    // Mercator on its sphere: k = h = sec φ exactly, and the graticule stays orthogonal
    for (const d of res.nodes[0]) {
      expect(d.k, `${id} Mercator k at ${d.lat}`).toBeCloseTo(1 / Math.cos(d.lat * DEG), 7);
      expect(d.h).toBeCloseTo(d.k, 7);
      expect(d.angle).toBeCloseTo(90, 6);
    }
    // Křovák is conformal: h = k and right angles at every node
    for (const d of res.nodes[1]) {
      expect(d.h / d.k, `${id} Křovák conformal at ${d.lat}`).toBeCloseTo(1, 7);
      expect(d.angle).toBeCloseTo(90, 5);
    }
    // the smallest scale is close to kP = 0.9999 (the pseudo standard parallel crosses the area)
    expect(Math.min(...res.nodes[1].map((d) => d.k))).toBeGreaterThan(0.9999 - 2e-6);
    expect(Math.min(...res.nodes[1].map((d) => d.k))).toBeLessThan(0.9999 + 2e-5);
  },
  'pick-path'(k, id) {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const n of [1, 2, 3, 5, 7]) {
        for (const aisles of [2, 5, 9]) {
          const input = makeInput('warehouse', 'warehouse', n, seed, { aisles });
          const w = input.warehouse!;
          const res = run(k, input, { aisles }).outcome.result as { routes: Pt[][]; lengths: number[] };
          const where = `${id} seed=${seed} n=${n} aisles=${aisles}`;
          expect(res.lengths[2], `${where} optimal`).toBeCloseTo(bruteTour(w), 9);
          res.routes.forEach((r, i) => {
            expect(r[0]).toEqual(w.depot);
            expect(r[r.length - 1]).toEqual(w.depot);
            let len = 0;
            for (let j = 1; j < r.length; j++) {
              const [a, b] = [r[j - 1], r[j]];
              const onAisle = a.x === b.x && w.aisles.includes(a.x);
              const onCross = a.y === b.y && (a.y === 0 || a.y === w.length);
              expect(onAisle || onCross, `${where} route ${i} leaves the aisles at step ${j}`).toBe(true);
              len += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            }
            expect(len).toBeCloseTo(res.lengths[i], 9);
            for (const p of w.picks) {
              const x = w.aisles[p.aisle];
              const hit = r.some((a, j) => j > 0 && a.x === x && r[j - 1].x === x && Math.min(a.y, r[j - 1].y) <= p.y && p.y <= Math.max(a.y, r[j - 1].y));
              expect(hit, `${where} route ${i} passes pick ${p.aisle}:${p.y}`).toBe(true);
            }
            expect(res.lengths[i] + 1e-9).toBeGreaterThanOrEqual(res.lengths[2]);
          });
        }
      }
    }
  },
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
            const inside = pts.filter((p, d) => d !== a && d !== b && d !== c && inCircleExact(pts[a], pts[b], pts[c], p) > 0);
            expect(inside, `${where} points inside the circumcircle of ${a} ${b} ${c}`).toEqual([]);
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
      }, 60_000);
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

/** Drive a plate headlessly: a p5 whose every member is a no-op, and a context that records. */
function drive(code: PlateCode, frames: number, thumbnail: boolean, over: Params = {}) {
  const calls = { shapes: 0 };
  const p = new Proxy({}, { get: () => (..._: unknown[]) => { calls.shapes++; } }) as unknown as p5;
  const params: Params = Object.fromEntries(code.params.map((d) => [d.key, d.value]));
  Object.assign(params, over);
  const rows: Stat[][] = []; const charts: Chart[] = [];
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: 11, rnd: mulberry32(11), theme: 'dark', bg: [0, 0, 0], fg: [255, 255, 255],
    palette: () => PALETTES[0], stats: (r) => rows.push(r), chart: (c) => charts.push(c), thumbnail,
  };
  const sim = code.create(p, ctx);
  sim.setup();
  for (let i = 0; i < frames; i++) sim.draw();
  return { rows, charts, calls };
}

describe('geometry plates draw', () => {
  for (const e of live) {
    it(`${e.id} mounts, replays to the end and publishes measured readouts`, () => {
      const code = engine.plate({ id: e.id, title: e.title, group: 'g' }, kernelOf(e.id));
      expect(code.id).toBe(e.id);
      expect(drive(code, 2, true).calls.shapes).toBeGreaterThan(0);
      const { rows, charts } = drive(code, 1500, false, { speed: 40, loop: false });
      const last = rows[rows.length - 1];
      expect(last.length).toBeGreaterThan(0);
      expect(last.find((r) => r.label === 'Progress')?.value).toMatch(/^100%/);
      for (const r of last) expect(r.value, `${e.id} ${r.label}`).not.toMatch(/NaN|undefined|NO\b/);
      for (const c of charts) for (const s of c.series) for (const [x, y] of s.points) expect(Number.isFinite(x) && Number.isFinite(y), `${e.id} chart ${c.title}`).toBe(true);
      if (kernelOf(e.id).scaling || charts.length) expect(charts.length).toBeGreaterThan(0);
    }, 60_000);
  }

  it('the hull lab ranks every hull kernel on one input', () => {
    const hulls = live.filter((e) => e.labs.includes('hulls'));
    const code = engine.lab('hulls', hulls.map((e) => ({ info: { id: e.id, title: e.title, group: 'g' }, kernel: kernelOf(e.id) })));
    drive(code, 2, true);
    const { rows, charts } = drive(code, 400, false, { budget: 20, loop: false });
    const last = rows[rows.length - 1];
    expect(last.map((r) => r.label).sort()).toEqual(hulls.map((e) => e.title).sort());
    for (const r of last) expect(r.value).toMatch(/finished #\d/);
    expect(charts[charts.length - 1].series.every((s) => s.points.length > 0)).toBe(true);
  }, 60_000);
});

describe('geometry runs built off the main thread', () => {
  // drawing-equivalent: absent, undefined and false options draw alike
  const norm = (m: object) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined && v !== false));
  for (const e of live) {
    it(`${e.id} replays the same from its transferable encoding`, () => {
      const k = kernelOf(e.id);
      const params = Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));
      const t = record(k, makeInput(k.input, (k.shapes ?? [])[0] ?? defaultShape(k), k.input === 'none' ? 0 : (k.n?.value ?? 50), 9, params), params, 9);
      const a = fromTrace(t);
      const b = fromEncoded(encode(t).enc);
      expect(b.length).toBe(a.length);
      for (let i = 0; i < a.length; i += Math.max(1, Math.floor(a.length / 25))) {
        expect(b.marks(i).map(norm), `${e.id} frame ${i}`).toEqual(a.marks(i).map(norm));
        expect(b.counts(i)).toEqual(a.counts(i));
        expect(b.note(i)).toBe(a.note(i));
      }
      expect(b.counts(b.length - 1)).toEqual(t.counts);
    });
  }
});

describe('Křovák against the EPSG worked example', () => {
  // EPSG Guidance Note 7-2, Krovak: 50°12'32.442"N 16°50'59.179"E (S-JTSK, Bessel 1841)
  const lat = 50 + 12 / 60 + 32.442 / 3600;
  const lon = 16 + 50 / 60 + 59.179 / 3600;
  it('projects to southing X = 1050538.63 m and westing Y = 568990.99 m', () => {
    const [X, Y] = krovakSW(lat, lon);
    expect(Math.abs(X - 1050538.63)).toBeLessThan(0.01);
    expect(Math.abs(Y - 568990.99)).toBeLessThan(0.01);
    expect(krovak(lat, lon)).toEqual([-Y, -X]);
  });
  it('inverts back to the same latitude and longitude', () => {
    const [E, N] = krovak(lat, lon);
    const [la, lo] = krovakInverse(E, N);
    expect(Math.abs(la - lat) * 3600).toBeLessThan(1e-6);
    expect(Math.abs(lo - lon) * 3600).toBeLessThan(1e-6);
  });
});

describe('geometry runs built in slices', () => {
  const norm = (m: object) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined && v !== false));
  for (const e of live) {
    it(`${e.id}: one step per frame gives the same run as building it at once`, () => {
      const k = kernelOf(e.id);
      const params = Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));
      const req = { id: e.id, kernel: k, shape: (k.shapes ?? [])[0] ?? defaultShape(k), n: k.input === 'none' ? 0 : (k.n?.value ?? 50), seed: 13, params };
      const whole = buildNow(req);
      const b = startBuild(req, false);
      let frames = 0;
      while (!b.track) { b.pump(0); frames++; }
      expect(frames, `${e.id} is resumable`).toBeGreaterThan(1);
      const t = b.track;
      expect(t.length).toBe(whole.length);
      expect(t.final).toEqual(whole.final);
      expect(t.rows).toEqual(whole.rows);
      for (let i = 0; i < t.length; i += Math.max(1, Math.floor(t.length / 20))) {
        expect(t.marks(i).map(norm)).toEqual(whole.marks(i).map(norm));
        expect(t.counts(i)).toEqual(whole.counts(i));
      }
    });
  }

  it('scaling points are counted operations, the same however the work is sliced', () => {
    for (const e of live.filter((x) => kernelOf(x.id).scaling)) {
      const k = kernelOf(e.id);
      const sizes = (k.scaling ?? []).slice(0, 3);
      const s = new Scaling(k, sizes, (k.shapes ?? [])[0] ?? defaultShape(k), 21, {});
      while (!s.done) s.pump(0);
      const want = sizes.map((n) => [n, record(k, makeInput(k.input, (k.shapes ?? [])[0] ?? defaultShape(k), n, 21 + n, {}), {}, 21 + n, false).counts[k.counters[0][0]]]);
      expect(s.points, e.id).toEqual(want);
    }
  });
});
