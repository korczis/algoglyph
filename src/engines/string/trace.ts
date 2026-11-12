// The string engine's measurable core. A kernel works through StringOps: counted operations
// (character comparisons, table writes, hash updates, shifts...) and drawing-free board events
// (rows of cells, tables, lists, marks, links) that the plate replays. Every readout is counted
// from the recorded events, never asserted by the kernel.
import type { ParamDef, Params } from '../../core/plate';
import type { InputKind, Inputs } from './inputs';

/** Cell states the plate colours: transient marks and a persistent done state. */
export const S = { none: 0, focus: 1, hit: 2, miss: 3, done: 4, dim: 5, alt: 6 } as const;
export type State = (typeof S)[keyof typeof S];

export const OP = {
  tick: 0, part: 1, set: 2, mark: 3, clear: 4, offset: 5, heat: 6, push: 7, pop: 8,
  splice: 9, swap: 10, swapRows: 11, link: 12, unlink: 13, note: 14, stat: 15, plot: 16,
} as const;

/** One recorded event: op, part, two integers, a number, a string, a list of strings. */
export interface Ev {
  o: number;
  p: number;
  i: number;
  j: number;
  v: number;
  s?: string;
  ss?: string[];
}

export type PartKind = 'row' | 'heat' | 'table' | 'list';

/**
 * The recorded events, column by column. A quadratic run records several hundred thousand events;
 * as one object each they were that many objects for the garbage collector to mark while the next
 * run recorded (brute force on Repetitive input, n = 2048: 10-18 ms pauses inside a frame). The
 * numbers live in typed arrays and only the few string fields are kept per event.
 */
export class EventLog {
  length = 0;
  private o = new Uint8Array(1024);
  private p = new Int32Array(1024);
  private i = new Int32Array(1024);
  private j = new Int32Array(1024);
  private v = new Float64Array(1024);
  private s: (string | undefined)[] = [];
  private ss: (string[] | undefined)[] = [];

  push(o: number, p: number, i: number, j: number, v: number, s?: string, ss?: string[]): void {
    const n = this.length;
    if (n === this.o.length) {
      const grow = <T extends Uint8Array | Int32Array | Float64Array>(a: T): T => {
        const b = new (a.constructor as new (k: number) => T)(2 * a.length);
        b.set(a);
        return b;
      };
      this.o = grow(this.o); this.p = grow(this.p); this.i = grow(this.i); this.j = grow(this.j); this.v = grow(this.v);
    }
    this.o[n] = o; this.p[n] = p; this.i[n] = i; this.j[n] = j; this.v[n] = v;
    if (s !== undefined) this.s[n] = s;
    if (ss !== undefined) this.ss[n] = ss;
    this.length = n + 1;
  }

  /** Event k, written into `into` (a cursor reused by the replay, so reading allocates nothing). */
  get(k: number, into: Ev = { o: 0, p: 0, i: 0, j: 0, v: 0 }): Ev {
    into.o = this.o[k]; into.p = this.p[k]; into.i = this.i[k]; into.j = this.j[k]; into.v = this.v[k];
    into.s = this.s[k]; into.ss = this.ss[k];
    return into;
  }

  /** Events from..to as plain objects (tests and tools). */
  toArray(from = 0, to = this.length): Ev[] {
    const out: Ev[] = [];
    for (let k = from; k < to; k++) {
      const e = this.get(k, { o: 0, p: 0, i: 0, j: 0, v: 0 });
      if (e.s === undefined) delete e.s;
      if (e.ss === undefined) delete e.ss;
      out.push(e);
    }
    return out;
  }
}

export interface PartOpts {
  label?: string;
  /** Another row whose cells this row lines up with (a pattern under its text). */
  align?: string;
  /** Cell width in cells, for multi-character cells (codes, hex bytes). */
  w?: number;
  /** Text lines a list may occupy. */
  lines?: number;
  rows?: number;
  cols?: number;
  rowHead?: string[];
  colHead?: string[];
}

export interface StringOps {
  /** One counted operation of the named counter. */
  tick(counter: string, k?: number): void;
  /** One counted comparison of two symbols: returns x === y. */
  eq(counter: string, x: string | number, y: string | number): boolean;
  /** A row of cells (heat: drawn as colour only, squeezed to the width). */
  row(id: string, cells: string[], opts?: PartOpts, heat?: boolean): void;
  table(id: string, rows: number, cols: number, opts?: PartOpts): void;
  list(id: string, items?: string[], opts?: PartOpts): void;
  set(id: string, i: number, text: string): void;
  put(id: string, r: number, c: number, text: string, state?: State): void;
  mark(id: string, i: number, state: State): void;
  markCell(id: string, r: number, c: number, state: State): void;
  /** Clear transient marks of a part (done states stay unless all is true). */
  clear(id: string, all?: boolean): void;
  offset(id: string, k: number): void;
  heat(id: string, i: number, v: number): void;
  push(id: string, text: string, state?: State): void;
  pop(id: string): void;
  splice(id: string, i: number, del: number, items: string[]): void;
  swap(id: string, i: number, j: number): void;
  swapRows(id: string, r: number, q: number): void;
  link(a: string, i: number, b: string, j: number, state?: State): void;
  unlink(): void;
  note(text: string): void;
  /** A readout the kernel derives from its own run (persisting by label). */
  stat(label: string, value: string): void;
  /** A chart point of a named series, computed from the run. */
  plot(series: string, x: number, y: number): void;
  /** The counts so far, for plots and stats derived from them. */
  count(counter: string): number;
}

export interface StringKernel<K extends InputKind = InputKind, R = unknown> {
  input: K;
  /** Counter name to label; the first is the primary measure. */
  counters: Record<string, string>;
  params?: ParamDef[];
  /** Default input shape, one of the input kind's shapes. */
  shape?: string;
  /** Default input size (the input kind's size parameter). */
  size?: number;
  aspect?: number;
  chart?: { title: string; x: string; y: string; xlog?: boolean; ylog?: boolean };
  /**
   * The algorithm. A kernel whose run takes more than a few milliseconds is a generator that
   * yields `null` now and then: the plate records it across frames instead of in one.
   */
  run(ops: StringOps, x: Inputs[K], params: Params): R | Generator<null, R>;
}

export interface Trace<R = unknown> {
  events: EventLog;
  counters: string[];
  labels: string[];
  counts: number[];
  result: R;
  truncated: boolean;
}

export const EVENT_CAP = 1_500_000;
class Stop extends Error {}

const isSteps = <R>(r: R | Generator<null, R>): r is Generator<null, R> =>
  typeof r === 'object' && r !== null && typeof (r as Generator<null, R>).next === 'function'
  && typeof (r as Generator<null, R>)[Symbol.iterator] === 'function';

/** Run a kernel on an input, recording every event. */
export function trace<K extends InputKind, R>(kernel: StringKernel<K, R>, x: Inputs[K],
  params: Params = {}, cap = EVENT_CAP): Trace<R | undefined> {
  const steps = traceSteps(kernel, x, params, cap);
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}

/**
 * The most events a kernel records between two pauses, at its plate's largest input and its lab's
 * largest measured size (test/string-engine.test.ts): a kernel that would record more is a
 * generator that yields `null` often enough.
 */
export const STEP_EVENTS = 6000;

/**
 * `trace` as steps: pauses wherever the kernel does, each pause yielding the number of events
 * recorded so far, so the recording can be spread over frames by counted work.
 */
export function* traceSteps<K extends InputKind, R>(kernel: StringKernel<K, R>, x: Inputs[K],
  params: Params = {}, cap = EVENT_CAP): Generator<number, Trace<R | undefined>> {
  const names = Object.keys(kernel.counters);
  const counts = names.map(() => 0);
  const events = new EventLog();
  const parts = new Map<string, { n: number; kind: PartKind; cols: number }>();
  const ev = (o: number, p: number, i = 0, j = 0, v = 0, s?: string, ss?: string[]) => {
    if (events.length >= cap) throw new Stop();
    events.push(o, p, i, j, v, s, ss);
  };
  const pid = (id: string) => {
    const q = parts.get(id);
    if (!q) throw new Error(`part ${id} is not declared`);
    return q.n;
  };
  const cid = (c: string) => {
    const k = names.indexOf(c);
    if (k < 0) throw new Error(`counter ${c} is not declared`);
    return k;
  };
  const declare = (id: string, kind: PartKind, cols: number) => {
    let q = parts.get(id);
    if (!q) { q = { n: parts.size, kind, cols }; parts.set(id, q); }
    q.kind = kind; q.cols = cols;
    return q.n;
  };
  const ops: StringOps = {
    tick(c, k = 1) { const i = cid(c); counts[i] += k; ev(OP.tick, -1, i, 0, k); },
    eq(c, x2, y) { ops.tick(c); return x2 === y; },
    row(id, cells, opts = {}, heat = false) {
      const align = opts.align ? pid(opts.align) : -1;
      ev(OP.part, declare(id, heat ? 'heat' : 'row', cells.length), align, opts.w ?? 1, 0,
        JSON.stringify({ kind: heat ? 'heat' : 'row', label: opts.label ?? '' }), cells.slice());
    },
    table(id, rows, cols, opts = {}) {
      ev(OP.part, declare(id, 'table', cols), rows, cols, 0, JSON.stringify({
        kind: 'table', label: opts.label ?? '', rowHead: opts.rowHead, colHead: opts.colHead,
      }));
    },
    list(id, items = [], opts = {}) {
      ev(OP.part, declare(id, 'list', 0), opts.lines ?? 2, 0, 0,
        JSON.stringify({ kind: 'list', label: opts.label ?? '' }), items.slice());
    },
    set(id, i, text) { ev(OP.set, pid(id), i, 0, 0, text); },
    put(id, r, c, text, state) {
      const q = parts.get(id);
      if (!q) throw new Error(`part ${id} is not declared`);
      ev(OP.set, q.n, r * q.cols + c, 0, 0, text);
      if (state !== undefined) ev(OP.mark, q.n, r * q.cols + c, state);
    },
    mark(id, i, state) { ev(OP.mark, pid(id), i, state); },
    markCell(id, r, c, state) {
      const q = parts.get(id);
      if (!q) throw new Error(`part ${id} is not declared`);
      ev(OP.mark, q.n, r * q.cols + c, state);
    },
    clear(id, all = false) { ev(OP.clear, pid(id), all ? 1 : 0); },
    offset(id, k) { ev(OP.offset, pid(id), k); },
    heat(id, i, v) { ev(OP.heat, pid(id), i, 0, v); },
    push(id, text, state = S.none) { ev(OP.push, pid(id), state, 0, 0, text); },
    pop(id) { ev(OP.pop, pid(id)); },
    splice(id, i, del, items) { ev(OP.splice, pid(id), i, del, 0, undefined, items.slice()); },
    swap(id, i, j) { ev(OP.swap, pid(id), i, j); },
    swapRows(id, r, q) { ev(OP.swapRows, pid(id), r, q); },
    link(a, i, b, j, state = S.hit) { ev(OP.link, pid(a), i, j, pid(b), String(state)); },
    unlink() { ev(OP.unlink, -1); },
    note(text) { ev(OP.note, -1, 0, 0, 0, text); },
    stat(label, value) { ev(OP.stat, -1, 0, 0, 0, label, [value]); },
    plot(series, x2, y) { ev(OP.plot, -1, 0, 0, x2, series, [String(y)]); },
    count(c) { return counts[cid(c)]; },
  };
  let result: R | undefined;
  let truncated = false;
  try {
    const r = kernel.run(ops, x, params);
    if (isSteps(r)) {
      let s = r.next();
      while (!s.done) { yield events.length; s = r.next(); }
      result = s.value;
    } else result = r;
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    truncated = true;
  }
  return { events, counters: names, labels: names.map((n) => kernel.counters[n]), counts, result,
    truncated };
}

/** Total counted operations of a trace: the lab's measure of work. */
export const work = (t: Trace) => t.counts.reduce((s, c) => s + c, 0);

/** A trace being recorded across frames: `pump` resumes it for about the given time. */
export class Recording<R = unknown> {
  trace: Trace<R | undefined> | null = null;
  private seen = 0;
  constructor(private readonly steps: Generator<number, Trace<R | undefined>>) {}
  get done(): boolean { return this.trace !== null; }
  /**
   * Resume until about `events` more events are recorded (at least one step; a step records at
   * most STEP_EVENTS); true once the trace is complete. Counted work, not wall-clock time, so a
   * slow or loaded machine does the same work per frame as a fast one.
   */
  pump(events = Infinity): boolean {
    const from = this.seen;
    while (!this.trace) {
      const r = this.steps.next();
      if (r.done) this.trace = r.value;
      else if ((this.seen = r.value) - from >= events) break;
    }
    return this.done;
  }
}
