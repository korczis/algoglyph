import { E, V, type GraphKernel } from '../../engines/graph/trace';
import { dijkstra, pathTo } from './_dijkstra';

export interface KspPath { cost: number; verts: number[]; edges: number[] }
export interface KspResult { paths: KspPath[] }

// Yen's algorithm for loopless paths. The best path comes from Dijkstra. For each next one,
// every vertex of the last path found is tried as a spur: keep the path up to it (the root),
// forbid the edges that earlier paths with the same root took next and the root's own
// vertices, and find the cheapest spur path to the target. The cheapest candidate not yet
// taken is the next path.
export const kernel: GraphKernel<KspResult> = {
  goal: 'ksp',
  inputs: ['geometric', 'grid', 'digraph'],
  n: { min: 4, max: 150, value: 50 },
  params: [{ kind: 'range', key: 'k', label: 'Paths k', min: 1, max: 8, step: 1, value: 4, rebuild: true }],
  pick: 's',
  endpoints: 'st',
  names: { frontier: 'In a spur search queue', done: 'Settled in a spur search', tree: 'Paths found', marked: 'Best path' },
  readouts: ['scans', 'relaxations', 'tree', 'rounds'],
  chart: { title: 'Edges on the paths found', y: 'edges', series: ['tree'] },
  speed: 20,
  *steps(ops, { s, t, p }) {
    const g = ops.g;
    const k = Number(p.k);
    const w = (e: number) => g.w[e];
    const reset = (touched: number[]) => { for (const v of touched) ops.vertex(v, V.unseen); };
    const touchedOf = (dist: number[]) => dist.map((d, v) => (Number.isFinite(d) ? v : -1)).filter((v) => v >= 0);
    const first = yield* dijkstra(ops, s, w, { target: t, draw: false });
    reset(touchedOf(first.dist));
    const p0 = pathTo(g, first.parentEdge, s, t);
    if (!p0 || s === t) return { paths: [] };
    const paths: KspPath[] = [{ cost: first.dist[t], ...p0 }];
    const keyOf = (es: number[]) => es.join(',');
    const known = new Set([keyOf(p0.edges)]);
    let cands: KspPath[] = [];
    for (const e of p0.edges) ops.edge(e, E.mark);
    ops.round();
    yield;
    while (paths.length < k) {
      const last = paths[paths.length - 1];
      for (let i = 0; i < last.verts.length - 1; i++) {
        const spur = last.verts[i];
        const rootEdges = last.edges.slice(0, i);
        const rootKey = keyOf(rootEdges);
        const banned = new Set<number>();
        for (const q of paths) if (keyOf(q.edges.slice(0, i)) === rootKey && q.edges.length > i) banned.add(q.edges[i]);
        const inRoot = new Set(last.verts.slice(0, i));
        const sp = yield* dijkstra(ops, spur, w, {
          target: t, draw: false, bannedEdge: (e) => banned.has(e), bannedVertex: (v) => inRoot.has(v),
        });
        reset(touchedOf(sp.dist));
        const tail = pathTo(g, sp.parentEdge, spur, t);
        if (!tail) continue;
        const edges = [...rootEdges, ...tail.edges];
        const key = keyOf(edges);
        if (known.has(key)) continue;
        known.add(key);
        const cost = edges.reduce((sum, e) => sum + g.w[e], 0);
        cands.push({ cost, verts: [...last.verts.slice(0, i), ...tail.verts], edges });
      }
      if (!cands.length) break;
      cands.sort((a, b) => a.cost - b.cost || a.edges.length - b.edges.length);
      const next = cands.shift() as KspPath;
      paths.push(next);
      for (const e of next.edges) ops.edge(e, E.tree);
      for (const e of p0.edges) ops.edge(e, E.mark);
      ops.round();
      yield;
      cands = cands.filter((c) => keyOf(c.edges) !== keyOf(next.edges));
    }
    return { paths };
  },
  report(r) {
    if (!r.paths.length) return [{ label: 'Paths', value: 'target not reachable' }];
    return [{ label: 'Path costs', value: r.paths.map((q) => q.cost).join(', ') }];
  },
};
