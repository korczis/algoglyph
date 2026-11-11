import { E, type GraphKernel } from '../../engines/graph/trace';
import { lowLink } from './_lowlink';

export interface BridgesResult { bridge: boolean[] }

// One DFS with low points: the tree edge (u, v) is a bridge exactly when nothing in v's subtree
// has a back edge reaching u or above it (low[v] > disc[u]).
export const kernel: GraphKernel<BridgesResult> = {
  goal: 'bridges',
  inputs: ['geometric', 'small-world', 'random', 'islands'],
  n: { min: 6, max: 300, value: 70 },
  pick: 's',
  endpoints: 's',
  names: { frontier: 'On the stack', done: 'Finished', tree: 'DFS tree edges', value: 'Low point' },
  readouts: ['scans', 'done', 'tree'],
  chart: { title: 'Depth of the stack', y: 'vertices', series: ['frontier', 'done'] },
  speed: 3,
  run(ops, { s }) {
    const g = ops.g;
    const bridge = new Array<boolean>(g.m).fill(false);
    lowLink(ops, s, { child: (u, v, e, l) => { if (l.low[v] > l.disc[u]) bridge[e] = true; } });
    for (let e = 0; e < g.m; e++) if (bridge[e]) ops.edge(e, E.cut);
    return { bridge };
  },
  report(r) {
    return [{ label: 'Bridges', value: String(r.bridge.filter(Boolean).length) }];
  },
};
