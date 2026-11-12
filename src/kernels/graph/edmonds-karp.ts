import type { GraphKernel } from '../../engines/graph/trace';
import type { FlowResult } from './_flow';
import { augmentingPaths, FLOW_VIEW } from './_maxflow';

// Ford-Fulkerson with breadth-first search: always the augmenting path with fewest edges.
// Shortest-path lengths never decrease, which bounds the augmentations by VE/2 whatever the
// capacities.
export const kernel: GraphKernel<FlowResult> = {
  goal: 'maxflow',
  ...FLOW_VIEW,
  readouts: ['flow', 'rounds', 'scans', 'flows'],
  chart: { title: 'Flow value per augmentation', x: 'rounds', y: 'flow', series: ['flow'] },
  *steps(ops, { s, t }) {
    return yield* augmentingPaths(ops, s, t, 'bfs');
  },
};
