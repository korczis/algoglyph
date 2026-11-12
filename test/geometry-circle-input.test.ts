// The On a circle point shape promises that every point is a corner of the convex hull: the
// notes of gift-wrapping, quickhull, graham-scan and interior-elimination rely on it. Checked
// here with exact integer (BigInt) orientation tests that share no code with the kernels.
import { describe, expect, it } from 'vitest';
import { H, makeInput, W } from '../src/engines/geometry/input';
import type { Pt } from '../src/engines/geometry/trace';
import { HULL_N } from '../src/kernels/geometry/_hull';

const SEEDS = [4242, 7, 1, 2, 3];
const SIZES = [3, 16, 160, 300, HULL_N.max];
const UNIT = 1024;

/** The point in units of 1/1024 as BigInts; fails if a coordinate is off that grid. */
function onGrid(p: Pt): [bigint, bigint] {
  const x = p.x * UNIT;
  const y = p.y * UNIT;
  expect(Number.isInteger(x) && Number.isInteger(y), `${p.x},${p.y} on the 1/1024 grid`).toBe(true);
  return [BigInt(x), BigInt(y)];
}

const orient = (a: [bigint, bigint], b: [bigint, bigint], c: [bigint, bigint]) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Indices of the points that are not strict corners: point p, between its angular neighbours
 * a and b about the centre, is a strict corner when p lies strictly on one side of line ab and
 * every other point strictly on the other. O(n²). */
function nonCorners(pts: Pt[]): number[] {
  const angle = (p: Pt) => Math.atan2(p.y - H / 2, p.x - W / 2);
  const order = pts.map((_, i) => i).sort((i, j) => angle(pts[i]) - angle(pts[j]));
  const g = pts.map(onGrid);
  const bad: number[] = [];
  const n = order.length;
  for (let k = 0; k < n; k++) {
    const a = order[(k + n - 1) % n]; const p = order[k]; const b = order[(k + 1) % n];
    const s = orient(g[a], g[b], g[p]);
    let ok = s !== 0n;
    for (let q = 0; q < n && ok; q++) {
      if (q === a || q === b || q === p) continue;
      const t = orient(g[a], g[b], g[q]);
      if (t === 0n || (t > 0n) === (s > 0n)) ok = false;
    }
    if (!ok) bad.push(p);
  }
  return bad;
}

describe('geometry input: On a circle', () => {
  for (const seed of SEEDS) {
    for (const n of SIZES) {
      it(`seed ${seed}, n = ${n}: n distinct points, every one a strict hull corner`, () => {
        const pts = makeInput('points', 'circle', n, seed).points;
        expect(pts.length).toBe(n);
        expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size, 'distinct').toBe(n);
        const bad = nonCorners(pts);
        expect(bad.map((i) => `${pts[i].x},${pts[i].y}`), 'points that are not strict corners').toEqual([]);
      });
    }
  }
});
