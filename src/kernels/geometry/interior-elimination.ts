import { dots, poly, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';
import { anchorIndex, angularOrder, base, finalHull, grahamStack, HULL_COUNTERS, HULL_N,
  HULL_SCALING, hullRows, trivial } from './_hull';

// Directions in counter-clockwise order of angle: the point extreme in each is a hull vertex, and
// so the extremes, taken in that order, are the corners of a convex polygon inside the hull.
const FILTERS: Record<string, [number, number][]> = {
  // lowest x + y, highest x - y, highest x + y, lowest x - y
  diagonal: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  // lowest y, highest x, highest y, lowest x (Akl and Toussaint's quadrilateral)
  axis: [[0, -1], [1, 0], [0, 1], [-1, 0]],
  // both, interleaved
  octagon: [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
};

// The points extreme in x + y and x - y (or in x and y, or in all eight directions) are hull
// vertices; every point strictly inside their polygon cannot be, so it is discarded with one
// orientation test per corner before Graham's scan runs on the survivors.
export const kernel: GeometryKernel = {
  task: 'hull',
  input: 'points',
  n: HULL_N,
  params: [{
    kind: 'select', key: 'filter', label: 'Extremes', value: 'diagonal',
    options: [
      { value: 'diagonal', label: 'Diagonal quadrilateral (x + y, x − y)' },
      { value: 'axis', label: 'Axis quadrilateral (x, y)' },
      { value: 'octagon', label: 'Octagon (both)' },
    ],
  }],
  counters: [...HULL_COUNTERS, ['eliminated', 'Points eliminated']],
  scaling: HULL_SCALING,
  *run(g) {
    const pts = g.input.points;
    g.base(base(pts));
    const small = trivial(pts);
    if (small) return { result: small, rows: yield* hullRows(small, pts) };
    const pick = (f: (p: Pt) => number) => pts.reduce((b, p) => (f(p) > f(b) ? p : b));
    const dirs = FILTERS[String(g.params.filter ?? 'diagonal')] ?? FILTERS.diagonal;
    // counter-clockwise, a point extreme in two directions kept once
    const corners = dirs.map(([dx, dy]) => pick((p) => dx * p.x + dy * p.y))
      .filter((p, i, a) => a.indexOf(p) === i);
    const quad: Mark[] = corners.length >= 3 ? [poly(corners, { close: true, c: 0.1, w: 1.5 })] : [];
    const kept: Pt[] = [];
    const out: Pt[] = [];
    for (const p of pts) {
      let inside = corners.length >= 3;
      for (let i = 0; i < corners.length && inside; i++) {
        if (g.orient(corners[i], corners[(i + 1) % corners.length], p) <= 0) inside = false;
      }
      if (inside) { out.push(p); g.count('eliminated'); } else kept.push(p);
      g.frame(() => [...quad, ...dots(out, { c: 0.1, a: 200, r: 2.5 })], 'eliminate the interior');
      yield;
    }
    const dropped = out.slice();
    const extra = () => [...quad, ...dots(dropped, { c: 0.1, a: 120, r: 2 })];
    const o = kept[anchorIndex(kept)];
    const order = angularOrder(g, o, kept);
    yield;
    const h = yield* grahamStack(g, o, order, extra);
    g.last(() => finalHull(h, extra()), 'hull closed');
    return { result: h, rows: [...(g.recording ? yield* hullRows(h, pts) : []), { label: 'Survivors scanned', value: String(kept.length) }] };
  },
};
