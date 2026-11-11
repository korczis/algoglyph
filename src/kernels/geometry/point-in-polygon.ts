import { dots, line, poly, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';

// A ray from the query point to the right crosses the boundary an odd number of times exactly
// when the point is inside. An edge counts when it spans the ray's height half-open (one end
// strictly above, the other on or below), so a vertex on the ray is counted once; whether the
// crossing lies right of the point is one orientation test, with no division.
export const kernel: GeometryKernel = {
  task: 'inclusion',
  input: 'polygon',
  n: { min: 1, max: 600, value: 60, step: 1, label: 'Query points' },
  params: [{ kind: 'range', key: 'm', label: 'Polygon vertices', min: 6, max: 120, step: 2, value: 28 }],
  counters: [['edge', 'Edges examined'], ['orient', 'Orientation tests'], ['inside', 'Points inside']],
  scaling: [8, 16, 32, 64, 128, 256, 512],
  *run(g) {
    const P = g.input.polygon;
    const Q = g.input.points;
    const right = g.input.box.x1;
    g.base([poly(P, { close: true, fill: true, c: 0.6, a: 35 }), poly(P, { close: true, c: 0.6, w: 1.5 })]);
    const result: boolean[] = [];
    const inPts: Pt[] = []; const outPts: Pt[] = [];
    const settled = (): Mark[] => [...dots(inPts, { c: 0.85, r: 3 }), ...dots(outPts, { c: 0.1, r: 2.5, a: 200 })];
    for (const p of Q) {
      let odd = false;
      const hits: Pt[] = [];
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        g.count('edge');
        const a = P[j]; const b = P[i];
        const up = a.y <= p.y && b.y > p.y;
        const down = b.y <= p.y && a.y > p.y;
        if (!up && !down) continue;
        const o = g.orient(a, b, p);
        if ((up && o > 0) || (down && o < 0)) {
          odd = !odd;
          hits.push({ x: a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x), y: p.y });
        }
      }
      result.push(odd);
      yield;
      if (odd) { g.count('inside'); inPts.push(p); } else outPts.push(p);
      g.frame(() => [...settled(), line(p, { x: right, y: p.y }, { a: 160, w: 1 }), ...dots(hits, { r: 3.5 }),
        ...dots([p], { c: odd ? 0.85 : 0.1, r: 5 })], `${hits.length} crossing${hits.length === 1 ? '' : 's'}: ${odd ? 'inside' : 'outside'}`);
    }
    g.last(settled, 'every point classified');
    return { result, rows: [{ label: 'Inside / outside', value: `${inPts.length} / ${outPts.length}` }] };
  },
};
