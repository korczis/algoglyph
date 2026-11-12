// Seeded inputs for the geometry kernels. Point sets live on an integer grid, so that every
// orientation and in-circle test on them is exact in double precision; segment sets for the
// sweeps are in general position (real coordinates), the lattice set is deliberately degenerate.
import type { Params } from '../../core/plate';
import { gaussian, mulberry32 } from '../../core/random';
import type { Box, Firm, Input, InputKind, Pt, Seg, Warehouse } from './trace';

export const W = 1600;
export const H = 1000;
export const BOX: Box = { x0: 0, y0: 0, x1: W, y1: H };
const M = 40;

export const SHAPE_LABELS: Record<string, string> = {
  uniform: 'Uniform',
  clustered: 'Clustered',
  circle: 'On a circle',
  disk: 'In a disk',
  lattice: 'Lattice (collinear)',
  random: 'Long segments',
  short: 'Short segments',
  'lattice-segments': 'Lattice (touching, collinear)',
  mixed: 'Horizontal and vertical',
  star: 'Star-shaped polygon',
  comb: 'Comb polygon',
  warehouse: 'Single-block warehouse',
  firms: 'Synthetic competitors',
  none: 'Fixed graticule',
};

export const DEFAULT_SHAPES: Record<InputKind, string[]> = {
  points: ['uniform', 'clustered', 'circle', 'disk', 'lattice'],
  segments: ['random', 'short', 'lattice-segments'],
  orthogonal: ['mixed'],
  polygon: ['star', 'comb'],
  warehouse: ['warehouse'],
  firms: ['firms'],
  none: ['none'],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const orient = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** n distinct points of the named shape (fewer if the shape has fewer positions), on the integer
 * grid. On a circle uses a grid of 1/1024, on which orientation tests are still exact (43 bits).
 * Rounding to that grid alone does not keep every point a corner: two near neighbours can pull
 * a point a hair inside their chord (seed 4242 at n = 160 lost one). So the circle keeps its
 * points as a ring in angular order about the centre, and a rounded point joins only if the
 * three turns it touches (before it, at it, after it) are strictly left, by the exact test;
 * otherwise it is rejected and the next seeded draw is tried. The ring starts as a triangle,
 * which is convex, and each such insertion leaves the total turning unchanged, so the ring
 * stays a strictly convex polygon and every point is a strict hull corner. */
export function points(shape: string, n: number, rnd: () => number): Pt[] {
  const seen = new Set<string>();
  const out: Pt[] = [];
  const unit = shape === 'circle' ? 1024 : 1;
  const ring: { p: Pt; t: number }[] = [];
  const convexWith = (p: Pt): boolean => {
    const t = Math.atan2(p.y - H / 2, p.x - W / 2);
    let i = 0;
    while (i < ring.length && ring[i].t < t) i++;
    const m = ring.length;
    const at = (k: number) => ring[((k % m) + m) % m].p;
    // p goes between at(i - 1) and at(i)
    const ok = m < 2 || (orient(at(i - 1), p, at(i)) > 0
      && (m < 3 || (orient(at(i - 2), at(i - 1), p) > 0 && orient(p, at(i), at(i + 1)) > 0)));
    if (ok) ring.splice(i, 0, { p, t });
    return ok;
  };
  const add = (x: number, y: number) => {
    const X = Math.round(clamp(x, M, W - M) * unit) / unit;
    const Y = Math.round(clamp(y, M, H - M) * unit) / unit;
    const key = `${X},${Y}`;
    if (seen.has(key)) return;
    if (shape === 'circle' && !convexWith({ x: X, y: Y })) return;
    seen.add(key);
    out.push({ x: X, y: Y });
  };
  if (shape === 'lattice') {
    // a coarse integer lattice, about 1.5 positions per point: rich in collinear triples
    const step = Math.max(6, Math.floor(Math.sqrt(((W - 4 * M) * (H - 4 * M)) / (1.5 * Math.max(1, n)))));
    const cells: Pt[] = [];
    for (let x = 2 * M; x <= W - 2 * M; x += step) for (let y = 2 * M; y <= H - 2 * M; y += step) cells.push({ x, y });
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (const c of cells.slice(0, n)) add(c.x, c.y);
    return out;
  }
  const centres: { x: number; y: number; s: number }[] = [];
  if (shape === 'clustered') {
    const k = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < k; i++) {
      centres.push({ x: 200 + rnd() * (W - 400), y: 160 + rnd() * (H - 320), s: 35 + rnd() * 60 });
    }
  }
  let tries = 0;
  while (out.length < n && tries++ < n * 50) {
    if (shape === 'circle') {
      const t = rnd() * 2 * Math.PI;
      add(W / 2 + 440 * Math.cos(t), H / 2 + 440 * Math.sin(t));
    } else if (shape === 'disk') {
      const t = rnd() * 2 * Math.PI;
      const r = 440 * Math.sqrt(rnd());
      add(W / 2 + r * Math.cos(t), H / 2 + r * Math.sin(t));
    } else if (shape === 'clustered') {
      if (rnd() < 0.06) add(M + rnd() * (W - 2 * M), M + rnd() * (H - 2 * M));
      else {
        const c = centres[Math.floor(rnd() * centres.length)];
        add(c.x + c.s * gaussian(rnd), c.y + c.s * gaussian(rnd));
      }
    } else add(M + rnd() * (W - 2 * M), M + rnd() * (H - 2 * M));
  }
  return out;
}

/** n segments. Real-valued shapes are in general position and never vertical. */
export function segments(shape: string, n: number, rnd: () => number): Seg[] {
  const out: Seg[] = [];
  if (shape === 'lattice-segments') {
    const step = 100;
    const nx = Math.floor((W - 2 * M) / step);
    const ny = Math.floor((H - 2 * M) / step);
    while (out.length < n) {
      const a = { x: M + step * Math.floor(rnd() * (nx + 1)), y: M + step * Math.floor(rnd() * (ny + 1)) };
      const dx = Math.floor(rnd() * 7) - 3;
      const dy = Math.floor(rnd() * 7) - 3;
      if (!dx && !dy) continue;
      const b = { x: clamp(a.x + dx * step, M, M + nx * step), y: clamp(a.y + dy * step, M, M + ny * step) };
      if (b.x === a.x && b.y === a.y) continue;
      out.push({ a, b });
    }
    return out;
  }
  const maxLen = shape === 'short' ? 160 : 700;
  while (out.length < n) {
    const a = { x: M + rnd() * (W - 2 * M), y: M + rnd() * (H - 2 * M) };
    const t = rnd() * 2 * Math.PI;
    const len = 30 + rnd() * (maxLen - 30);
    const b = { x: a.x + len * Math.cos(t), y: a.y + len * Math.sin(t) };
    // rejected rather than clamped: clamping would put ends on a common border line
    if (b.x < M || b.x > W - M || b.y < M || b.y > H - M || Math.abs(b.x - a.x) < 1e-3) continue;
    out.push(a.x < b.x ? { a, b } : { a: b, b: a });
  }
  return out;
}

/** n horizontal and vertical segments with real coordinates, so no two share an x or a y. */
export function orthogonal(n: number, rnd: () => number): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const len = 60 + rnd() * 480;
    if (i % 2 === 0) {
      const x = M + rnd() * (W - 2 * M - len);
      const y = M + rnd() * (H - 2 * M);
      out.push({ a: { x, y }, b: { x: x + len, y } });
    } else {
      const l = Math.min(len, H - 2 * M - 1);
      const x = M + rnd() * (W - 2 * M);
      const y = M + rnd() * (H - 2 * M - l);
      out.push({ a: { x, y }, b: { x, y: y + l } });
    }
  }
  return out;
}

/** A simple polygon: star-shaped about the centre, or a comb with teeth of seeded depth. */
export function polygon(shape: string, m: number, rnd: () => number): Pt[] {
  if (shape === 'comb') {
    const teeth = Math.max(2, Math.round(m / 4));
    const x0 = 160.5; const x1 = W - 160.5;
    const w = (x1 - x0) / (2 * teeth - 1);
    // counter-clockwise: along the base, then up and down each tooth from right to left
    const pts: Pt[] = [{ x: x0, y: 120.5 }, { x: x1, y: 120.5 }];
    for (let i = teeth - 1; i >= 0; i--) {
      const l = x0 + 2 * i * w;
      const top = H - 120 - rnd() * 200;
      const gap = 260 + rnd() * 300;
      pts.push({ x: l + w, y: top }, { x: l, y: top });
      if (i > 0) pts.push({ x: l, y: gap }, { x: l - w, y: gap });
    }
    return pts;
  }
  const angles = Array.from({ length: m }, () => rnd() * 2 * Math.PI).sort((a, b) => a - b);
  return angles.map((t) => {
    const r = 140 + rnd() * 330;
    return { x: W / 2 + r * Math.cos(t) * 1.45, y: H / 2 + r * Math.sin(t) };
  });
}

export function warehouse(picks: number, aisles: number, rnd: () => number): Warehouse {
  const gap = 150;
  const xs = Array.from({ length: aisles }, (_, i) => 120 + i * gap);
  const length = 640;
  const p: Warehouse['picks'] = [];
  const used = new Set<string>();
  while (p.length < picks) {
    const aisle = Math.floor(rnd() * aisles);
    const y = 20 + Math.round(rnd() * (length - 40));
    const key = `${aisle}:${y}`;
    if (used.has(key)) continue;
    used.add(key);
    p.push({ aisle, y });
  }
  return { aisles: xs, length, rack: 45, depot: { x: xs[0], y: 0 }, picks: p };
}

/** Synthetic competitors around a centre: seeded bearings, distances and sizes. */
export function firms(n: number, centre: { lat: number; lon: number }, rnd: () => number): Firm[] {
  const R = 6371.0088;
  const out: Firm[] = [];
  for (let i = 0; i < n; i++) {
    const near = rnd() < 0.55;
    const d = near ? 1 + rnd() * 14 : 15 + rnd() * 45;
    const t = rnd() * 2 * Math.PI;
    // destination point on the sphere from the centre, bearing t, distance d
    const p1 = (centre.lat * Math.PI) / 180;
    const l1 = (centre.lon * Math.PI) / 180;
    const dr = d / R;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(t));
    const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
    out.push({ lat: (p2 * 180) / Math.PI, lon: (l2 * 180) / Math.PI, weight: Math.exp(1.1 * gaussian(rnd)) });
  }
  return out;
}

export const CENTRE = { lat: 50.0875, lon: 14.4214 };

const empty = (kind: InputKind, shape: string, n: number): Input => ({
  kind, shape, n, box: BOX, points: [], segments: [], polygon: [],
  rect: { x0: 0, y0: 0, x1: 0, y1: 0 }, point: { x: 0, y: 0 }, warehouse: null, firms: [], centre: CENTRE,
});

/** The seeded input of a kind and shape; `params` may carry `q` (query size, % of the box),
 * `m` (polygon vertices) and `aisles`. */
export function makeInput(kind: InputKind, shape: string, n: number, seed: number, params: Params = {}): Input {
  const rnd = mulberry32(seed);
  const inp = empty(kind, shape, n);
  if (kind === 'points') inp.points = points(shape, n, rnd);
  else if (kind === 'segments') inp.segments = segments(shape, n, rnd);
  else if (kind === 'orthogonal') inp.segments = orthogonal(n, rnd);
  else if (kind === 'polygon') {
    inp.polygon = polygon(shape, Number(params.m ?? 24), rnd);
    inp.points = points('uniform', n, rnd);
  } else if (kind === 'warehouse') {
    const w = warehouse(n, Number(params.aisles ?? 8), rnd);
    inp.warehouse = w;
    inp.box = { x0: w.aisles[0] - 100, y0: -60, x1: w.aisles[w.aisles.length - 1] + 100, y1: w.length + 60 };
  } else if (kind === 'firms') inp.firms = firms(n, CENTRE, rnd);
  const q = Number(params.q ?? 30) / 100;
  const qw = W * q * (0.7 + 0.6 * rnd());
  const qh = H * q * (0.7 + 0.6 * rnd());
  const x0 = M + rnd() * (W - 2 * M - qw);
  const y0 = M + rnd() * (H - 2 * M - qh);
  inp.rect = { x0, y0, x1: x0 + qw, y1: y0 + qh };
  inp.point = { x: M + rnd() * (W - 2 * M), y: M + rnd() * (H - 2 * M) };
  return inp;
}

/** An input made of given points (tests build their own sets with it). */
export function fromPoints(pts: Pt[], extra: Partial<Input> = {}): Input {
  return { ...empty('points', 'custom', pts.length), points: pts, ...extra };
}
