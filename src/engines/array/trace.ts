// The array engine's measurable core: a kernel works on the array only through these
// operations, every one is counted, and the run is recorded as a trace the plate replays.
// Nothing here draws; the readouts and the lab's tables are computed from the trace alone.
import { mulberry32 } from '../../core/random';

export const OP = {
  read: 0,
  write: 1,
  compare: 2,
  swap: 3,
  auxRead: 4,
  auxWrite: 5,
  /** A free annotation: the range [i, j] the kernel is working on (partition, merge, pass). */
  range: 6,
} as const;

export interface ArrayOps {
  readonly n: number;
  /** Read a[i]. */
  get(i: number): number;
  /** Write a[i] = v. */
  set(i: number, v: number): void;
  /** Exchange a[i] and a[j]: two reads and two writes, counted as one swap. */
  swap(i: number, j: number): void;
  /** One key comparison, x < y, of values the kernel holds. */
  less(x: number, y: number): boolean;
  /** a[i] < a[j]: two reads and one comparison. */
  lessAt(i: number, j: number): boolean;
  /** If a[j] < a[i], exchange them: the comparator of a sorting network. */
  exch(i: number, j: number): void;
  /** Auxiliary array of length n, for merges and distributions. */
  aux(k: number): number;
  setAux(k: number, v: number): void;
  /** Mark the range [lo, hi] as the one being worked on (free; drawing only). */
  range(lo: number, hi: number): void;
}

export interface ArrayKernel {
  /** 'sort' leaves the array ascending; 'select' places the k-th smallest at index k. */
  goal?: 'sort' | 'select';
  /**
   * The largest n this kernel plays at, when its whole run is too costly to trace inside one
   * frame at the engine's own maximum (a quadratic or worse kernel); the plate's n slider stops
   * here. Derived from measured cost by whoever provides the kernel, never typed by guess.
   */
  maxN?: number;
  run(a: ArrayOps, k: number): void;
}

export interface Counts {
  compares: number;
  reads: number;
  writes: number;
  swaps: number;
  auxReads: number;
  auxWrites: number;
}

export interface Trace {
  /** Events, three ints each: op, i, j-or-value. */
  events: Int32Array;
  length: number;
  counts: Counts;
  input: number[];
  output: number[];
  k: number;
  /** True when the run stopped at the event cap rather than at the kernel's end. */
  truncated: boolean;
}

/** Events a trace may hold; a quadratic sort at the largest n stays well inside it. */
export const EVENT_CAP = 4_000_000;

class Stop extends Error {}

/**
 * Run `kernel` on a copy of `input`, recording every operation. `order` replaces `<` as the key
 * order (tests use it to compare by key only and so observe stability).
 */
export function trace(kernel: ArrayKernel, input: number[], k = 0, cap = EVENT_CAP,
  order: (x: number, y: number) => boolean = (x, y) => x < y): Trace {
  const a = input.slice();
  const aux = new Array<number>(a.length).fill(0);
  let buf = new Int32Array(3 * 4096);
  let len = 0;
  const counts: Counts = { compares: 0, reads: 0, writes: 0, swaps: 0, auxReads: 0, auxWrites: 0 };
  const push = (op: number, i: number, j: number) => {
    if (len >= cap) throw new Stop();
    if (3 * len + 3 > buf.length) {
      const next = new Int32Array(buf.length * 2);
      next.set(buf);
      buf = next;
    }
    buf[3 * len] = op;
    buf[3 * len + 1] = i;
    buf[3 * len + 2] = j;
    len++;
  };
  const check = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= a.length) throw new RangeError(`index ${i} outside 0..${a.length - 1}`);
  };
  const ops: ArrayOps = {
    n: a.length,
    get(i) { check(i); counts.reads++; push(OP.read, i, 0); return a[i]; },
    set(i, v) { check(i); counts.writes++; a[i] = v; push(OP.write, i, v); },
    swap(i, j) {
      check(i); check(j);
      counts.swaps++; counts.reads += 2; counts.writes += 2;
      const t = a[i]; a[i] = a[j]; a[j] = t;
      push(OP.swap, i, j);
    },
    less(x, y) { counts.compares++; push(OP.compare, -1, -1); return order(x, y); },
    lessAt(i, j) {
      check(i); check(j);
      counts.reads += 2; counts.compares++;
      push(OP.compare, i, j);
      return order(a[i], a[j]);
    },
    exch(i, j) { if (ops.lessAt(j, i)) ops.swap(i, j); },
    aux(k2) { check(k2); counts.auxReads++; push(OP.auxRead, k2, 0); return aux[k2]; },
    setAux(k2, v) { check(k2); counts.auxWrites++; aux[k2] = v; push(OP.auxWrite, k2, v); },
    range(lo, hi) { push(OP.range, Math.max(0, lo), Math.min(a.length - 1, hi)); },
  };
  let truncated = false;
  try {
    kernel.run(ops, k);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    truncated = true;
  }
  return { events: buf, length: len, counts, input: input.slice(), output: a, k, truncated };
}

export const SHAPES = ['random', 'nearly-sorted', 'reversed', 'few-unique', 'organ-pipe', 'sorted'] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_LABELS: Record<Shape, string> = {
  random: 'Random permutation',
  'nearly-sorted': 'Nearly sorted',
  reversed: 'Reversed',
  'few-unique': 'Few distinct keys',
  'organ-pipe': 'Organ pipe',
  sorted: 'Already sorted',
};

/** A seeded input of n keys in 1..n (few-unique: 1..4). */
export function input(shape: Shape, n: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const shuffle = (from = 0) => {
    for (let i = n - 1; i > from; i--) {
      const j = from + Math.floor(rnd() * (i - from + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  };
  switch (shape) {
    case 'random': shuffle(); break;
    case 'nearly-sorted':
      if (n < 2) break;
      for (let s = 0; s < Math.max(1, Math.round(n / 20)); s++) {
        const i = Math.floor(rnd() * n);
        const j = Math.min(n - 1, i + 1 + Math.floor(rnd() * 3));
        [a[i], a[j]] = [a[j], a[i]];
      }
      break;
    case 'reversed': a.reverse(); break;
    case 'few-unique':
      for (let i = 0; i < n; i++) a[i] = 1 + Math.floor(rnd() * 4);
      break;
    case 'organ-pipe':
      for (let i = 0; i < n; i++) a[i] = 1 + Math.min(i, n - 1 - i) * 2;
      break;
    case 'sorted': break;
  }
  return a;
}

/** Inversions of a: pairs out of order, by merge counting in O(n log n). */
export function inversions(a: ArrayLike<number>): number {
  const x = Array.from(a);
  const tmp = new Array<number>(x.length);
  let inv = 0;
  for (let width = 1; width < x.length; width *= 2) {
    for (let lo = 0; lo < x.length - width; lo += 2 * width) {
      const mid = lo + width;
      const hi = Math.min(lo + 2 * width, x.length);
      let i = lo; let j = mid; let k = lo;
      while (i < mid && j < hi) {
        if (x[j] < x[i]) { inv += mid - i; tmp[k++] = x[j++]; } else tmp[k++] = x[i++];
      }
      while (i < mid) tmp[k++] = x[i++];
      while (j < hi) tmp[k++] = x[j++];
      for (let t = lo; t < hi; t++) x[t] = tmp[t];
    }
  }
  return inv;
}

/** Apply one event of a trace to a replayed array (and its auxiliary). */
export function apply(a: number[], aux: number[], events: Int32Array, e: number): void {
  const op = events[3 * e];
  const i = events[3 * e + 1];
  const j = events[3 * e + 2];
  if (op === OP.write) a[i] = j;
  else if (op === OP.swap) { const t = a[i]; a[i] = a[j]; a[j] = t; } else if (op === OP.auxWrite) aux[i] = j;
}
