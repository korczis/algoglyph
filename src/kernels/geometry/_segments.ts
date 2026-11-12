// Segment helpers shared by the intersection kernels.
import type { Geo, Mark, Pt, Seg } from '../../engines/geometry/trace';
import { line } from '../../engines/geometry/trace';

/** Whether segments s and t share a point, from four orientation tests (all four are made). */
export function intersects(g: Geo, s: Seg, t: Seg): boolean {
  const o1 = Math.sign(g.orient(s.a, s.b, t.a));
  const o2 = Math.sign(g.orient(s.a, s.b, t.b));
  const o3 = Math.sign(g.orient(t.a, t.b, s.a));
  const o4 = Math.sign(g.orient(t.a, t.b, s.b));
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  // a zero means a point on the other segment's line: it touches when it lies within the segment
  const within = (p: Pt, q: Seg) => Math.min(q.a.x, q.b.x) <= p.x && p.x <= Math.max(q.a.x, q.b.x)
    && Math.min(q.a.y, q.b.y) <= p.y && p.y <= Math.max(q.a.y, q.b.y);
  return (o1 === 0 && within(t.a, s)) || (o2 === 0 && within(t.b, s))
    || (o3 === 0 && within(s.a, t)) || (o4 === 0 && within(s.b, t));
}

/** Where the lines of s and t meet (drawing only; null when parallel). */
export function meet(s: Seg, t: Seg): Pt | null {
  const rx = s.b.x - s.a.x; const ry = s.b.y - s.a.y;
  const qx = t.b.x - t.a.x; const qy = t.b.y - t.a.y;
  const d = rx * qy - ry * qx;
  if (d === 0) return null;
  const u = ((t.a.x - s.a.x) * qy - (t.a.y - s.a.y) * qx) / d;
  return { x: s.a.x + u * rx, y: s.a.y + u * ry };
}

export const segMarks = (segs: Seg[], o: { c?: number; a?: number; w?: number } = {}): Mark[] =>
  segs.map((s) => line(s.a, s.b, o));
