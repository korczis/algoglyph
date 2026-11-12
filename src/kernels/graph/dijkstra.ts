import type { GraphKernel } from '../../engines/graph/trace';
import { dijkstra, type Sssp } from './_dijkstra';

// A binary heap of tentative distances: the nearest unsettled vertex is final (no edge is
// negative, so no detour can undercut it), and relaxing its edges may lower its neighbours'.
export const kernel: GraphKernel<Sssp> = {
  goal: 'sssp',
  inputs: ['geometric', 'grid', 'digraph', 'dag', 'small-world', 'random'],
  n: { min: 4, max: 400, value: 140 },
  pick: 's',
  endpoints: 's',
  view: { colour: 'value' },
  names: { frontier: 'In the queue', done: 'Settled', tree: 'Shortest-path tree', value: 'Distance' },
  readouts: ['scans', 'relaxations', 'done', 'frontier', 'maxFrontier'],
  chart: { title: 'Settled vertices and the queue', y: 'vertices', series: ['done', 'frontier'] },
  *steps(ops, { s }) {
    return yield* dijkstra(ops, s, (e) => ops.g.w[e]);
  },
  report(r) {
    const fin = r.dist.filter(Number.isFinite);
    return [{ label: 'Farthest settled', value: `distance ${Math.max(...fin)}, ${fin.length} reached` }];
  },
};
