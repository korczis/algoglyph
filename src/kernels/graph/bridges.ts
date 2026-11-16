import { E, type GraphKernel } from '../../engines/graph/trace';
import { lowLink } from './_lowlink';
import { EDGES_PER_VERTEX_PARAM } from './_density';

export interface BridgesResult {
  bridge: boolean[];
  /** How many depth-first trees the search grew, one for each component. */
  roots: number;
}

// One DFS with low points: the tree edge (u, v) is a bridge exactly when nothing in v's subtree
// has a back edge reaching u or above it (low[v] > disc[u]). Each bridge is repainted from the
// tree to the cut state, and the replay then no longer counts it as a tree edge, so the engine's
// tree row is the forest less the bridges; the report gives the forest itself, n - roots.
export const kernel: GraphKernel<BridgesResult> = {
  goal: 'bridges',
  inputs: ['geometric', 'small-world', 'random', 'islands'],
  n: { min: 6, max: 300, value: 70 },
  params: [EDGES_PER_VERTEX_PARAM],
  pick: 's',
  endpoints: 's',
  names: {
    frontier: 'On the stack', done: 'Finished', tree: 'Tree edges that are not bridges',
    value: 'Low point',
  },
  readouts: ['scans', 'done', 'tree'],
  chart: { title: 'Depth of the stack', y: 'vertices', series: ['frontier', 'done'] },
  *steps(ops, { s }) {
    const g = ops.g;
    const bridge = new Array<boolean>(g.m).fill(false);
    const ll = yield* lowLink(ops, s, {
      child: (u, v, e, l) => { if (l.low[v] > l.disc[u]) bridge[e] = true; },
    });
    for (let e = 0; e < g.m; e++) if (bridge[e]) ops.edge(e, E.cut);
    return { bridge, roots: ll.isRoot.filter(Boolean).length };
  },
  report(r, g) {
    return [
      { label: 'Bridges', value: String(r.bridge.filter(Boolean).length) },
      { label: 'DFS tree edges', value: String(g.n - r.roots) },
    ];
  },
};
