// Shared by the range-search kernels: the query's marks and its readouts.
import type { Stat } from '../../core/plate';
import { dots, rect, type Box, type Mark, type Pt } from '../../engines/geometry/trace';

export interface RangeResult {
  /** Indices of the input points inside the closed query rectangle. */
  inside: number[];
  /** Index of the input point nearest the query point, when the kernel answers that too. */
  nearest?: number;
}

export const inBox = (p: Pt, b: Box) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

export const queryMarks = (b: Box, found: Pt[]): Mark[] =>
  [rect(b, { fill: true, c: 0.15, a: 30 }), rect(b, { c: 0.15, w: 1.5 }), ...dots(found, { c: 0.15, r: 3.5 })];

export const rangeRows = (inside: number, n: number, work: number, what: string): Stat[] => [
  { label: 'Points in the rectangle', value: String(inside) },
  { label: `Query ${what}`, value: `${work} for ${n} points` },
];

export const RANGE_PARAMS = [
  { kind: 'range' as const, key: 'q', label: 'Query size (% of the field)', min: 5, max: 80, step: 1, value: 30 },
];
