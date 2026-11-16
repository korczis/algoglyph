// The random input's edges per vertex, a control of the plates whose answer the density decides
// (components, cut vertices, bridges): the engine draws round(edgesPerVertex · n) distinct pairs
// (graph.ts GraphInput), the list at a lower value a prefix of the list at a higher one.
import type { RangeParam } from '../../core/plate';
import { EDGES_PER_VERTEX } from '../../engines/graph/graph';

// A meaning range across both thresholds of a random graph with m = k·n edges: from 0.1, where at
// most 0.2 n vertices touch an edge, below the giant component's birth at k = 1/2 (average degree
// 1), to 3, which is ln(n)/2 at n 400, the largest the plates allow: the threshold past which
// such a graph is connected (Erdős–Rényi; measured here over 31 seeds, n 300 at 3 leaves at most
// 3 isolated vertices and one component of at least 297). The budget does not end it: at 3 the
// worst run is 4,000 events (connected-components at n 400) of the 600,000 cap
export const EDGES_PER_VERTEX_PARAM: RangeParam = {
  kind: 'range', key: 'edgesPerVertex', label: 'Edges per vertex', min: 0.1, max: 3, step: 0.1,
  value: EDGES_PER_VERTEX, rebuild: true, when: { key: 'shape', values: ['random'] },
  hint: 'Edges the random input draws per vertex; at 0.1 at least 80 % of the vertices have none.',
};
