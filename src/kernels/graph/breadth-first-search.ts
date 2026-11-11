import { other } from '../../engines/graph/graph';
import type { GraphKernel } from '../../engines/graph/trace';

export interface BfsResult { dist: number[]; parent: number[] }

// A FIFO queue from the source: each vertex is discovered once, along a tree edge from a vertex
// one hop nearer, and leaves the queue in order of distance. A round ends with each level.
export const kernel: GraphKernel<BfsResult> = {
  goal: 'bfs',
  inputs: ['grid', 'geometric', 'small-world', 'random', 'digraph'],
  n: { min: 8, max: 400, value: 140 },
  pick: 's',
  endpoints: 's',
  view: { colour: 'value' },
  names: { frontier: 'On the queue', done: 'Dequeued', tree: 'BFS tree edges', value: 'Distance' },
  readouts: ['scans', 'done', 'frontier', 'maxFrontier', 'rounds'],
  chart: { title: 'The frontier, level by level', y: 'vertices', series: ['frontier', 'done'] },
  speed: 3,
  run(ops, { s }) {
    const g = ops.g;
    const dist = new Array<number>(g.n).fill(-1);
    const parent = new Array<number>(g.n).fill(-1);
    dist[s] = 0;
    ops.value(s, 0);
    ops.discover(s);
    const queue = [s];
    let level = 0;
    for (let head = 0; head < queue.length; head++) {
      const u = queue[head];
      if (dist[u] > level) { level = dist[u]; ops.round(); }
      ops.settle(u);
      for (const e of g.out[u]) {
        ops.scan(e);
        const v = other(g, e, u);
        if (dist[v] >= 0) continue;
        dist[v] = dist[u] + 1;
        parent[v] = u;
        ops.value(v, dist[v]);
        ops.parent(v, e);
        ops.discover(v);
        queue.push(v);
      }
    }
    ops.round();
    return { dist, parent };
  },
  report(r) {
    const reached = r.dist.filter((d) => d >= 0).length;
    return [
      { label: 'Reached', value: `${reached} vertices` },
      { label: 'Farthest', value: `${Math.max(...r.dist)} hops from the source` },
    ];
  },
};
