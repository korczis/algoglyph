// Bin packing heuristics on integer item sizes, every fit test and sort comparison counted, the
// run recorded as placements the plate replays. Pure: no drawing, no randomness but the seed.
import { mulberry32 } from '../../core/random';

export const CAPACITY = 100;

export const SHAPES = ['uniform', 'small', 'halves', 'thirds'] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_LABELS: Record<Shape, string> = {
  uniform: 'Uniform sizes, 1 to the capacity',
  small: 'Small items, up to 30% of a bin',
  halves: 'Halves and crumbs, alternating',
  thirds: 'Near thirds, 26% to 40% of a bin',
};

/** n seeded integer sizes in 1..CAPACITY, in arrival order. */
export function items(shape: Shape, n: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  return Array.from({ length: n }, (_, i) => {
    switch (shape) {
      case 'uniform': return int(1, CAPACITY);
      case 'small': return int(1, 30);
      case 'halves': return i % 2 === 0 ? CAPACITY / 2 : int(1, 3);
      case 'thirds': return int(26, 40);
    }
  });
}

export interface Placement {
  /** Index of the item in arrival order. */
  item: number;
  size: number;
  bin: number;
  /** True when the item opened a new bin. */
  opened: boolean;
}

export interface Packing {
  placements: Placement[];
  /** Final load of every bin. */
  loads: number[];
  /** Fit tests: one per (item, bin) pair the heuristic examined. */
  tests: number;
  /** Size comparisons made while sorting (first fit decreasing). */
  compares: number;
}

export const ALGORITHMS = ['next-fit', 'first-fit', 'first-fit-decreasing'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];
export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  'next-fit': 'Next fit',
  'first-fit': 'First fit',
  'first-fit-decreasing': 'First fit decreasing',
};

/** Keep one bin open; an item that does not fit closes it and opens the next. */
export function nextFit(sizes: number[], cap = CAPACITY): Packing {
  const loads: number[] = [];
  const placements: Placement[] = [];
  let tests = 0;
  sizes.forEach((s, item) => {
    const last = loads.length - 1;
    if (last >= 0) {
      tests++;
      if (loads[last] + s <= cap) {
        loads[last] += s;
        placements.push({ item, size: s, bin: last, opened: false });
        return;
      }
    }
    loads.push(s);
    placements.push({ item, size: s, bin: loads.length - 1, opened: true });
  });
  return { placements, loads, tests, compares: 0 };
}

function firstFitIn(order: number[], sizes: number[], cap: number, compares: number): Packing {
  const loads: number[] = [];
  const placements: Placement[] = [];
  let tests = 0;
  for (const item of order) {
    const s = sizes[item];
    let bin = -1;
    for (let b = 0; b < loads.length; b++) {
      tests++;
      if (loads[b] + s <= cap) { bin = b; break; }
    }
    if (bin >= 0) {
      loads[bin] += s;
      placements.push({ item, size: s, bin, opened: false });
    } else {
      loads.push(s);
      placements.push({ item, size: s, bin: loads.length - 1, opened: true });
    }
  }
  return { placements, loads, tests, compares };
}

/** Put each item in the earliest bin it fits, scanning the bins in order. */
export function firstFit(sizes: number[], cap = CAPACITY): Packing {
  return firstFitIn(sizes.map((_, i) => i), sizes, cap, 0);
}

/** Item indices by size, largest first, ties in arrival order: a counted, stable mergesort. */
export function decreasing(sizes: number[]): { order: number[]; compares: number } {
  let a = sizes.map((_, i) => i);
  let compares = 0;
  let tmp = new Array<number>(a.length);
  for (let w = 1; w < a.length; w *= 2) {
    for (let lo = 0; lo < a.length; lo += 2 * w) {
      const mid = Math.min(lo + w, a.length);
      const hi = Math.min(lo + 2 * w, a.length);
      let i = lo; let j = mid; let k = lo;
      while (i < mid && j < hi) {
        compares++;
        tmp[k++] = sizes[a[j]] > sizes[a[i]] ? a[j++] : a[i++];
      }
      while (i < mid) tmp[k++] = a[i++];
      while (j < hi) tmp[k++] = a[j++];
    }
    [a, tmp] = [tmp, a];
  }
  return { order: a, compares };
}

/** Sort the items largest first, then first fit. */
export function firstFitDecreasing(sizes: number[], cap = CAPACITY): Packing {
  const { order, compares } = decreasing(sizes);
  return firstFitIn(order, sizes, cap, compares);
}

export function pack(algorithm: Algorithm, sizes: number[], cap = CAPACITY): Packing {
  if (algorithm === 'next-fit') return nextFit(sizes, cap);
  if (algorithm === 'first-fit') return firstFit(sizes, cap);
  return firstFitDecreasing(sizes, cap);
}

/** ⌈Σ sizes / cap⌉: no packing of these items uses fewer bins. */
export function lowerBound(sizes: number[], cap = CAPACITY): number {
  return Math.ceil(sizes.reduce((s, x) => s + x, 0) / cap);
}

/** Item counts the exact search accepts; bin packing is NP-hard, so it stays small. */
export const EXACT_MAX = 12;

/**
 * The fewest bins any packing needs, by branch and bound: items largest first, each tried in
 * every open bin with room (bins of equal load are tried once) and in one new bin, pruned when
 * the bins open plus the remaining volume cannot beat the best packing found.
 */
export function optimum(sizes: number[], cap = CAPACITY): number {
  if (sizes.length > EXACT_MAX) throw new RangeError(`exact search is limited to ${EXACT_MAX} items`);
  if (!sizes.length) return 0;
  const s = sizes.slice().sort((x, y) => y - x);
  const rest: number[] = new Array(s.length + 1).fill(0);
  for (let i = s.length - 1; i >= 0; i--) rest[i] = rest[i + 1] + s[i];
  let best = firstFitDecreasing(sizes, cap).loads.length;
  const loads: number[] = [];
  const go = (i: number) => {
    if (i === s.length) { best = Math.min(best, loads.length); return; }
    const free = loads.length * cap - loads.reduce((a, b) => a + b, 0);
    if (loads.length + Math.max(0, Math.ceil((rest[i] - free) / cap)) >= best) return;
    const tried = new Set<number>();
    for (let b = 0; b < loads.length; b++) {
      if (loads[b] + s[i] > cap || tried.has(loads[b])) continue;
      tried.add(loads[b]);
      loads[b] += s[i];
      go(i + 1);
      loads[b] -= s[i];
    }
    if (loads.length + 1 < best) {
      loads.push(s[i]);
      go(i + 1);
      loads.pop();
    }
  };
  go(0);
  return best;
}
