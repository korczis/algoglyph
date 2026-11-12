// Inputs of the bespoke sorting plates: the array engine's seeded input shapes (same names, same
// keys, so a note can say "Random permutation" and mean the same thing on every plate), the
// select control that offers them, and the seeds of a plate's successive runs.
import type { SelectParam } from '../../../core/plate';
import { mulberry32 } from '../../../core/random';
import { input, inversions, SHAPE_LABELS, SHAPES, type Shape } from '../../../engines/array/trace';

export { input, inversions, SHAPE_LABELS, SHAPES, type Shape };

/** The shapes whose keys are all distinct (a permutation of 1..n). */
export const DISTINCT: readonly Shape[] = ['random', 'nearly-sorted', 'reversed', 'sorted'];

export function shapeParam(shapes: readonly Shape[] = SHAPES, value: Shape = 'random'): SelectParam {
  return {
    kind: 'select', key: 'shape', label: 'Input', value, rebuild: true,
    options: shapes.map((s) => ({ value: s, label: SHAPE_LABELS[s] })),
  };
}

/** The shape a select names, or the first allowed one. */
export function shapeOf(value: unknown, shapes: readonly Shape[] = SHAPES): Shape {
  return shapes.includes(value as Shape) ? (value as Shape) : shapes[0];
}

/**
 * The seed of run `k` of a plate seeded `seed`: a 32-bit number, so it is the same in the
 * kernel's u64 and in JavaScript. The input of run k and the kernel generator of run k use it.
 */
export function runSeed(seed: number, k: number): number {
  return Math.floor(mulberry32((seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0)() * 4294967296);
}

export function isSorted(keys: ArrayLike<number>): boolean {
  for (let i = 1; i < keys.length; i++) if (keys[i - 1] > keys[i]) return false;
  return true;
}
