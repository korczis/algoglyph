import { dots, line, rect, type GeometryKernel } from '../../engines/geometry/trace';

/** A range of at most this many points is solved by comparing every pair of it. */
const LEAF = 3;

// Sort by x once. Each half is solved recursively and returned sorted by y (a merge, as in
// mergesort); then only the points within the best distance of the dividing line can do better,
// and in y order each needs comparing only with the few that follow it within that distance.
export const kernel: GeometryKernel = {
  task: 'closest-pair',
  input: 'points',
  n: { min: 2, max: 2000, value: 160, step: 1 },
  // a larger leaf brute-forces more pairs (13 times the distances at 16 and 2000 points); the
  // range ends where the main-thread budget does (test/budget/geometry.test.ts measures its top)
  params: [{
    kind: 'range', key: 'leaf', label: 'Brute-force leaf size', min: 2, max: 16, step: 1, value: LEAF,
    hint: 'ranges of at most this many points compare every pair instead of splitting',
  }],
  counters: [['dist', 'Distance computations'], ['compare', 'Comparisons']],
  scaling: [64, 128, 256, 512, 1024, 2048, 4096],
  *run(g) {
    const pts = g.input.points;
    const B = g.input.box;
    const leaf = Math.max(2, Number(g.params.leaf ?? LEAF));
    g.base(dots(pts, { a: 150, r: 2 }));
    const idx = pts.map((_, i) => i).sort((a, b) => (g.less(pts[a].x, pts[b].x) ? -1 : g.less(pts[b].x, pts[a].x) ? 1 : pts[a].y - pts[b].y));
    let best = Infinity;
    let pair: [number, number] = [-1, -1];
    const consider = (i: number, j: number) => {
      const d = g.dist(pts[i], pts[j]);
      if (d < best) { best = d; pair = [i, j]; }
    };
    const bestMarks = () => (pair[0] >= 0 ? [line(pts[pair[0]], pts[pair[1]], { c: 0.05, w: 3 }), ...dots([pts[pair[0]], pts[pair[1]]], { c: 0.05, r: 4.5 })] : []);
    // solve idx[lo, hi), returning those indices sorted by y
    const solve = function* (lo: number, hi: number): Generator<unknown, number[]> {
      if (hi - lo <= leaf) {
        for (let i = lo; i < hi; i++) for (let j = i + 1; j < hi; j++) consider(idx[i], idx[j]);
        return idx.slice(lo, hi).sort((a, b) => pts[a].y - pts[b].y);
      }
      const mid = (lo + hi) >> 1;
      const cut = pts[idx[mid]].x;
      const L = yield* solve(lo, mid);
      const R = yield* solve(mid, hi);
      const merged: number[] = [];
      let i = 0; let j = 0;
      while (i < L.length || j < R.length) {
        if (j >= R.length || (i < L.length && !g.less(pts[R[j]].y, pts[L[i]].y))) merged.push(L[i++]); else merged.push(R[j++]);
      }
      const strip = merged.filter((k) => Math.abs(pts[k].x - cut) < best);
      for (let a = 0; a < strip.length; a++) {
        for (let b = a + 1; b < strip.length && pts[strip[b]].y - pts[strip[a]].y < best; b++) consider(strip[a], strip[b]);
      }
      const w = Number.isFinite(best) ? best : 0;
      const x0 = pts[idx[lo]].x; const x1 = pts[idx[hi - 1]].x;
      g.frame(() => [rect({ x0, y0: B.y0, x1, y1: B.y1 }, { fill: true, c: 0.6, a: 18 }),
        rect({ x0: cut - w, y0: B.y0, x1: cut + w, y1: B.y1 }, { fill: true, c: 0.3, a: 40 }),
        line({ x: cut, y: B.y0 }, { x: cut, y: B.y1 }, { c: 0.3, w: 1.5 }),
        ...dots(strip.map((k) => pts[k]), { c: 0.3, r: 3 }), ...bestMarks()], `combine ${hi - lo} points across the cut`);
      yield;
      return merged;
    };
    if (pts.length >= 2) yield* solve(0, pts.length);
    g.last(bestMarks, 'closest pair');
    return {
      result: { d: best, pair },
      rows: [{ label: 'Closest distance', value: Number.isFinite(best) ? best.toFixed(3) : '—' },
        { label: 'Brute force would compute', value: `${(pts.length * (pts.length - 1)) / 2} distances` }],
    };
  },
};
