import { dots, line, poly, type GeometryKernel } from '../../engines/geometry/trace';
import { anchorIndex, angularOrder } from './_hull';

// Sort the points by angle around the lowest one, nearer first on a common ray, and join them in
// that order: the polygon is star-shaped from the anchor, so it cannot cross itself. The points
// on the last ray are taken farthest first, or the closing edge would run back over them.
export const kernel: GeometryKernel = {
  task: 'simple-polygon',
  input: 'points',
  n: { min: 3, max: 1500, value: 60, step: 1 },
  counters: [['orient', 'Orientation tests'], ['dist', 'Distance computations']],
  scaling: [32, 64, 128, 256, 512, 1024, 2048],
  *run(g) {
    const pts = g.input.points;
    g.base(dots(pts, { a: 150, r: 2 }));
    if (pts.length < 3) return { result: pts.slice() };
    const o = pts[anchorIndex(pts)];
    const order = angularOrder(g, o, pts);
    yield;
    let k = order.length - 1;
    while (k > 0 && g.orient(o, order[order.length - 1], order[k - 1]) === 0) k--;
    const path = [o, ...order.slice(0, k), ...order.slice(k).reverse()];
    for (let i = 1; i <= path.length; i++) {
      yield;
      g.frame(() => [poly(path.slice(0, i), { c: 0.8, w: 2 }), line(o, path[i - 1], { a: 70 }),
        ...dots([path[i - 1]], { c: 0.8, r: 4 })], 'join in angular order');
    }
    g.last(() => [poly(path, { close: true, fill: true, c: 0.8, a: 40 }), poly(path, { close: true, c: 0.8, w: 2 }),
      ...dots([o], { c: 0.1, r: 5 })], 'closed');
    return { result: path, rows: [{ label: 'Vertices', value: String(path.length) }] };
  },
};
