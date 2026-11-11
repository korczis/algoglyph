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
  /** Default replay speed: counted operations and notes per frame. */
  speed?: number;
  aspect?: number;
  chart?: { title: string; x: string; y: string; xlog?: boolean; ylog?: boolean };
  run(ops: StringOps, x: Inputs[K], params: Params): R;
}

export interface Trace<R = unknown> {
  events: Ev[];
  counters: string[];
  labels: string[];
  counts: number[];
  result: R;
  truncated: boolean;
}

export const EVENT_CAP = 1_500_000;
class Stop extends Error {}

/** Run a kernel on an input, recording every event. */
export function trace<K extends InputKind, R>(kernel: StringKernel<K, R>, x: Inputs[K],
  params: Params = {}, cap = EVENT_CAP): Trace<R | undefined> {
  const names = Object.keys(kernel.counters);
  const counts = names.map(() => 0);
  const events: Ev[] = [];
  const parts = new Map<string, { n: number; kind: PartKind; cols: number }>();
  const ev = (o: number, p: number, i = 0, j = 0, v = 0, s?: string, ss?: string[]) => {
    if (events.length >= cap) throw new Stop();
    events.push({ o, p, i, j, v, s, ss });
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
    result = kernel.run(ops, x, params);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    truncated = true;
  }
  return { events, counters: names, labels: names.map((n) => kernel.counters[n]), counts, result,
    truncated };
}

/** Total counted operations of a trace: the lab's measure of work. */
export const work = (t: Trace) => t.counts.reduce((s, c) => s + c, 0);
