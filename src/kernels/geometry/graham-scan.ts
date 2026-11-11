import type { GeometryKernel } from '../../engines/geometry/trace';
import { anchorIndex, angularOrder, base, finalHull, grahamStack, HULL_COUNTERS, HULL_N, HULL_SCALING,
  hullRows, trivial } from './_hull';

// Sort the points by angle around the lowest one, then walk them keeping a stack: every point
// that would make a right (or no) turn is popped, so the stack is always a convex chain.
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
    if (small) return { result: small, rows: hullRows(small, pts) };
    const o = pts[anchorIndex(pts)];
    const order = angularOrder(g, o, pts);
    yield;
    const h = yield* grahamStack(g, o, order);
    g.last(() => finalHull(h), 'hull closed');
    return { result: h, rows: hullRows(h, pts) };
  },
};
