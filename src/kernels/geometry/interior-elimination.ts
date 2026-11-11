import { dots, poly, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';
import { anchorIndex, angularOrder, base, finalHull, grahamStack, HULL_COUNTERS, HULL_N,
  HULL_SCALING, hullRows, trivial } from './_hull';

// The points extreme in x + y and x - y are hull vertices; every point strictly inside their
// quadrilateral cannot be, so it is discarded with four orientation tests before Graham's scan
// runs on the survivors.
export const kernel: GeometryKernel = {
  task: 'hull',
  input: 'points',
  n: HULL_N,
  counters: [...HULL_COUNTERS, ['eliminated', 'Points eliminated']],
  scaling: HULL_SCALING,
  *run(g) {
    const pts = g.input.points;
    g.base(base(pts));
    const small = trivial(pts);
    if (small) return { result: small, rows: hullRows(small, pts) };
    const pick = (f: (p: Pt) => number) => pts.reduce((b, p) => (f(p) > f(b) ? p : b));
    // counter-clockwise: lowest x + y, highest x - y, highest x + y, lowest x - y
    const corners = [pick((p) => -(p.x + p.y)), pick((p) => p.x - p.y), pick((p) => p.x + p.y), pick((p) => p.y - p.x)]
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
    return { result: h, rows: [...hullRows(h, pts), { label: 'Survivors scanned', value: String(kept.length) }] };
  },
};
