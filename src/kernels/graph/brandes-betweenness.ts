import { other } from '../../engines/graph/graph';
import { V, type GraphKernel } from '../../engines/graph/trace';

export interface BetweennessResult { cb: number[] }

// Brandes: from every source, a breadth-first search counts the shortest paths sigma to each
// vertex; then, in order of decreasing distance, each vertex passes its dependency
// delta(v) = sum over successors w of sigma(v) / sigma(w) * (1 + delta(w)) back to its
// predecessors. Summed over sources (halved: each path is found from both ends), that is the
// betweenness of every vertex, in O(VE).
export const kernel: GraphKernel<BetweennessResult> = {
  goal: 'betweenness',
  inputs: ['communities', 'small-world', 'geometric', 'grid', 'random'],
  n: { min: 4, max: 160, value: 50 },
  view: { colour: 'value', size: true },
  names: { frontier: 'In the search', done: 'Searched', value: 'Betweenness' },
  readouts: ['rounds', 'scans', 'values'],
  chart: { title: 'Change in betweenness from each source', x: 'rounds', y: 'total change', series: ['change'] },
  *steps(ops) {
    const g = ops.g;
    const cb = new Array<number>(g.n).fill(0);
    for (let v = 0; v < g.n; v++) ops.value(v, 0);
    for (let s = 0; s < g.n; s++) {
      const sigma = new Array<number>(g.n).fill(0);
      const dist = new Array<number>(g.n).fill(-1);
      const preds: number[][] = Array.from({ length: g.n }, () => []);
      const order: number[] = [];
      sigma[s] = 1; dist[s] = 0;
      ops.discover(s);
      const queue = [s];
      for (let h = 0; h < queue.length; h++) {
        const u = queue[h];
        order.push(u);
        ops.settle(u);
        yield;
        for (const e of g.out[u]) {
          ops.scan(e);
          const w = other(g, e, u);
          if (dist[w] < 0) { dist[w] = dist[u] + 1; queue.push(w); ops.discover(w); }
          if (dist[w] === dist[u] + 1) { sigma[w] += sigma[u]; preds[w].push(u); }
        }
      }
      const delta = new Array<number>(g.n).fill(0);
      for (let i = order.length - 1; i >= 0; i--) {
        const w = order[i];
        for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s && delta[w]) { cb[w] += delta[w] / 2; ops.value(w, cb[w]); }
      }
      for (const v of order) ops.vertex(v, V.unseen);
      ops.round();
      yield;
    }
    return { cb };
  },
  report(r) {
    let top = 0;
    for (let v = 1; v < r.cb.length; v++) if (r.cb[v] > r.cb[top]) top = v;
    return [{ label: 'Top broker', value: `vertex ${top}, betweenness ${r.cb[top].toFixed(1)}` }];
  },
};
