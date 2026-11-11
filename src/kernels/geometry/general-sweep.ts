import { dots, line, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';
import { Heap } from './_heap';
import { intersects, meet, segMarks } from './_segments';

interface Ev { x: number; y: number; kind: 0 | 1 | 2; s: number; t: number }

// Bentley and Ottmann's sweep. Events (left ends, right ends, crossings) leave a priority queue
// in x order; the status is the list of segments the sweep line cuts, ordered by height. Two
// segments can cross only after they become neighbours in that list, so only neighbours are
// tested: on insertion, on removal (the two that close up), and at a crossing (which swaps
// the pair and gives each a new neighbour).
export const kernel: GeometryKernel = {
  task: 'intersections',
  input: 'segments',
  shapes: ['short', 'random'],
  n: { min: 2, max: 300, value: 60, step: 1, label: 'Segments' },
  counters: [['orient', 'Orientation tests'], ['pop', 'Event pops'], ['compare', 'Status comparisons'], ['found', 'Crossings']],
  scaling: [16, 32, 64, 128, 256, 512, 1024],
  *run(g) {
    const S = g.input.segments;
    const top = g.input.box.y1; const bottom = g.input.box.y0;
    g.base(segMarks(S, { a: 110, w: 1 }));
    const yAt = (i: number, x: number) => {
      const s = S[i];
      return s.a.y + ((x - s.a.x) * (s.b.y - s.a.y)) / (s.b.x - s.a.x);
    };
    const q = new Heap<Ev>((a, b) => a.x < b.x || (a.x === b.x && (a.y < b.y || (a.y === b.y && a.kind < b.kind))));
    S.forEach((s, i) => {
      q.push({ x: s.a.x, y: s.a.y, kind: 0, s: i, t: -1 });
      q.push({ x: s.b.x, y: s.b.y, kind: 2, s: i, t: -1 });
    });
    const status: number[] = [];
    const scheduled = new Set<number>();
    const found: [number, number][] = [];
    const hits: Pt[] = [];
    const n = S.length;
    const test = (i: number, j: number, x: number) => {
      if (i < 0 || j < 0) return;
      const key = Math.min(i, j) * n + Math.max(i, j);
      if (scheduled.has(key)) return;
      if (!intersects(g, S[i], S[j])) return;
      const p = meet(S[i], S[j]);
      if (!p || p.x < x) return;
      scheduled.add(key);
      q.push({ x: p.x, y: p.y, kind: 1, s: i, t: j });
    };
    const at = (k: number) => (k >= 0 && k < status.length ? status[k] : -1);
    const show = (x: number, mark: Pt | null): Mark[] => [line({ x, y: bottom }, { x, y: top }, { a: 160, w: 1.2 }),
      ...status.map((i, k) => line(S[i].a, S[i].b, { c: status.length > 1 ? k / (status.length - 1) : 0.5, w: 2 })),
      ...dots(hits, { c: 0.05, r: 3.5 }), ...(mark ? dots([mark], { r: 5 }) : [])];
    let e: Ev | undefined;
    while ((e = q.pop())) {
      g.count('pop');
      const x = e.x;
      if (e.kind === 0) {
        // binary search for the first segment above the new left end
        let lo = 0; let hi = status.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (g.less(yAt(status[mid], x), e.y)) lo = mid + 1; else hi = mid;
        }
        status.splice(lo, 0, e.s);
        test(e.s, at(lo - 1), x);
        test(e.s, at(lo + 1), x);
      } else if (e.kind === 2) {
        const k = status.indexOf(e.s);
        status.splice(k, 1);
        test(at(k - 1), at(k), x);
      } else {
        found.push([e.s, e.t]);
        hits.push({ x: e.x, y: e.y });
        const i = status.indexOf(e.s); const j = status.indexOf(e.t);
        if (i < 0 || j < 0) continue; // a touch at an end already passed: general position excludes it
        const lo = Math.min(i, j); const hi = Math.max(i, j);
        [status[lo], status[hi]] = [status[hi], status[lo]];
        test(status[lo], at(lo - 1), x);
        test(status[hi], at(hi + 1), x);
      }
      const ex = e.x; const ey = e.y;
      g.frame(() => show(ex, { x: ex, y: ey }), e.kind === 0 ? 'left end: insert, test both neighbours' : e.kind === 2 ? 'right end: remove, test the pair that closes up' : 'crossing: swap, test the new neighbours');
      yield;
    }
    g.last(() => dots(hits, { c: 0.05, r: 3.5 }), 'sweep complete');
    return { result: found, rows: [{ label: 'Crossings found', value: String(found.length) }] };
  },
};
