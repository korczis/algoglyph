import type { GraphKernel } from '../../engines/graph/trace';
import type { FlowResult } from './_flow';
import { augmentingPaths, FLOW_VIEW } from './_maxflow';

// Search the residual network depth-first for any path from source to sink, push its bottleneck
// along it, repeat until the sink is cut off. The vertices still reachable then are one side of
// a minimum cut, and the saturated edges leaving them are the cut.
export const kernel: GraphKernel<FlowResult> = {
  goal: 'maxflow',
  ...FLOW_VIEW,
  readouts: ['flow', 'rounds', 'scans', 'flows'],
  chart: { title: 'Flow value per augmentation', x: 'rounds', y: 'flow', series: ['flow'] },
  *steps(ops, { s, t }) {
    return yield* augmentingPaths(ops, s, t, 'dfs');
  },
};
