import type { GraphKernel } from '../../engines/graph/trace';

export interface TopoResult { order: number[] }

// DFS over a DAG: a vertex finishes only after everything it points to, so the reverse of the
// finishing order puts every edge forward. The k-th vertex to finish takes position n - 1 - k.
export const kernel: GraphKernel<TopoResult> = {
  goal: 'toposort',
  inputs: ['dag', 'signed-dag', 'reasoning'],
  n: { min: 6, max: 300, value: 60 },
  view: { colour: 'value' },
  names: { frontier: 'On the stack', done: 'Placed', value: 'Position' },
  readouts: ['scans', 'frontier', 'done'],
  chart: { title: 'Vertices placed', y: 'vertices', series: ['done', 'frontier'] },
  *steps(ops) {
    const g = ops.g;
    const seen = new Array<boolean>(g.n).fill(false);
    const order = new Array<number>(g.n).fill(-1);
    let finished = 0;
    for (let root = 0; root < g.n; root++) {
      if (seen[root]) continue;
      seen[root] = true;
      ops.discover(root);
      const stack: [number, number][] = [[root, 0]];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] < g.out[u].length) {
          const e = g.out[u][top[1]++];
          ops.scan(e);
          const v = g.ev[e];
          if (!seen[v]) { seen[v] = true; ops.parent(v, e); ops.discover(v); stack.push([v, 0]); }
        } else {
          stack.pop();
          const pos = g.n - 1 - finished++;
          order[pos] = u;
          ops.value(u, pos);
          ops.settle(u);
          yield;
        }
      }
      ops.round();
      yield;
    }
    return { order };
  },
  report(r, g) {
    // an edge whose head is placed before its tail points backward: none on a DAG
    const place = new Array<number>(g.n).fill(-1);
    r.order.forEach((v, i) => { if (v >= 0) place[v] = i; });
    let backward = 0;
    for (let e = 0; e < g.m; e++) if (place[g.ev[e]] < place[g.eu[e]]) backward++;
    return [
      { label: 'Order', value: `${r.order.slice(0, 6).join(', ')}${r.order.length > 6 ? ', ...' : ''}` },
      { label: 'Edges pointing backward', value: String(backward) },
    ];
  },
};
