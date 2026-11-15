// The grid's and the small world's largest edge weight, a control of the plates whose answer the
// weights decide (spanning trees, Dijkstra): the engine draws each weight of those two shapes as
// int(1, maxWeight) (graph.ts GraphInput), the same draw at every value.
import type { RangeParam } from '../../core/plate';
import { MAX_WEIGHT } from '../../engines/graph/graph';

// From 1, where every tree weighs its edge count and Dijkstra is breadth-first search, to 99, the
// random shape's own largest weight (graph.ts), so the three weighted inputs then draw alike; the
// budget does not end it (weights change no amount of work the plates do)
export const MAX_WEIGHT_PARAM: RangeParam = {
  kind: 'range', key: 'maxWeight', label: 'Largest edge weight', min: 1, max: 99, step: 1,
  value: MAX_WEIGHT, rebuild: true, when: { key: 'shape', values: ['grid', 'small-world'] },
  hint: 'Grid and small-world weights are drawn from 1 to this; at 1 every edge weighs the same.',
};
