// Shared by the hull kernels: the anchor, the angular order around it, Graham's stack, and an
// uncounted check of the finished hull (a readout, not part of the algorithm's work).
import type { Stat } from '../../core/plate';
import { dots, poly, type Geo, type Mark, type Pt } from '../../engines/geometry/trace';

export const HULL_COUNTERS: [string, string][] = [['orient', 'Orientation tests'], ['dist', 'Distance computations']];
export const HULL_SCALING = [32, 64, 128, 256, 512, 1024, 2048];
export const HULL_N = { min: 3, max: 2000, value: 160, step: 1 };
export const HULL_C = 0.82;

/** The lowest point, the leftmost of those: a hull vertex. */
export function anchorIndex(pts: Pt[]): number {
  let a = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y < pts[a].y || (pts[i].y === pts[a].y && pts[i].x < pts[a].x)) a = i;
  }
  return a;
}

/** The other points in counter-clockwise order around `o`, nearer first on a common ray.
 * Every point lies at an angle in [0, π) from the anchor, so one orientation test orders two. */
export function angularOrder(g: Geo, o: Pt, pts: Pt[]): Pt[] {
  return pts.filter((p) => p !== o).sort((a, b) => {
    const t = g.orient(o, a, b);
    if (t > 0) return -1;
    if (t < 0) return 1;
    return g.dist2(o, a) - g.dist2(o, b);
  });
}

/** Graham's scan over an angular order; drops collinear points, so only corners remain. */
export function* grahamStack(g: Geo, o: Pt, order: Pt[], extra: () => Mark[] = () => []): Generator<unknown, Pt[]> {
  const st: Pt[] = [o];
  for (const p of order) {
    while (st.length >= 2 && g.orient(st[st.length - 2], st[st.length - 1], p) <= 0) {
      const top = st.pop() as Pt;
      g.frame(() => [...extra(), poly(st, { c: HULL_C, w: 2 }), ...dots([top], { c: 0.05, r: 4 }), ...dots([p], { r: 4 })], 'pop: right turn');
    }
    st.push(p);
    g.frame(() => [...extra(), poly(st, { c: HULL_C, w: 2 }), ...dots([p], { c: HULL_C, r: 4 })], 'push');
    yield;
  }
  return st;
}

export function finalHull(h: Pt[], extra: Mark[] = []): Mark[] {
  return [...extra, poly(h, { close: true, fill: true, c: HULL_C, a: 40 }), poly(h, { close: true, c: HULL_C, w: 2 }),
    ...dots(h, { c: HULL_C, r: 3.5 })];
}

/** Uncounted check: every point is on or left of every hull edge. */
export function hullRows(h: Pt[], pts: Pt[]): Stat[] {
  let ok = h.length >= Math.min(3, pts.length);
  for (let i = 0; i < h.length && ok && h.length >= 3; i++) {
    const a = h[i]; const b = h[(i + 1) % h.length];
    for (const c of pts) if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0) { ok = false; break; }
  }
  return [
    { label: 'Hull vertices', value: String(h.length) },
    { label: 'Encloses every point', value: ok ? 'yes, checked edge by edge' : 'NO' },
  ];
}

export const base = (pts: Pt[]): Mark[] => dots(pts, { a: 150, r: 2 });

/** Trivial sets: fewer than three distinct points are their own hull. */
export function trivial(pts: Pt[]): Pt[] | null {
  return pts.length < 3 ? pts.slice() : null;
}
