import { dots, line, type GeometryKernel, type Pt } from '../../engines/geometry/trace';
import { intersects, meet, segMarks } from './_segments';

// Every pair of segments is tested with four orientation tests: two segments cross when each
// one's endpoints lie on opposite sides of the other's line, and touch when an endpoint lies on
// the other segment. No division and no slope, so vertical and collinear segments need no case.
export const kernel: GeometryKernel = {
  task: 'intersections',
  input: 'segments',
  n: { min: 2, max: 400, value: 40, step: 1, label: 'Segments' },
  counters: [['orient', 'Orientation tests'], ['pairs', 'Pairs tested'], ['found', 'Intersecting pairs']],
  scaling: [8, 16, 32, 64, 128, 256],
  run(g) {
    const S = g.input.segments;
    g.base(segMarks(S, { a: 120, w: 1 }));
    const found: [number, number][] = [];
    const marks: Pt[] = [];
    for (let i = 0; i < S.length; i++) {
      for (let j = i + 1; j < S.length; j++) {
        g.count('pairs');
        const hit = intersects(g, S[i], S[j]);
        if (hit) {
          g.count('found');
          found.push([i, j]);
          const m = meet(S[i], S[j]);
          marks.push(m ?? S[j].a);
        }
        g.frame(() => [line(S[i].a, S[i].b, { c: 0.85, w: 2.5 }), line(S[j].a, S[j].b, { c: hit ? 0.1 : 0.55, w: 2.5 }),
          ...dots(marks, { c: 0.1, r: 3.5 })], hit ? 'they intersect' : 'no intersection');
      }
    }
    g.last(() => dots(marks, { c: 0.1, r: 3.5 }), 'all pairs tested');
    return { result: found, rows: [{ label: 'Intersecting pairs found', value: String(found.length) }] };
  },
};
