// Depth-first search with low points on an undirected graph: low[v] is the earliest discovery
// time reachable from v's subtree by tree edges down and one back edge up. The hooks hear of
// every tree or back edge as it is first taken, and of every finished tree edge (u, v, e).
import { other } from '../../engines/graph/graph';
import { E, type GraphOps } from '../../engines/graph/trace';

export interface LowLink {
  disc: number[];
  low: number[];
  /** How many tree children each vertex has (a root with two or more separates the graph). */
  children: number[];
  isRoot: boolean[];
}

export function* lowLink(ops: GraphOps, start: number, hooks: {
  edge?(e: number, ll: LowLink): void;
  child?(u: number, v: number, e: number, ll: LowLink): void;
}): Generator<void, LowLink, void> {
  const g = ops.g;
  const ll: LowLink = {
    disc: new Array<number>(g.n).fill(-1),
    low: new Array<number>(g.n).fill(-1),
    children: new Array<number>(g.n).fill(0),
    isRoot: new Array<boolean>(g.n).fill(false),
  };
  const { disc, low } = ll;
  const via = new Array<number>(g.n).fill(-1);
  let clock = 0;
  const order = [start, ...Array.from({ length: g.n }, (_, i) => i).filter((i) => i !== start)];
  for (const root of order) {
    if (disc[root] >= 0) continue;
    ll.isRoot[root] = true;
    disc[root] = low[root] = clock++;
    ops.value(root, low[root]);
    ops.discover(root);
    const stack: [number, number][] = [[root, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const u = top[0];
      if (top[1] < g.out[u].length) {
        const e = g.out[u][top[1]++];
        if (e === via[u]) continue;
        const v = other(g, e, u);
        ops.scan(e);
        if (disc[v] < 0) {
          hooks.edge?.(e, ll);
          disc[v] = low[v] = clock++;
          via[v] = e;
          ll.children[u]++;
          ops.parent(v, e);
          ops.value(v, low[v]);
          ops.discover(v);
          stack.push([v, 0]);
        } else if (disc[v] < disc[u]) {
          hooks.edge?.(e, ll);
          ops.edge(e, E.back);
          if (disc[v] < low[u]) { low[u] = disc[v]; ops.value(u, low[u]); }
        }
      } else {
        stack.pop();
        ops.settle(u);
        yield;
        if (stack.length) {
          const p = stack[stack.length - 1][0];
          if (low[u] < low[p]) { low[p] = low[u]; ops.value(p, low[p]); }
          hooks.child?.(p, u, via[u], ll);
        }
      }
    }
    ops.round();
    yield;
  }
  return ll;
}
