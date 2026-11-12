import { V, type GraphKernel } from '../../engines/graph/trace';

export interface SccResult { comp: number[] }

// Two depth-first searches. The first, over the reversed edges, records a postorder. The second
// follows the edges forwards, starting each tree at the latest-finished vertex not yet placed:
// every tree it grows is exactly one strong component.
export const kernel: GraphKernel<SccResult> = {
  goal: 'scc',
  inputs: ['digraph', 'ownership', 'dag'],
  n: { min: 6, max: 300, value: 70 },
  view: { colour: 'group' },
  names: { frontier: 'On the stack', done: 'Finished', groups: 'Strong components' },
  readouts: ['scans', 'done', 'groups', 'rounds'],
  chart: { title: 'Two passes over the vertices', y: 'vertices', series: ['done', 'frontier'] },
  *steps(ops) {
    const g = ops.g;
    const seen = new Array<boolean>(g.n).fill(false);
    const post: number[] = [];
    // pass 1: DFS on the reverse graph (in-edges), postorder
    for (let root = 0; root < g.n; root++) {
      if (seen[root]) continue;
      seen[root] = true;
      ops.discover(root);
      const stack: [number, number][] = [[root, 0]];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] < g.in[u].length) {
          const e = g.in[u][top[1]++];
          ops.scan(e);
          const v = g.eu[e];
          if (!seen[v]) { seen[v] = true; ops.discover(v); stack.push([v, 0]); }
        } else {
          stack.pop();
          post.push(u);
          ops.settle(u);
          yield;
        }
      }
    }
    ops.round();
    yield;
    for (let v = 0; v < g.n; v++) ops.vertex(v, V.unseen);
    // pass 2: DFS on the graph in reverse postorder; each tree is a strong component
    const comp = new Array<number>(g.n).fill(-1);
    let k = 0;
    for (let i = post.length - 1; i >= 0; i--) {
      const root = post[i];
      if (comp[root] >= 0) continue;
      comp[root] = k;
      ops.group(root, k);
      ops.discover(root);
      const stack = [root];
      while (stack.length) {
        const u = stack.pop() as number;
        ops.settle(u);
        yield;
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = g.ev[e];
          if (comp[v] >= 0) continue;
          comp[v] = k;
          ops.group(v, k);
          ops.parent(v, e);
          ops.discover(v);
          stack.push(v);
        }
      }
      k++;
    }
    ops.round();
    yield;
    return { comp };
  },
  report(r) {
    const sizes = new Map<number, number>();
    for (const c of r.comp) sizes.set(c, (sizes.get(c) ?? 0) + 1);
    return [
      { label: 'Strong components', value: String(sizes.size) },
      { label: 'Largest', value: `${Math.max(...sizes.values())} vertices` },
    ];
  },
};
