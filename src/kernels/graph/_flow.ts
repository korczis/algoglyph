// The residual network of a flow on a directed graph: edge e carries f[e] of cap[e]; from u
// it offers cap - f forward along an out-edge and f backward along an in-edge.
import type { GraphOps } from '../../engines/graph/trace';
import { E } from '../../engines/graph/trace';

export interface Arc { e: number; to: number; fwd: boolean; room: number }

/** The residual arcs leaving v (only those with room left when `open` is true). */
export function arcs(ops: GraphOps, f: number[], v: number, open = true): Arc[] {
  const g = ops.g;
  const out: Arc[] = [];
  for (const e of g.out[v]) {
    const room = g.cap[e] - f[e];
    if (!open || room > 0) out.push({ e, to: g.ev[e], fwd: true, room });
  }
  for (const e of g.in[v]) {
    if (!open || f[e] > 0) out.push({ e, to: g.eu[e], fwd: false, room: f[e] });
  }
  return out;
}

/** Push `delta` along a path of residual arcs, recording every changed edge flow. */
export function augment(ops: GraphOps, f: number[], path: Arc[], delta: number): void {
  for (const a of path) {
    f[a.e] += a.fwd ? delta : -delta;
    ops.flow(a.e, f[a.e]);
  }
}

/** The value of a flow: net flow out of s. */
export function value(ops: GraphOps, f: number[], s: number): number {
  const g = ops.g;
  let v = 0;
  for (const e of g.out[s]) v += f[e];
  for (const e of g.in[s]) v -= f[e];
  return v;
}

/**
 * The minimum cut of a maximum flow: the vertices still reachable from s in the residual
 * network. Each edge from that side to the other is saturated and drawn as cut.
 */
export function minCut(ops: GraphOps, f: number[], s: number): boolean[] {
  const g = ops.g;
  const side = new Array<boolean>(g.n).fill(false);
  side[s] = true;
  const queue = [s];
  while (queue.length) {
    const u = queue.shift() as number;
    for (const a of arcs(ops, f, u)) {
      ops.scan(a.e);
      if (!side[a.to]) { side[a.to] = true; queue.push(a.to); }
    }
  }
  for (let e = 0; e < g.m; e++) if (side[g.eu[e]] && !side[g.ev[e]]) ops.edge(e, E.cut);
  return side;
}

export interface FlowResult { flow: number[]; value: number; side: boolean[] }
