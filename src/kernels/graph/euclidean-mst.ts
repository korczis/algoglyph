import { E, type GraphKernel } from '../../engines/graph/trace';
import { delaunayEdges } from './_delaunay';
import { join, MST_VIEW, type MstResult } from './_mst';
import { UnionFind } from './_uf';

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
  speed: 2,
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
