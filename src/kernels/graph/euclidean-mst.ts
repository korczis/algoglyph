import { E, type GraphKernel } from '../../engines/graph/trace';
import { Delaunay, LATTICE } from '../../plates/_shared/delaunay/delaunay';
import { join, MST_VIEW, type MstResult } from './_mst';
import { UnionFind } from './_uf';

/**
 * The Delaunay edges of the points (x, y), as point pairs i < j, by the site's one triangulation
 * (src/plates/_shared/delaunay, Bowyer–Watson with exact predicates). Its predicates are exact on
 * an integer lattice, and these points are seeded floats, so each is snapped to the finest
 * lattice their bounding box allows (its longer side spans LATTICE − 1 steps); only the
 * triangulation sees the snapped points, and lengths stay true. Yields after each insertion with
 * the triangles it walked and tested.
 */
function* delaunayEdges(x: number[], y: number[]): Generator<number, [number, number][], void> {
  const n = x.length;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
  }
  const s = (LATTICE - 1) / (Math.max(maxX - minX, maxY - minY) || 1);
  const mesh = new Delaunay(LATTICE);
  // mesh vertex → point; points that snap onto one lattice point share its vertex
  const pointOf: number[] = [];
  const at = new Map<number, number[]>();
  const X: number[] = []; const Y: number[] = [];
  for (let i = 0; i < n; i++) {
    X.push(Math.round((x[i] - minX) * s)); Y.push(Math.round((y[i] - minY) * s));
    const key = X[i] * LATTICE + Y[i];
    const ins = mesh.insert(X[i], Y[i]);
    if (ins) { pointOf[ins.vertex] = i; at.set(key, [i]); } else (at.get(key) as number[]).push(i);
    yield ins ? ins.walk + ins.tested : 1;
  }
  const out = new Map<number, [number, number]>();
  const add = (a: number, b: number) => {
    if (a !== b) out.set(Math.min(a, b) * n + Math.max(a, b), [Math.min(a, b), Math.max(a, b)]);
  };
  const flat: number[] = [];
  if (mesh.triangles().length) {
    for (let i = 0, e = mesh.edges(); i < e.length; i += 4) add(pointOf[e[i]], pointOf[e[i + 1]]);
  } else {
    // every point on one line: the triangulation is the path through them in order along it
    for (let v = 0; v < pointOf.length; v++) flat.push(pointOf[v]);
    flat.sort((a, b) => X[a] - X[b] || Y[a] - Y[b]);
    for (let k = 1; k < flat.length; k++) add(flat[k - 1], flat[k]);
  }
  // points merged by the snap: joined to each other and to every neighbour of the one kept
  for (const group of at.values()) {
    if (group.length < 2) continue;
    const kept = group[0];
    const around = [...out.values()]
      .flatMap(([a, b]) => (a === kept ? [b] : b === kept ? [a] : []));
    for (const p of group) {
      for (const q of group) add(p, q);
      for (const w of around) add(p, w);
    }
  }
  return [...out.values()];
}

// Every pair of points is an edge, but the minimum spanning tree always lies inside the Delaunay
// triangulation, which has at most 3n - 6 edges. Triangulate (Bowyer-Watson), then run
// Kruskal on the triangulation's edges ordered by their true Euclidean length.
export const kernel: GraphKernel<MstResult> = {
  goal: 'emst',
  inputs: ['points'],
  n: { min: 3, max: 150, value: 70 },
  ...MST_VIEW,
  view: { colour: 'group', hidden: true },
  names: { tree: 'Tree edges', groups: 'Fragments' },
  *steps(ops) {
    const g = ops.g;
    const id = new Map<number, number>();
    for (let e = 0; e < g.m; e++) id.set(Math.min(g.eu[e], g.ev[e]) * g.n + Math.max(g.eu[e], g.ev[e]), e);
    const cand = (yield* delaunayEdges(g.x, g.y)).map(([a, b]) => id.get(a * g.n + b) as number);
    for (const e of cand) ops.edge(e, E.seen);
    ops.round();
    yield;
    const len = (e: number) => Math.hypot(g.x[g.eu[e]] - g.x[g.ev[e]], g.y[g.eu[e]] - g.y[g.ev[e]]);
    cand.sort((a, b) => len(a) - len(b) || a - b);
    const uf = new UnionFind(g.n);
    for (let v = 0; v < g.n; v++) ops.group(v, v);
    const tree: number[] = [];
    for (const e of cand) {
      ops.scan(e);
      yield;
      if (join(ops, uf, e)) tree.push(e); else ops.edge(e, E.drop);
      if (tree.length === g.n - 1) break;
    }
    return { tree };
  },
};
