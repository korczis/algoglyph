// The grid engine's measurable core: a kernel fills or searches a table or board only through
// these cell operations, every one is counted, and the run is recorded as a trace the plate
// replays. Nothing here draws; readouts and charts are tallied from the trace alone.

export const OP = {
  /** A call on a subproblem, or a position tried on a board. */
  visit: 0,
  /** A stored subproblem read back (reused). */
  read: 1,
  /** A memo lookup; v = 1 when the cell was already computed (a hit). */
  lookup: 2,
  /** A cell computed and stored (v is its value). */
  write: 3,
  /** One comparison of two values the kernel holds. */
  compare: 4,
  /** A piece placed on a square. */
  place: 5,
  /** A piece taken back: one backtrack. */
  remove: 6,
  /** A cell crossed out (v = 1 when it was already crossed). */
  cross: 7,
  /** A cell of the answer: a traceback step, a survivor. */
  mark: 8,
  /** A complete solution reached. */
  solution: 9,
} as const;
export type Op = (typeof OP)[keyof typeof OP];
export const OP_COUNT = 10;

export interface GridOps {
  readonly rows: number;
  readonly cols: number;
  /** Count a call on the subproblem at (r, c), or a position tried there. */
  visit(r: number, c: number): void;
  /** Read a computed cell back; reading a cell nobody computed is a kernel bug and throws. */
  read(r: number, c: number): number;
  /** Memo lookup: true (a hit, the subproblem reused) when (r, c) is already computed. */
  known(r: number, c: number): boolean;
  /** Store the value of (r, c); values are integers. */
  write(r: number, c: number, v: number): void;
  /** One counted comparison, x < y. */
  less(x: number, y: number): boolean;
  /** One counted comparison, x === y. */
  equal(x: number, y: number): boolean;
  /** Put a piece on (r, c). */
  place(r: number, c: number): void;
  /** Take the piece off (r, c): a backtrack. */
  remove(r: number, c: number): void;
  /** Cross (r, c) out. */
  cross(r: number, c: number): void;
  /** Whether (r, c) is crossed out: a counted read. */
  crossed(r: number, c: number): boolean;
  /** Mark (r, c) as part of the answer. */
  mark(r: number, c: number): void;
  /** Record that the pieces on the board now form a complete solution. */
  solution(): void;
}

/** What a kernel's run hands back: its result, and the line the plate prints when it is done. */
export interface Outcome<R> {
  result: R;
  summary: string;
}

/** One seeded problem: the grid it is solved on and the run that solves it. */
export interface Instance<D = unknown, R = unknown> {
  rows: number;
  cols: number;
  rowLabels?: string[];
  colLabels?: string[];
  /** Cells the algorithm never uses (the lower triangle of an interval table). */
  inactive?: (r: number, c: number) => boolean;
  /** A fixed caption for a cell (the sieve's integers); otherwise its value is shown. */
  label?: (r: number, c: number) => string;
  /** The input in one line, for the readouts. */
  input: string;
  /** The problem itself, for tests that solve it independently. */
  data: D;
  run(g: GridOps): Outcome<R>;
}

/** A measured quantity of a run, counted from its trace. */
export interface Measure {
  name: string;
  of(t: Tally): number;
}

export type ChartSpec =
  | { kind: 'scaling'; ns: number[]; x: string; y: string; logX?: boolean; logY?: boolean;
    series: Measure[] }
  | { kind: 'rows'; title: string; x: string; y: string; series: { name: string; op: Op }[] };

export interface GridKernel<D = unknown, R = unknown> {
  /** The problem-size control. */
  size: { label: string; min: number; max: number; step: number; value: number };
  /** Default operations replayed per frame. */
  speed: number;
  /** How cell values map onto the palette. */
  colour: 'linear' | 'log';
  /** Join marked cells into a path (a traceback) rather than leaving them as separate cells. */
  path?: boolean;
  readouts: Measure[];
  chart: ChartSpec;
  instance(n: number, seed: number): Instance<D, R>;
}

/** Counts of a trace, in total and by row, and the distinct cells written and crossed. */
export class Tally {
  readonly total = new Array<number>(OP_COUNT).fill(0);
  readonly byRow: Int32Array[];
  /** Distinct cells computed, by row. */
  readonly computedByRow: Int32Array;
  hits = 0;
  computed = 0;
  crossedCells = 0;
  private readonly written: Uint8Array;
  constructor(readonly rows: number, readonly cols: number) {
    this.byRow = Array.from({ length: OP_COUNT }, () => new Int32Array(rows));
    this.written = new Uint8Array(rows * cols);
    this.computedByRow = new Int32Array(rows);
  }
  add(op: number, r: number, c: number, v: number): void {
    this.total[op]++;
    if (r >= 0) this.byRow[op][r]++;
    if (op === OP.lookup && v) this.hits++;
    else if (op === OP.write && !this.written[r * this.cols + c]) {
      this.written[r * this.cols + c] = 1;
      this.computed++;
      this.computedByRow[r]++;
    } else if (op === OP.cross && !v) this.crossedCells++;
  }
  count(op: Op): number { return this.total[op]; }
  inRow(op: Op, r: number): number { return this.byRow[op][r] ?? 0; }
  /** Writes to cells already computed: the same subproblem solved again. */
  get recomputed(): number { return this.total[OP.write] - this.computed; }
  /** Stored subproblems read back and used again. */
  get reused(): number { return this.total[OP.read]; }
  /** Every counted operation that does work (annotations excluded). */
  get work(): number {
    return this.total[OP.visit] + this.total[OP.read] + this.total[OP.lookup] + this.total[OP.write]
      + this.total[OP.compare] + this.total[OP.place] + this.total[OP.remove] + this.total[OP.cross];
  }
}

export interface Trace<R = unknown> {
  /** Events, four ints each: op, row, column, value. */
  events: Int32Array;
  length: number;
  rows: number;
  cols: number;
  tally: Tally;
  outcome?: Outcome<R>;
  /** True when the run stopped at the event cap rather than at the kernel's end. */
  truncated: boolean;
}

export const EVENT_CAP = 2_000_000;

class Stop extends Error {}

/** Run one instance, recording every operation. */
export function trace<R>(inst: Instance<unknown, R>, cap = EVENT_CAP): Trace<R> {
  const { rows, cols } = inst;
  const value = new Float64Array(rows * cols);
  const has = new Uint8Array(rows * cols);
  const crossed = new Uint8Array(rows * cols);
  const piece = new Uint8Array(rows * cols);
  const tally = new Tally(rows, cols);
  let buf = new Int32Array(4 * 4096);
  let len = 0;
  const push = (op: number, r: number, c: number, v: number) => {
    if (len >= cap) throw new Stop();
    if (4 * len + 4 > buf.length) {
      const next = new Int32Array(buf.length * 2);
      next.set(buf);
      buf = next;
    }
    buf[4 * len] = op;
    buf[4 * len + 1] = r;
    buf[4 * len + 2] = c;
    buf[4 * len + 3] = v;
    len++;
    tally.add(op, r, c, v);
  };
  const at = (r: number, c: number) => {
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= rows || c >= cols) {
      throw new RangeError(`cell (${r}, ${c}) outside ${rows} x ${cols}`);
    }
    return r * cols + c;
  };
  const g: GridOps = {
    rows,
    cols,
    visit(r, c) { at(r, c); push(OP.visit, r, c, 0); },
    read(r, c) {
      const i = at(r, c);
      if (!has[i]) throw new Error(`read of cell (${r}, ${c}) before it was computed`);
      push(OP.read, r, c, 0);
      return value[i];
    },
    known(r, c) { const i = at(r, c); push(OP.lookup, r, c, has[i]); return has[i] === 1; },
    write(r, c, v) {
      const i = at(r, c);
      if (!Number.isInteger(v) || Math.abs(v) > 0x7fffffff) throw new RangeError(`value ${v} is not a 32-bit integer`);
      value[i] = v;
      has[i] = 1;
      push(OP.write, r, c, v);
    },
    less(x, y) { push(OP.compare, -1, -1, 0); return x < y; },
    equal(x, y) { push(OP.compare, -1, -1, 0); return x === y; },
    place(r, c) {
      const i = at(r, c);
      if (piece[i]) throw new Error(`(${r}, ${c}) already holds a piece`);
      piece[i] = 1;
      push(OP.place, r, c, 0);
    },
    remove(r, c) {
      const i = at(r, c);
      if (!piece[i]) throw new Error(`(${r}, ${c}) holds no piece`);
      piece[i] = 0;
      push(OP.remove, r, c, 0);
    },
    cross(r, c) { const i = at(r, c); push(OP.cross, r, c, crossed[i]); crossed[i] = 1; },
    crossed(r, c) { const i = at(r, c); push(OP.read, r, c, 0); return crossed[i] === 1; },
    mark(r, c) { at(r, c); push(OP.mark, r, c, 0); },
    solution() { push(OP.solution, -1, -1, 0); },
  };
  let outcome: Outcome<R> | undefined;
  let truncated = false;
  try {
    outcome = inst.run(g);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    truncated = true;
  }
  return { events: buf, length: len, rows, cols, tally, outcome, truncated };
}

/** A kernel's seeded instance of size n, traced. */
export function run<D, R>(kernel: GridKernel<D, R>, n: number, seed: number): Trace<R> {
  return trace(kernel.instance(n, seed));
}

/** Seeded integers in [lo, hi]. */
export function between(rnd: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}
