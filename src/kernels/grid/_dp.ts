import { OP, type Measure } from '../../engines/grid/trace';

// Readouts shared by the table-filling kernels.
export const DP_READOUTS: Measure[] = [
  { name: 'Cells computed', of: (t) => t.computed },
  { name: 'Subproblems reused (reads)', of: (t) => t.reused },
  { name: 'Comparisons', of: (t) => t.count(OP.compare) },
  { name: 'Traceback cells', of: (t) => t.count(OP.mark) },
];

export const DP_SERIES: Measure[] = [
  { name: 'Cells computed', of: (t) => t.computed },
  { name: 'Subproblems reused', of: (t) => t.reused },
  { name: 'Comparisons', of: (t) => t.count(OP.compare) },
];

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
