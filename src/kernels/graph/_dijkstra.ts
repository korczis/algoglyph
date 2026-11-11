// Dijkstra's algorithm through the engine's operations, shared by the plates that need it.
// `cost` gives each edge's length (non-negative); `banned` edges and vertices are skipped, which
// is what Yen's spur searches need. Stops early once `target` is settled.
import { other } from '../../engines/graph/graph';
import type { GraphOps } from '../../engines/graph/trace';
import { IndexHeap } from './_heap';

export interface Sssp { dist: number[]; parentEdge: number[] }

export function* dijkstra(ops: GraphOps, s: number, cost: (e: number) => number, opts: {
  target?: number; bannedEdge?: (e: number) => boolean; bannedVertex?: (v: number) => boolean;
  draw?: boolean;
} = {}): Generator<void, Sssp, void> {
  const g = ops.g;
  const draw = opts.draw ?? true;
  const dist = new Array<number>(g.n).fill(Infinity);
  const parentEdge = new Array<number>(g.n).fill(-1);
  const done = new Array<boolean>(g.n).fill(false);
  const pq = new IndexHeap(g.n);
  dist[s] = 0;
  pq.push(s, 0);
  ops.discover(s);
  if (draw) ops.value(s, 0);
  while (pq.size) {
    const u = pq.pop();
    done[u] = true;
    ops.settle(u);
    yield;
    if (u === opts.target) break;
    for (const e of g.out[u]) {
      if (opts.bannedEdge?.(e)) continue;
      const v = other(g, e, u);
      if (opts.bannedVertex?.(v)) continue;
      ops.scan(e);
      if (done[v]) continue;
      const d = dist[u] + cost(e);
      const improved = d < dist[v];
      ops.relax(e, improved);
      if (!improved) continue;
      if (!Number.isFinite(dist[v])) ops.discover(v);
      dist[v] = d;
      parentEdge[v] = e;
      if (draw) { ops.value(v, d); ops.parent(v, e); }
      pq.push(v, d);
    }
  }
  return { dist, parentEdge };
}

/** The vertices and edges of the path to t along parent edges, from s; null if unreached. */
export function pathTo(g: { eu: number[]; ev: number[] }, parentEdge: number[], s: number, t: number):
  { verts: number[]; edges: number[] } | null {
  if (t !== s && parentEdge[t] < 0) return null;
  const verts = [t]; const edges: number[] = [];
  for (let v = t; v !== s;) {
    const e = parentEdge[v];
    edges.push(e);
    v = g.eu[e] === v ? g.ev[e] : g.eu[e];
    verts.push(v);
  }
  return { verts: verts.reverse(), edges: edges.reverse() };
}
