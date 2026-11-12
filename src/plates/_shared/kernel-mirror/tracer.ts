// A step-wise mirror of the sorting kernels' Tracer (crates/algoglyph-kernels/src/sorting/
// prelude.rs): the same counters, the same step clock (every counted operation, mark and phase
// is one step, and `ok()` turns false past the step limit) and the same seeded generator. A
// bespoke plate runs its algorithm through this tracer a few hundred steps per frame instead of
// replaying a recorded trace, and its tests prove that, for the same seed and input, the mirror
// ends with exactly the wasm kernel's output, outcome and counts.
import { SplitMix64 } from './rng';

/** What the kernel counts (the prelude's Counts, without the auxiliary and round counters). */
export interface Counts {
  cmp: number;
  swap: number;
  write: number;
  read: number;
}

/** How a run ended: the prelude's Outcome codes as strings (the ABI's OUTCOMES). */
export type Outcome = 'sorted' | 'truncated' | 'not-a-sort';

/** An array of items: keys to sort by and u32 tags (original index, or burnt-pancake bits). */
export interface Items {
  key: number[];
  tag: number[];
}

export function items(keys: ArrayLike<number>): Items {
  return { key: Array.from(keys), tag: Array.from(keys, (_, i) => i) };
}

/** The last operation, for drawing: what it was and which positions it touched. */
export interface Touch {
  op: 'cmp' | 'swap' | 'set' | 'read' | 'none';
  i: number;
  j: number;
}

export class Tracer {
  readonly counts: Counts = { cmp: 0, swap: 0, write: 0, read: 0 };
  /** Steps counted so far, recorded or not (the ABI's `counted`). */
  steps = 0;
  readonly rng: SplitMix64;
  readonly last: Touch = { op: 'none', i: -1, j: -1 };
  /** The latest phase text and highlighted range [from, to), as the kernel would record them. */
  phaseText = '';
  markFrom = -1;
  markTo = -1;
  markLabel = '';

  constructor(seed: number, readonly maxSteps = Infinity) {
    this.rng = new SplitMix64(seed);
  }

  /** False once the step limit is exceeded: a non-terminating algorithm must stop. */
  ok(): boolean {
    return this.steps <= this.maxSteps;
  }

  /** Sign of key i minus key j, counted as one comparison. */
  cmp(a: Items, i: number, j: number): number {
    this.counts.cmp++;
    this.steps++;
    this.touch('cmp', i, j);
    const x = a.key[i];
    const y = a.key[j];
    return x < y ? -1 : x > y ? 1 : 0;
  }

  /** Two held keys compared (the prelude's cmp_items). */
  cmpKeys(x: number, y: number): number {
    this.counts.cmp++;
    this.steps++;
    this.touch('cmp', -1, -1);
    return x < y ? -1 : x > y ? 1 : 0;
  }

  swap(a: Items, i: number, j: number): void {
    const k = a.key[i];
    a.key[i] = a.key[j];
    a.key[j] = k;
    const t = a.tag[i];
    a.tag[i] = a.tag[j];
    a.tag[j] = t;
    this.counts.swap++;
    this.steps++;
    this.touch('swap', i, j);
  }

  set(a: Items, i: number, key: number, tag: number): void {
    a.key[i] = key;
    a.tag[i] = tag >>> 0;
    this.counts.write++;
    this.steps++;
    this.touch('set', i, i);
  }

  /** A counted read of position i (the caller copies the item it keeps). */
  read(i: number): void {
    this.counts.read++;
    this.steps++;
    this.touch('read', i, i);
  }

  mark(from: number, to: number, label: string): void {
    this.steps++;
    this.markFrom = from;
    this.markTo = to;
    this.markLabel = label;
  }

  phase(text: string): void {
    this.steps++;
    this.phaseText = text;
  }

  private touch(op: Touch['op'], i: number, j: number): void {
    this.last.op = op;
    this.last.i = i;
    this.last.j = j;
  }
}

/** A run of a step-wise algorithm: a generator that yields after each counted operation. */
export type Algorithm = Generator<void, Outcome, void>;

/**
 * Drives an algorithm by steps of its tracer: `advance(k)` runs until k more steps are counted
 * or the run ends, so a frame does a bounded amount of the kernel's own work.
 */
export class Stepper {
  done = false;
  outcome: Outcome | undefined;

  constructor(private readonly run: Algorithm, readonly t: Tracer) {}

  advance(steps: number): void {
    const target = this.t.steps + Math.max(1, steps);
    // every yield follows at least one counted step; the guard only protects the frame
    for (let guard = 4 * steps + 64; !this.done && this.t.steps < target && guard > 0; guard--) {
      const r = this.run.next();
      if (r.done) {
        this.done = true;
        this.outcome = r.value;
      }
    }
  }

  /** Runs to the end (tests): at most `limit` steps, then throws. */
  finish(limit = 1e9): Outcome {
    for (let calls = 0; !this.done; calls++) {
      if (this.t.steps > limit || calls > limit) throw new Error(`Stepper: no end within ${limit} steps`);
      const r = this.run.next();
      if (r.done) {
        this.done = true;
        this.outcome = r.value;
      }
    }
    return this.outcome!;
  }
}
