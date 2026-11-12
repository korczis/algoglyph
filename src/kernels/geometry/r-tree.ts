import { dots, rect, type Box, type GeometryKernel, type Mark } from '../../engines/geometry/trace';
import { inBox, queryMarks, RANGE_PARAMS, type RangeResult } from './_range';

export interface RNode { leaf: boolean; box: Box; kids: RNode[]; items: number[] }

const area = (b: Box) => (b.x1 - b.x0) * (b.y1 - b.y0);
const join = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
const meets = (a: Box, b: Box) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

// Guttman's R-tree with the quadratic split. A point goes down to the leaf whose rectangle grows
// least to take it; a node that overflows M entries splits in two, seeded by the pair of entries
// that would waste the most area together, and the split can climb to the root, which is how the
// tree grows: at the top, so every leaf stays at the same depth.
export const kernel: GeometryKernel = {
  task: 'range',
  input: 'points',
  n: { min: 1, max: 800, value: 150, step: 1 },
  params: [
    ...RANGE_PARAMS,
    { kind: 'range', key: 'M', label: 'Entries per node (M)', min: 4, max: 16, step: 1, value: 6 },
    // at most 0.5, so 2m ≤ M + 1: both groups of a split can reach m
    { kind: 'range', key: 'fill', label: 'Minimum fill (fraction of M)', min: 0.2, max: 0.5, step: 0.05, value: 0.4 },
  ],
  counters: [['visit', 'Node visits'], ['area', 'Area computations'], ['split', 'Node splits'], ['rangeVisit', 'Range query visits'], ['box', 'Rectangle tests']],
  scaling: [32, 64, 128, 256, 512, 1024, 2048],
  *run(g) {
    const pts = g.input.points;
    const M = Math.max(4, Number(g.params.M ?? 6));
    const m = Math.max(2, Math.floor(M * Math.min(0.5, Number(g.params.fill ?? 0.4))));
    g.base(dots(pts, { a: 130, r: 2 }));
    const pbox = (i: number): Box => ({ x0: pts[i].x, y0: pts[i].y, x1: pts[i].x, y1: pts[i].y });
    const boxes = (nd: RNode): Box[] => (nd.leaf ? nd.items.map(pbox) : nd.kids.map((k) => k.box));
    const tight = (nd: RNode) => { nd.box = boxes(nd).reduce(join); };
    const grow = (a: Box, b: Box) => { g.count('area', 2); return area(join(a, b)) - area(a); };
    let root: RNode | null = null;
    let depth = 0;
    const split = (nd: RNode): RNode => {
      g.count('split');
      const bs = boxes(nd);
      const ents = nd.leaf ? nd.items.slice() : nd.kids.slice();
      // pick seeds: the pair whose joint rectangle wastes the most area
      let s1 = 0; let s2 = 1; let worst = -Infinity;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        g.count('area', 3);
        const d = area(join(bs[i], bs[j])) - area(bs[i]) - area(bs[j]);
        if (d > worst) { worst = d; s1 = i; s2 = j; }
      }
      const A = [s1]; const Bg = [s2];
      let ba = bs[s1]; let bb = bs[s2];
      const rest = bs.map((_, i) => i).filter((i) => i !== s1 && i !== s2);
      while (rest.length) {
        if (A.length + rest.length === m) { A.push(...rest.splice(0)); break; }
        if (Bg.length + rest.length === m) { Bg.push(...rest.splice(0)); break; }
        // pick next: the entry with the strongest preference for one group
        let pick = 0; let pref = -1; let da = 0; let db = 0;
        rest.forEach((e, k) => {
          const x = grow(ba, bs[e]); const y = grow(bb, bs[e]);
          if (Math.abs(x - y) > pref) { pref = Math.abs(x - y); pick = k; da = x; db = y; }
        });
        const e = rest.splice(pick, 1)[0];
        const toA = da < db || (da === db && (area(ba) < area(bb) || (area(ba) === area(bb) && A.length <= Bg.length)));
        if (toA) { A.push(e); ba = join(ba, bs[e]); } else { Bg.push(e); bb = join(bb, bs[e]); }
      }
      const sib: RNode = { leaf: nd.leaf, box: bb, kids: [], items: [] };
      if (nd.leaf) {
        nd.items = A.map((i) => ents[i] as number);
        sib.items = Bg.map((i) => ents[i] as number);
      } else {
        nd.kids = A.map((i) => ents[i] as RNode);
        sib.kids = Bg.map((i) => ents[i] as RNode);
      }
      tight(nd);
      tight(sib);
      return sib;
    };
    // insert point i under nd; returns a new sibling when nd split
    const insert = (nd: RNode, i: number): RNode | null => {
      g.count('visit');
      const b = pbox(i);
      nd.box = join(nd.box, b);
      if (nd.leaf) {
        nd.items.push(i);
      } else {
        let best = nd.kids[0]; let bestGrow = Infinity;
        for (const k of nd.kids) {
          const d = grow(k.box, b);
          if (d < bestGrow || (d === bestGrow && area(k.box) < area(best.box))) { bestGrow = d; best = k; }
        }
        const sib = insert(best, i);
        if (sib) nd.kids.push(sib);
      }
      const size = nd.leaf ? nd.items.length : nd.kids.length;
      if (size <= M) return null;
      return split(nd);
    };
    const marks = (): Mark[] => {
      const out: Mark[] = [];
      const walk = (nd: RNode, level: number) => {
        const c = depth ? level / depth : 0.5;
        out.push(rect(nd.box, { c, w: 1 + 1.5 * (1 - c), a: 220 }));
        if (!nd.leaf) for (const k of nd.kids) walk(k, level + 1);
      };
      if (root) walk(root, 0);
      return out;
    };
    for (const [i, p] of pts.entries()) {
      if (!root) { root = { leaf: true, box: pbox(i), kids: [], items: [i] }; g.count('visit'); } else {
        const sib = insert(root, i);
        if (sib) {
          const r: RNode = { leaf: false, box: join(root.box, sib.box), kids: [root, sib], items: [] };
          root = r;
          depth++;
        }
      }
      g.frame(() => [...marks(), ...dots([p], { c: 0.95, r: 4 })], 'insert where the rectangle grows least');
      yield;
    }
    const R = g.input.rect;
    const inside: number[] = [];
    const hits: Box[] = [];
    const search = function* (nd: RNode): Generator<unknown, void> {
      g.count('visit'); g.count('rangeVisit');
      hits.push(nd.box);
      g.frame(() => [...marks(), ...hits.map((b) => rect(b, { fill: true, c: 0.15, a: 22 })), ...queryMarks(R, inside.map((k) => pts[k]))], 'descend into overlapping rectangles');
      yield;
      if (nd.leaf) {
        for (const k of nd.items) { g.count('box'); if (inBox(pts[k], R)) inside.push(k); }
      } else {
        for (const k of nd.kids) { g.count('box'); if (meets(k.box, R)) yield* search(k); }
      }
    };
    if (root) { g.count('box'); if (meets((root as RNode).box, R)) yield* search(root); }
    const result: RangeResult & { root: RNode | null; M: number; m: number } = { inside, root, M, m };
    g.last(() => [...marks(), ...hits.map((b) => rect(b, { fill: true, c: 0.15, a: 22 })), ...queryMarks(R, inside.map((k) => pts[k]))], 'query answered');
    return {
      result,
      rows: [
        { label: 'Points in the rectangle', value: String(inside.length) },
        { label: 'Tree height', value: String(depth + 1) },
      ],
    };
  },
};

