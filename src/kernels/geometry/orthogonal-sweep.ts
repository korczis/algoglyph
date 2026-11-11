import { dots, line, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';
import { segMarks } from './_segments';

interface Node { y: number; s: number; lo: Node | null; hi: Node | null }

// A vertical line sweeps from left to right. A horizontal segment enters a binary search tree
// keyed by its y when the line reaches its left end and leaves at its right end; a vertical
// segment is a range query on that tree, reporting every horizontal segment whose y it spans.
export const kernel: GeometryKernel = {
  task: 'intersections',
  input: 'orthogonal',
  shapes: ['mixed'],
  n: { min: 2, max: 600, value: 60, step: 2, label: 'Segments' },
  counters: [['visit', 'Tree node visits'], ['pop', 'Events'], ['compare', 'Comparisons'], ['found', 'Intersections']],
  scaling: [16, 32, 64, 128, 256, 512, 1024],
  run(g) {
    const S = g.input.segments;
    const top = g.input.box.y1; const bottom = g.input.box.y0;
    g.base(segMarks(S, { a: 110, w: 1 }));
    type Ev = { x: number; kind: 0 | 1 | 2; s: number };
    const ev: Ev[] = [];
    S.forEach((s, i) => {
      if (s.a.y === s.b.y) ev.push({ x: Math.min(s.a.x, s.b.x), kind: 0, s: i }, { x: Math.max(s.a.x, s.b.x), kind: 2, s: i });
      else ev.push({ x: s.a.x, kind: 1, s: i });
    });
    ev.sort((p, q) => (g.less(p.x, q.x) ? -1 : g.less(q.x, p.x) ? 1 : p.kind - q.kind));
    let root: Node | null = null;
    const active = new Set<number>();
    const found: [number, number][] = [];
    const hits: Pt[] = [];
    const insert = (y: number, s: number) => {
      const made: Node = { y, s, lo: null, hi: null };
      if (!root) { root = made; return; }
      let nd: Node = root;
      for (;;) {
        g.count('visit');
        const low = g.less(y, nd.y);
        const next: Node | null = low ? nd.lo : nd.hi;
        if (!next) { if (low) nd.lo = made; else nd.hi = made; return; }
        nd = next;
      }
    };
    const remove = (y: number) => {
      let parent: Node | null = null;
      let nd: Node | null = root;
      while (nd && nd.y !== y) { g.count('visit'); g.count('compare'); parent = nd; nd = y < nd.y ? nd.lo : nd.hi; }
      if (!nd) return;
      g.count('visit');
      let repl: Node | null;
      if (!nd.lo) repl = nd.hi; else if (!nd.hi) repl = nd.lo; else {
        // Hibbard deletion: the successor takes the node's place
        let sp: Node = nd; let sc: Node = nd.hi;
        while (sc.lo) { g.count('visit'); sp = sc; sc = sc.lo; }
        if (sp !== nd) { sp.lo = sc.hi; sc.hi = nd.hi; }
        sc.lo = nd.lo;
        repl = sc;
      }
      if (!parent) root = repl; else if (parent.lo === nd) parent.lo = repl; else parent.hi = repl;
    };
    const query = (nd: Node | null, y0: number, y1: number, v: number) => {
      if (!nd) return;
      g.count('visit');
      const above = g.less(y0, nd.y);
      const below = g.less(nd.y, y1);
      if (above) query(nd.lo, y0, y1, v);
      if (!g.less(nd.y, y0) && !g.less(y1, nd.y)) {
        g.count('found');
        found.push([nd.s, v]);
        hits.push({ x: S[v].a.x, y: nd.y });
      }
      if (below) query(nd.hi, y0, y1, v);
    };
    const show = (x: number, cur: number): Mark[] => [line({ x, y: bottom }, { x, y: top }, { a: 160, w: 1.2 }),
      ...[...active].map((i) => line(S[i].a, S[i].b, { c: 0.8, w: 2 })), ...(cur >= 0 ? [line(S[cur].a, S[cur].b, { c: 0.15, w: 2.5 })] : []),
      ...dots(hits, { c: 0.15, r: 3.5 })];
    for (const e of ev) {
      g.count('pop');
      const s = S[e.s];
      if (e.kind === 0) { insert(s.a.y, e.s); active.add(e.s); } else if (e.kind === 2) { remove(s.a.y); active.delete(e.s); } else {
        query(root, Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y), e.s);
      }
      g.frame(() => show(e.x, e.kind === 1 ? e.s : -1), e.kind === 0 ? 'insert a horizontal' : e.kind === 2 ? 'remove a horizontal' : 'range query for a vertical');
    }
    g.last(() => dots(hits, { c: 0.15, r: 3.5 }), 'sweep complete');
    return { result: found, rows: [{ label: 'Intersections found', value: String(found.length) }] };
  },
};
