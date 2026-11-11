import { dots, line, rect, type Box, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';
import { inBox, queryMarks, RANGE_PARAMS, type RangeResult } from './_range';

interface Node { i: number; axis: 0 | 1; cell: Box; lo: Node | null; hi: Node | null }

// A 2D tree built by insertion in input order: the root splits on x, its children on y, and so
// on, alternating. A key smaller than the node's goes low, anything else high. A rectangle query
// descends only into the sides the rectangle reaches; a nearest-neighbour query visits the near
// side first and the far side only while the splitting line is closer than the best so far.
export const kernel: GeometryKernel = {
  task: 'range',
  input: 'points',
  n: { min: 1, max: 800, value: 120, step: 1 },
  params: RANGE_PARAMS,
  counters: [['visit', 'Node visits'], ['compare', 'Key comparisons'], ['rangeVisit', 'Range query visits'],
    ['nearVisit', 'Nearest query visits'], ['dist', 'Distance computations']],
  scaling: [32, 64, 128, 256, 512, 1024, 2048],
  run(g) {
    const pts = g.input.points;
    const box = g.input.box;
    g.base(dots(pts, { a: 130, r: 2 }));
    const coord = (p: Pt, a: 0 | 1) => (a === 0 ? p.x : p.y);
    let root: Node | null = null;
    const all: Node[] = [];
    const split = (nd: Node): Mark => {
      const p = pts[nd.i];
      return nd.axis === 0 ? line({ x: p.x, y: nd.cell.y0 }, { x: p.x, y: nd.cell.y1 }, { c: 0.75, w: 1.2 })
        : line({ x: nd.cell.x0, y: p.y }, { x: nd.cell.x1, y: p.y }, { c: 0.35, w: 1.2 });
    };
    const tree = (): Mark[] => all.map(split);
    pts.forEach((p, i) => {
      let cell: Box = { ...box };
      let parent: Node | null = null;
      let low = false;
      let nd = root;
      while (nd) {
        g.count('visit');
        const q = pts[nd.i];
        parent = nd;
        low = g.less(coord(p, nd.axis), coord(q, nd.axis));
        const v = coord(q, nd.axis);
        if (nd.axis === 0) cell = low ? { ...cell, x1: v } : { ...cell, x0: v };
        else cell = low ? { ...cell, y1: v } : { ...cell, y0: v };
        nd = low ? nd.lo : nd.hi;
      }
      const made: Node = { i, axis: parent ? (parent.axis === 0 ? 1 : 0) : 0, cell, lo: null, hi: null };
      all.push(made);
      if (!parent) root = made; else if (low) parent.lo = made; else parent.hi = made;
      g.frame(() => [...tree(), ...dots([p], { c: 0.95, r: 4 })], 'insert: x and y alternate');
    });
    // rectangle query
    const R = g.input.rect;
    const inside: number[] = [];
    const seen: Box[] = [];
    const range = (nd: Node | null) => {
      if (!nd) return;
      g.count('visit'); g.count('rangeVisit');
      seen.push(nd.cell);
      const p = pts[nd.i];
      if (inBox(p, R)) inside.push(nd.i);
      g.frame(() => [...tree(), ...seen.map((c) => rect(c, { fill: true, c: 0.15, a: 14 })),
        ...queryMarks(R, inside.map((k) => pts[k]))], 'rectangle query');
      const v = coord(p, nd.axis);
      const lo = nd.axis === 0 ? R.x0 : R.y0;
      const hi = nd.axis === 0 ? R.x1 : R.y1;
      if (g.less(lo, v)) range(nd.lo);
      if (!g.less(hi, v)) range(nd.hi);
    };
    range(root);
    const found = inside.map((k) => pts[k]);
    // nearest neighbour
    const Q = g.input.point;
    let best = -1; let bestD = Infinity;
    const near = (nd: Node | null) => {
      if (!nd) return;
      g.count('visit'); g.count('nearVisit');
      const p = pts[nd.i];
      const d = g.dist2(Q, p);
      if (d < bestD) { bestD = d; best = nd.i; }
      const diff = coord(Q, nd.axis) - coord(p, nd.axis);
      const [first, second] = diff < 0 ? [nd.lo, nd.hi] : [nd.hi, nd.lo];
      const r = Math.sqrt(bestD); const b = best;
      g.frame(() => [...tree(), ...queryMarks(R, found), rect(nd.cell, { c: 0.95, w: 2 }),
        { t: 'o', x: Q.x, y: Q.y, rad: r, c: 0.95, w: 1.5 }, ...dots([Q], { c: 0.95, r: 4.5 }),
        ...(b >= 0 ? [line(Q, pts[b], { c: 0.95, w: 2 })] : [])], 'nearest neighbour');
      near(first);
      if (diff * diff < bestD) near(second);
    };
    near(root);
    const result: RangeResult = { inside, nearest: best < 0 ? undefined : best };
    g.last(() => [...tree(), ...queryMarks(R, found), ...dots([Q], { c: 0.95, r: 4.5 }),
      ...(best >= 0 ? [line(Q, pts[best], { c: 0.95, w: 2 }), { t: 'o' as const, x: Q.x, y: Q.y, rad: Math.sqrt(bestD), c: 0.95, w: 1.5 }] : [])],
      'both queries answered');
    return {
      result,
      rows: [
        { label: 'Points in the rectangle', value: String(inside.length) },
        { label: 'Nearest neighbour distance', value: best < 0 ? '—' : Math.sqrt(bestD).toFixed(1) },
      ],
    };
  },
};
