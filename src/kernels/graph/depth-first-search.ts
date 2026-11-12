import { other } from '../../engines/graph/graph';
import { E, type GraphKernel } from '../../engines/graph/trace';

export interface DfsResult { pre: number[]; post: number[]; parent: number[]; back: number }

// Depth-first search with an explicit stack of (vertex, next edge), so it walks exactly as the
// recursive version would: a vertex turns grey when entered and black when its edges are
// exhausted. Started from the source, then from every vertex still unvisited (a DFS forest).
export const kernel: GraphKernel<DfsResult> = {
  goal: 'dfs',
  inputs: ['geometric', 'grid', 'digraph', 'random', 'small-world'],
  n: { min: 8, max: 300, value: 90 },
  pick: 's',
  endpoints: 's',
  names: { frontier: 'On the stack', done: 'Finished', tree: 'DFS tree edges' },
  readouts: ['scans', 'done', 'frontier', 'maxFrontier', 'tree'],
  chart: { title: 'Depth of the stack', y: 'vertices', series: ['frontier', 'done'] },
  *steps(ops, { s }) {
    const g = ops.g;
    const pre = new Array<number>(g.n).fill(-1);
    const post = new Array<number>(g.n).fill(-1);
    const parent = new Array<number>(g.n).fill(-1);
    const via = new Array<number>(g.n).fill(-1);
    let clock = 0; let finished = 0; let back = 0;
    const roots = [s, ...Array.from({ length: g.n }, (_, i) => i).filter((i) => i !== s)];
    for (const root of roots) {
      if (pre[root] >= 0) continue;
      const stack: [number, number][] = [[root, 0]];
      pre[root] = clock++;
      ops.discover(root);
      while (stack.length) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] < g.out[u].length) {
          const e = g.out[u][top[1]++];
          if (e === via[u]) continue;
          ops.scan(e);
          const v = other(g, e, u);
          if (pre[v] < 0) {
            pre[v] = clock++;
            parent[v] = u; via[v] = e;
            ops.parent(v, e);
            ops.discover(v);
            stack.push([v, 0]);
          } else if (post[v] < 0) {
            // v is grey: an ancestor still on the stack, so e closes a cycle
            back++;
            ops.edge(e, E.back);
          }
        } else {
          stack.pop();
          post[u] = finished++;
          ops.settle(u);
          yield;
        }
      }
      ops.round();
      yield;
    }
    return { pre, post, parent, back };
  },
  report(r) {
    return [
      { label: 'Trees in the forest', value: String(r.parent.filter((p) => p < 0).length) },
      { label: 'Back edges', value: String(r.back) },
    ];
  },
};
