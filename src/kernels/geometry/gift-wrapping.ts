import { dots, line, poly, type GeometryKernel, type Pt } from '../../engines/geometry/trace';
import { anchorIndex, base, finalHull, HULL_C, HULL_COUNTERS, HULL_N, HULL_SCALING, hullRows,
  trivial } from './_hull';

// From the lowest point, take as the next vertex the point with every other point on its left;
// among collinear candidates the farthest, so the hull keeps only its corners. Each step scans
// all n points, so the work is n times the number of hull vertices.
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
    const start = pts[anchorIndex(pts)];
    const h: Pt[] = [];
    let p = start;
    do {
      h.push(p);
      let q = pts[0] === p ? pts[1] : pts[0];
      for (const r of pts) {
        if (r === p || r === q) continue;
        const o = g.orient(p, q, r);
        if (o < 0 || (o === 0 && g.dist2(p, r) > g.dist2(p, q))) q = r;
        {
          const a = p; const b = q; const c = r;
          g.frame(() => [poly(h, { c: HULL_C, w: 2 }), line(a, b, { c: HULL_C, w: 1.5, a: 200 }),
            line(a, c, { a: 90 }), ...dots([c], { r: 3.5 })], 'scan for the smallest turn');
        }
      }
      p = q;
      yield;
      if (h.length > pts.length) throw new Error('gift wrapping did not close');
    } while (p !== start);
    g.last(() => finalHull(h), 'hull closed');
    return { result: h, rows: g.recording ? yield* hullRows(h, pts) : [] };
  },
};
