// The directed input's reciprocity, a control of the plates whose answer it decides (strong
// components, reachability): the engine gives each 'digraph' edge its reverse when its draw falls
// below this share (graph.ts GraphInput), the same draw at every value.
import type { RangeParam } from '../../core/plate';
import { RECIPROCITY } from '../../engines/graph/graph';

// 0..1 is the whole range of a share, a meaning reason: at 0 no pair is two-way, at 1 every one
// is, and the connected input (graph.ts connect) is then one strong component
export const RECIPROCITY_PARAM: RangeParam = {
  kind: 'range', key: 'reciprocity', label: 'Two-way edges (share)', min: 0, max: 1, step: 0.05,
  value: RECIPROCITY, rebuild: true, when: { key: 'shape', values: ['digraph'] },
  hint: 'The share of the directed input’s edges that also run back; at 1 every vertex reaches every other.',
};
