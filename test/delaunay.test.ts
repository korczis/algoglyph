import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from '../src/core/random';
import { Delaunay, LATTICE, inCircle, orient } from '../src/plates/bowyer-watson-delaunay/bowyer';
import { scatter } from '../src/plates/bowyer-watson-delaunay/plate';

type Pt = [number, number];

// --- independent references: BigInt determinants, monotone-chain hull, edge bookkeeping ---

function orientBig(a: Pt, b: Pt, c: Pt): bigint {
  const [ax, ay, bx, by, cx, cy] = [...a, ...b, ...c].map(BigInt);
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function inCircleBig(a: Pt, b: Pt, c: Pt, d: Pt): bigint {
  // the 4×4 lifted determinant expanded directly, no translation to d
  const rows = [a, b, c, d].map(([x, y]) => [BigInt(x), BigInt(y), BigInt(x * x + y * y), 1n]);
  const det3 = (m: bigint[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  let det = 0n;
  for (let col = 0; col < 4; col++) {
    const minor = rows.slice(0, 3).map((r) => r.filter((_, j) => j !== col));
    // expand along the last row [dx, dy, d², 1]; sign (-1)^(3 + col)
    const sign = (3 + col) % 2 === 0 ? 1n : -1n;
    det += sign * rows[3][col] * det3(minor);
  }
  // positive when d is inside the circle through counter-clockwise a, b, c
  return det;
}

/** Andrew's monotone chain, strict (collinear points dropped). */
function hull(points: Pt[]): Pt[] {
  const ps = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of [...ps].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Points lying on the hull boundary, collinear ones included. */
function onHull(points: Pt[]): number {
  const h = hull(points);
  return points.filter((p) => h.some((a, i) => {
    const b = h[(i + 1) % h.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) === 0
      && Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0])
      && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
  })).length;
}

function twiceArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - a[1] * b[0];
  }
  return s;
}

function build(points: Pt[]): Delaunay {
  const d = new Delaunay();
  for (const [x, y] of points) d.insert(x, y);
  return d;
}

function tris(d: Delaunay): [number, number, number][] {
  const t = d.triangles();
  const out: [number, number, number][] = [];
  for (let i = 0; i < t.length; i += 3) out.push([t[i], t[i + 1], t[i + 2]]);
  return out;
}

function point(d: Delaunay, i: number): Pt {
  return [d.xs[i], d.ys[i]];
}

/** The mesh is a triangulation of the hull: oriented, edge-manifold, area-exact. */
function expectValid(d: Delaunay, points: Pt[]): void {
  const ts = tris(d);
  const directed = new Map<string, number>();
  let area = 0;
  for (const [a, b, c] of ts) {
    const o = orientBig(point(d, a), point(d, b), point(d, c));
    expect(o > 0n).toBe(true);
    area += Number(o);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = `${u},${v}`;
      expect(directed.has(key)).toBe(false);
      directed.set(key, 1);
    }
  }
  let boundary = 0;
  for (const key of directed.keys()) {
    const [u, v] = key.split(',');
    if (!directed.has(`${v},${u}`)) boundary++;
  }
  const unique = new Set(points.map(([x, y]) => `${x},${y}`)).size;
  const distinct = [...new Set(points.map(([x, y]) => `${x},${y}`))]
    .map((s) => s.split(',').map(Number) as Pt);
  expect(d.vertices).toBe(unique);
  if (ts.length === 0) return;
  expect(area).toBe(twiceArea(hull(distinct)));
  const h = onHull(distinct);
  expect(boundary).toBe(h);
  const c = d.counts();
  expect(c.triangles).toBe(ts.length);
  expect(c.hull).toBe(h);
  expect(c.edges).toBe((directed.size + boundary) / 2);
}

function randomPoints(n: number, seed: number, span = LATTICE): Pt[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => [Math.floor(rnd() * span), Math.floor(rnd() * span)]);
}

function smallestAngle(a: Pt, b: Pt, c: Pt): number {
  const ang = (p: Pt, q: Pt, r: Pt) => {
    const ux = q[0] - p[0];
    const uy = q[1] - p[1];
    const vx = r[0] - p[0];
    const vy = r[1] - p[1];
    return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
  };
  return Math.min(ang(a, b, c), ang(b, c, a), ang(c, a, b));
}

describe('Delaunay predicates', () => {
  it('orientation and in-circle signs are exact on the lattice', () => {
    const rnd = mulberry32(5);
    const r = () => Math.floor(rnd() * LATTICE);
    for (let i = 0; i < 4000; i++) {
      const pts: Pt[] = [[r(), r()], [r(), r()], [r(), r()], [r(), r()]];
      if (i % 4 === 0) pts[3] = [pts[0][0] + pts[1][0] - pts[2][0], pts[0][1]]; // near-ties
      if (pts[3][0] < 0 || pts[3][0] >= LATTICE) continue;
      const [a, b, c, d] = pts;
      expect(Math.sign(orient(...a, ...b, ...c))).toBe(Number(orientBig(a, b, c) > 0n)
        - Number(orientBig(a, b, c) < 0n));
      if (orientBig(a, b, c) <= 0n) continue;
      const big = inCircleBig(a, b, c, d);
      expect(Math.sign(inCircle(...a, ...b, ...c, ...d))).toBe(Number(big > 0n) - Number(big < 0n));
    }
    // extreme corners and an exact tie: four lattice points on x² + y² = 25², shifted
    const o = 2000;
    const circle: Pt[] = [[o + 25, o], [o + 7, o + 24], [o - 24, o + 7], [o - 15, o - 20]];
    expect(inCircle(...circle[0], ...circle[1], ...circle[2], ...circle[3])).toBe(0);
    expect(inCircleBig(circle[0], circle[1], circle[2], circle[3])).toBe(0n);
    const far: Pt[] = [[0, 0], [LATTICE - 1, 0], [LATTICE - 1, LATTICE - 1], [1, LATTICE - 2]];
    const big = inCircleBig(far[0], far[1], far[2], far[3]);
    expect(Math.sign(inCircle(...far[0], ...far[1], ...far[2], ...far[3])))
      .toBe(Number(big > 0n) - Number(big < 0n));
  });

  it('rejects points off the lattice', () => {
    const d = new Delaunay();
    expect(() => d.insert(-1, 0)).toThrow(RangeError);
    expect(() => d.insert(LATTICE, 0)).toThrow(RangeError);
    expect(() => d.insert(0.5, 3)).toThrow(RangeError);
  });
});

describe('Bowyer–Watson triangulation', () => {
  it('every circumcircle is empty of every point (brute force)', () => {
    for (const seed of [1, 2, 3, 4]) {
      const pts = randomPoints(220, seed);
      const d = build(pts);
      const ts = tris(d);
      expect(ts.length).toBeGreaterThan(0);
      for (const [a, b, c] of ts) {
        for (let i = 0; i < d.vertices; i++) {
          expect(inCircleBig(point(d, a), point(d, b), point(d, c), point(d, i)) <= 0n).toBe(true);
        }
      }
    }
  });

  it('makes 2n − 2 − h triangles and satisfies Euler with an independent hull', () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      const pts = randomPoints(150 + seed * 20, seed);
      const d = build(pts);
      const n = d.vertices;
      const h = onHull(pts);
      const { triangles, edges } = d.counts();
      expect(triangles).toBe(2 * n - 2 - h);
      expect(edges).toBe(3 * n - 3 - h);
      expect(n - edges + (triangles + 1)).toBe(2);
      const list = d.edges();
      expect(list.length / 4).toBe(edges);
      expect(list.filter((_, i) => i % 4 === 3 && list[i] === -1).length).toBe(h);
      expectValid(d, pts);
    }
  });

  it('no edge flip in a convex quadrilateral raises the minimum angle', () => {
    for (const seed of [21, 22, 23]) {
      const d = build(randomPoints(260, seed));
      const ts = tris(d);
      // adjacency rebuilt from the triangle list, independently of the mesh's own links
      const across = new Map<string, number>();
      for (const [a, b, c] of ts) {
        across.set(`${a},${b}`, c);
        across.set(`${b},${c}`, a);
        across.set(`${c},${a}`, b);
      }
      let flips = 0;
      for (const [key, c] of across) {
        const [a, b] = key.split(',').map(Number);
        const e = across.get(`${b},${a}`);
        if (e === undefined || a > b) continue;
        const [A, B, C, E] = [a, b, c, e].map((i) => point(d, i));
        // quad A, E, B, C is strictly convex iff the new diagonal C–E crosses A–B
        if (orientBig(C, E, A) === 0n || orientBig(C, E, B) === 0n) continue;
        if ((orientBig(C, E, A) > 0n) === (orientBig(C, E, B) > 0n)) continue;
        const before = Math.min(smallestAngle(A, B, C), smallestAngle(B, A, E));
        const after = Math.min(smallestAngle(C, E, A), smallestAngle(E, C, B));
        expect(after).toBeLessThanOrEqual(before + 1e-12);
        flips++;
      }
      expect(flips).toBeGreaterThan(ts.length);
    }
  });

  it('builds the same triangles in any insertion order (unique in general position)', () => {
    const pts = randomPoints(180, 31);
    const canon = (d: Delaunay) => tris(d).map((t) => t.map((i) => point(d, i).join(':'))
      .sort().join('|')).sort();
    const first = canon(build(pts));
    for (const seed of [32, 33]) {
      expect(canon(build(shuffle([...pts], mulberry32(seed))))).toEqual(first);
    }
  });

  it('walks a short way and tests a small cavity per insertion', () => {
    const d = build(randomPoints(1500, 41));
    const mean = d.visited / d.insertions;
    expect(mean).toBeGreaterThan(3);
    expect(mean).toBeLessThan(2 * Math.sqrt(1500));
  });
});

describe('degenerate inputs', () => {
  it('collinear points make no triangle, then fan out when one point leaves the line', () => {
    const line: Pt[] = Array.from({ length: 10 }, (_, i) => [100 + 37 * i, 200 + 11 * i]);
    const d = build(shuffle([...line], mulberry32(2)));
    expect(d.counts()).toEqual({ triangles: 0, edges: 9, hull: 0 });
    d.insert(900, 100);
    const all = [...line, [900, 100] as Pt];
    expect(d.counts().triangles).toBe(2 * 11 - 2 - 11);
    expectValid(d, all);
  });

  it('collinear points inserted into a mesh land on hull edges and their extensions', () => {
    const pts: Pt[] = [[0, 0], [1000, 0], [500, 800]];
    for (let i = 1; i < 20; i++) pts.push([i * 50, 0]); // on the hull edge
    for (let i = 1; i < 6; i++) pts.push([1000 + i * 200, 0]); // beyond it, still collinear
    const d = build(pts);
    expectValid(d, pts);
    expect(d.counts().triangles).toBe(2 * pts.length - 2 - onHull(pts));
  });

  it('duplicates are skipped and counted', () => {
    const pts = randomPoints(80, 51);
    const d = build([...pts, ...pts.slice(0, 30), [pts[0][0], pts[0][1]]]);
    expect(d.vertices).toBe(new Set(pts.map((p) => p.join(','))).size);
    expect(d.duplicates).toBe(31 + pts.length - d.vertices);
    expectValid(d, pts);
  });

  it('four cocircular points and a square grid keep a valid mesh', () => {
    const square: Pt[] = [[100, 100], [300, 100], [300, 300], [100, 300]];
    const d = build(square);
    expect(d.counts()).toEqual({ triangles: 2, edges: 5, hull: 4 });
    expectValid(d, square);

    const grid: Pt[] = [];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 6; j++) grid.push([200 + 60 * i, 300 + 60 * j]);
    const g = build(shuffle(grid, mulberry32(9)));
    expectValid(g, grid);
    expect(g.counts().triangles).toBe(2 * 42 - 2 - 22);
    for (const [a, b, c] of tris(g)) {
      for (let i = 0; i < g.vertices; i++) {
        expect(inCircleBig(point(g, a), point(g, b), point(g, c), point(g, i)) <= 0n).toBe(true);
      }
    }
  });

  it('points on one circle (all cocircular) triangulate their polygon', () => {
    const ring: Pt[] = [[2025, 2000], [2000, 2025], [1975, 2000], [2000, 1975], [2020, 2015],
      [2015, 2020], [1980, 2015], [1985, 2020], [1980, 1985], [2015, 1980], [2024, 2007],
      [2007, 2024]];
    const d = build(shuffle(ring, mulberry32(4)));
    expectValid(d, ring);
    expect(d.counts().triangles).toBe(ring.length - 2);
  });
});

describe('point distributions', () => {
  it('every distribution yields the requested count inside the canvas', () => {
    for (const kind of ['uniform', 'clustered', 'poisson', 'circle']) {
      const pts = scatter(kind, 500, 960, 600, mulberry32(8));
      expect(pts.length, kind).toBe(500);
      for (const [x, y] of pts) {
        expect(x >= 0 && x <= 960 && y >= 0 && y <= 600, kind).toBe(true);
      }
    }
  });

  it('Poisson-disc-like points keep their spacing', () => {
    const pts = scatter('poisson', 300, 960, 600, mulberry32(9));
    let closest = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        closest = Math.min(closest, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
      }
    }
    // dart throwing rejects any point closer than its radius, which starts at 0.72·√(area/n)
    expect(closest).toBeGreaterThan(0.5 * Math.sqrt((960 * 600) / 300));
  });
});
