import { dots, line, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';
import { base, finalHull, HULL_C, HULL_COUNTERS, HULL_N, HULL_SCALING, hullRows, trivial } from './_hull';

// The leftmost and rightmost points split the set by the line through them. On each side the
// point farthest from the line is a hull vertex; the points inside the triangle it makes are
// discarded, and the two outer groups are solved the same way.
export const kernel: GeometryKernel = {
  task: 'hull',
  input: 'points',
  n: HULL_N,
  counters: HULL_COUNTERS,
  scaling: HULL_SCALING,
  *run(g) {
    const pts = g.input.points;
    g.base(base(pts));
    const small = trivial(pts);
    if (small) return { result: small, rows: yield* hullRows(small, pts) };
    const lx = (p: Pt, q: Pt) => p.x < q.x || (p.x === q.x && p.y < q.y);
    let A = pts[0]; let B = pts[0];
    for (const p of pts) { if (lx(p, A)) A = p; if (lx(B, p)) B = p; }
    const edges: [Pt, Pt][] = [];
    const show = (tri: Pt[], set: Pt[]) => {
      g.frame(() => [...edges.map(([a, b]) => line(a, b, { c: HULL_C, w: 2 })),
        ...(tri.length === 3 ? [line(tri[0], tri[1], { c: 0.1, w: 1.5 }), line(tri[1], tri[2], { c: 0.1, w: 1.5 }),
          line(tri[0], tri[2], { a: 80 })] as Mark[] : []),
        ...dots(set, { c: 0.3, r: 2.5 })], 'farthest point splits the side');
    };
    // the counter-clockwise hull chain from P to Q (Q excluded) through the points S right of
    // P→Q, that is outside the hull found so far
    const side = function* (P: Pt, Q: Pt, S: Pt[]): Generator<unknown, Pt[]> {
      if (!S.length) { edges.push([P, Q]); show([], []); return [P]; }
      let C = S[0]; let best = -1;
      for (const p of S) {
        const d = -g.orient(P, Q, p);
        // on a tie, the point farthest along P→Q: an end of the tied run, so a corner
        const along = (u: Pt) => (u.x - P.x) * (Q.x - P.x) + (u.y - P.y) * (Q.y - P.y);
        if (d > best || (d === best && along(p) > along(C))) { best = d; C = p; }
      }
      show([P, C, Q], S);
      yield;
      const left: Pt[] = []; const right: Pt[] = [];
      for (const p of S) {
        if (p === C) continue;
        if (g.orient(P, C, p) < 0) left.push(p);
        else if (g.orient(C, Q, p) < 0) right.push(p);
      }
      const a = yield* side(P, C, left);
      const b = yield* side(C, Q, right);
      return [...a, ...b];
    };
    const upper: Pt[] = []; const lower: Pt[] = [];
    for (const p of pts) {
      if (p === A || p === B) continue;
      const d = g.orient(A, B, p);
      if (d > 0) upper.push(p); else if (d < 0) lower.push(p);
    }
    const h = A === B ? [A] : [...(yield* side(A, B, lower)), ...(yield* side(B, A, upper))];
    g.last(() => finalHull(h), 'hull closed');
    return { result: h, rows: g.recording ? yield* hullRows(h, pts) : [] };
  },
};
