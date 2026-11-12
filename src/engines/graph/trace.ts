// The graph engine's measurable core. A kernel reads the graph's structure freely but does its
// work only through GraphOps: every discovery, settlement, edge scan, relaxation and write is
// counted and recorded as a trace, and the plate replays the trace. Nothing here draws.
import type { ParamDef, ParamValue } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import type { Graph, Shape } from './graph';

export const OP = {
  discover: 0, settle: 1, scan: 2, relax: 3, parent: 4, edge: 5, vertex: 6, group: 7,
  value: 8, flow: 9, cell: 10, place: 11, round: 12,
} as const;

/** What a vertex shows: not reached, on the frontier, finished, marked, set aside. */
export const V = { unseen: 0, frontier: 1, done: 2, mark: 3, dim: 4 } as const;
/** What an edge shows: untouched, examined, tree or chosen, non-tree, marked, cut, dropped. */
export const E = { none: 0, seen: 1, tree: 2, back: 3, mark: 4, cut: 5, drop: 6 } as const;

export interface GraphOps {
  readonly g: Graph;
  /** Seeded randomness for randomised kernels (visit orders, ties, infections). */
  readonly rnd: () => number;
  /** v joins the frontier: queued, pushed, discovered, infected. */
  discover(v: number): void;
  /** v leaves the frontier for good: visited, settled, finished, recovered. */
  settle(v: number): void;
  /** Examine edge e. */
  scan(e: number): void;
  /** One relaxation test of edge e; `improved` when it shortened a distance. */
  relax(e: number, improved: boolean): void;
  /** e becomes v's tree edge (-1: none); the previous tree edge of v is released. */
  parent(v: number, e: number): void;
  /** Show edge e in state s (a member of E). */
  edge(e: number, s: number): void;
  /** Show vertex v in state s (a member of V). */
  vertex(v: number, s: number): void;
  /** Put v in group k: a component, community, label, layer or wave (-1: none). */
  group(v: number, k: number): void;
  /** v's number: a distance, rank, score or activation. */
  value(v: number, x: number): void;
  /** The flow on edge e. */
  flow(e: number, x: number): void;
  /** Entry (i, j) of the kernel's matrix. */
  cell(i: number, j: number, x: number): void;
  /** Move v (layouts); z for 3D placements. */
  place(v: number, x: number, y: number, z?: number): void;
  /** One round, pass or iteration ends. */
  round(): void;
}

export interface Counts {
  discovers: number; settles: number; scans: number; relaxations: number; improvements: number;
  values: number; flows: number; cells: number; places: number; groups: number; rounds: number;
  marks: number;
}

export function emptyCounts(): Counts {
  return { discovers: 0, settles: 0, scans: 0, relaxations: 0, improvements: 0, values: 0,
    flows: 0, cells: 0, places: 0, groups: 0, rounds: 0, marks: 0 };
}

/** The work of a run: every counted primitive operation (marks and rounds are free). */
export function work(c: Counts): number {
  return c.discovers + c.settles + c.scans + c.relaxations + c.values + c.flows + c.cells + c.places + c.groups;
}

export interface Options {
  s: number;
  t: number;
  /** The kernel's own parameters, by key. */
  p: Record<string, ParamValue>;
}

/** Engine-measured quantities a kernel may chart (one y-axis, so pick comparable ones). */
export type SeriesKey = 'frontier' | 'done' | 'unseen' | 'marked' | 'tree' | 'groups' | 'modularity'
  | 'change' | 'flow' | 'treeWeight' | 'cells' | 'total';
/** Engine-measured readouts a kernel may show. */
export type ReadoutKey = 'discovers' | 'settles' | 'scans' | 'relaxations' | 'values' | 'flows'
  | 'cells' | 'places' | 'rounds' | 'frontier' | 'maxFrontier' | 'done' | 'marked' | 'tree'
  | 'treeWeight' | 'groups' | 'modularity' | 'flow' | 'change' | 'total';

export interface View {
  /** How vertices are coloured. */
  colour?: 'state' | 'group' | 'value';
  /** Scale vertex size by value. */
  size?: boolean;
  /** Draw the kernel's n x n matrix beside the graph. */
  matrix?: 'distance' | 'boolean';
  /** Draw edge flows against capacities. */
  flow?: boolean;
  /** Vertices carry z: rotate and project. */
  sphere?: boolean;
  /** Draw each vertex's place in the input as a faint anchor. */
  anchors?: boolean;
  /** Draw record names (small inputs). */
  names?: boolean;
  /** Draw the shape's known classes as rings. */
  truth?: boolean;
  /** Draw the edge weights (small inputs). */
  weights?: boolean;
  /** Leave untouched edges out of the drawing (complete graphs). */
  hidden?: boolean;
}

export interface GraphKernel<R = unknown> {
  /** Which reference the test harness checks the result against. */
  goal: string;
  /** Input shapes the kernel accepts; the first is the default. */
  inputs: Shape[];
  /** The vertex-count control. */
  n?: { min: number; max: number; value: number };
  /** The kernel's own controls; their values reach `run` as opts.p. */
  params?: ParamDef[];
  /** Whether the plate lets the reader pick the source vertex (s) by tapping. */
  pick?: 's' | 't';
  view?: View;
  /** What the readouts call the frontier, finished and marked states. */
  names?: { frontier?: string; done?: string; marked?: string; tree?: string; groups?: string; value?: string; total?: string };
  readouts?: ReadoutKey[];
  chart?: { title: string; y: string; x?: 'ops' | 'rounds'; series: SeriesKey[]; log?: boolean };
  /** Events replayed per frame by default. */
  speed?: number;
  /** Mark the source (circled), the target (boxed) or both on the drawing. */
  endpoints?: 's' | 't' | 'st';
  /**
   * The algorithm, as a generator that yields at its natural pauses (a vertex settled, a round
   * done): the engine resumes it a few milliseconds per frame, so no run blocks a frame
   * whatever its size, and runs it to the end in one go for tests and thumbnails.
   */
  steps(ops: GraphOps, opts: Options): Generator<Work, R, void>;
  /**
   * True for an exponential search that may stop at the event cap on large inputs (the plate
   * says so); every other kernel must finish at its maximum size.
   */
  mayStop?: boolean;
  /** A lower event cap for such a kernel, to bound the memory its trace may take. */
  cap?: number;
  /** Readouts of the finished run, computed from its result. */
  report?(r: R, g: Graph, opts: Options): { label: string; value: string }[];
}

export interface Trace<R = unknown> {
  g: Graph;
  opts: Options;
  /** Events, five numbers each: op, a, b, x, y. Grows while the run is computing. */
  events: Float64Array;
  length: number;
  counts: Counts;
  result: R | undefined;
  truncated: boolean;
  /** False while an incremental run still has steps to take. */
  finished: boolean;
}

export const EVENT_CAP = 600_000;
const W = 5;

class Stop extends Error {}

/**
 * What a kernel yields: nothing, when the events it recorded since its last yield are its work,
 * or a count of work units it did without recording them (all-pairs forces, the comparisons of
 * a matrix round), which the engine adds to those events.
 */
export type Work = number | void;

/**
 * A run in progress: `step` computes until the work units spent reach `units` (Infinity: to
 * the end). Work is counted, not timed, so a frame's share is the same on every machine; a
 * step never splits a kernel's own step, so kernels yield often.
 */
export interface Running<R = unknown> {
  readonly t: Trace<R>;
  step(units: number): void;
}

/**
 * Start `kernel` on `g`, recording every operation (or only counting them when `record` is
 * false, for the lab's scaling runs). A run that passes `cap` events stops and is truncated.
 * Nothing is computed until the first `step`.
 */
export function start<R>(kernel: GraphKernel<R>, g: Graph, opts: Options, seed = 1,
  cap = EVENT_CAP, record = true): Running<R> {
  const t: Trace<R> = {
    g, opts, events: new Float64Array(record ? W * 4096 : 0), length: 0, counts: emptyCounts(),
    result: undefined, truncated: false, finished: false,
  };
  const counts = t.counts;
  const push = (op: number, a: number, b: number, x: number, y: number) => {
    if (t.length >= cap) throw new Stop();
    if (record) {
      if (W * t.length + W > t.events.length) {
        const next = new Float64Array(t.events.length * 2);
        next.set(t.events);
        t.events = next;
      }
      const o = W * t.length;
      const buf = t.events;
      buf[o] = op; buf[o + 1] = a; buf[o + 2] = b; buf[o + 3] = x; buf[o + 4] = y;
    }
    t.length++;
  };
  const vi = (v: number) => {
    if (!Number.isInteger(v) || v < 0 || v >= g.n) throw new RangeError(`vertex ${v} outside 0..${g.n - 1}`);
  };
  const ei = (e: number) => {
    if (!Number.isInteger(e) || e < 0 || e >= g.m) throw new RangeError(`edge ${e} outside 0..${g.m - 1}`);
  };
  const ops: GraphOps = {
    g,
    rnd: mulberry32(seed),
    discover(v) { vi(v); counts.discovers++; push(OP.discover, v, 0, 0, 0); },
    settle(v) { vi(v); counts.settles++; push(OP.settle, v, 0, 0, 0); },
    scan(e) { ei(e); counts.scans++; push(OP.scan, e, 0, 0, 0); },
    relax(e, improved) {
      ei(e); counts.relaxations++;
      if (improved) counts.improvements++;
      push(OP.relax, e, improved ? 1 : 0, 0, 0);
    },
    parent(v, e) { vi(v); if (e >= 0) ei(e); push(OP.parent, v, e, 0, 0); },
    edge(e, s) { ei(e); counts.marks++; push(OP.edge, e, s, 0, 0); },
    vertex(v, s) { vi(v); counts.marks++; push(OP.vertex, v, s, 0, 0); },
    group(v, k) { vi(v); counts.groups++; push(OP.group, v, k, 0, 0); },
    value(v, x) { vi(v); counts.values++; push(OP.value, v, 0, x, 0); },
    flow(e, x) { ei(e); counts.flows++; push(OP.flow, e, 0, x, 0); },
    cell(i, j, x) { vi(i); vi(j); counts.cells++; push(OP.cell, i, j, x, 0); },
    place(v, x, y, z = 0) { vi(v); counts.places++; push(OP.place, v, z, x, y); },
    round() { counts.rounds++; push(OP.round, 0, 0, 0, 0); },
  };
  let gen: Generator<Work, R, void> | null = null;
  const finish = (result: R | undefined, truncated: boolean) => {
    t.result = result;
    t.truncated = truncated;
    t.finished = true;
    // keep only what was recorded: the doubling slack would otherwise stay allocated
    if (record && t.events.length > W * t.length) t.events = t.events.slice(0, W * t.length);
  };
  return {
    t,
    step(units: number) {
      if (t.finished) return;
      let spent = 0;
      try {
        gen ??= kernel.steps(ops, opts);
        for (;;) {
          const before = t.length;
          const r = gen.next();
          if (r.done) { finish(r.value, false); return; }
          spent += Math.max(1, t.length - before + (typeof r.value === 'number' ? r.value : 0));
          if (spent >= units) return;
        }
      } catch (e) {
        if (!(e instanceof Stop)) throw e;
        finish(undefined, true);
      }
    },
  };
}

/** Run `kernel` to the end; see `start`. */
export function trace<R>(kernel: GraphKernel<R>, g: Graph, opts: Options, seed = 1,
  cap = EVENT_CAP, record = true): Trace<R> {
  const r = start(kernel, g, opts, seed, cap, record);
  r.step(Infinity);
  return r.t;
}

/** Defaults of a kernel's own parameters, for tests and labs. */
export function defaultParams(kernel: GraphKernel): Record<string, ParamValue> {
  const p: Record<string, ParamValue> = {};
  for (const d of kernel.params ?? []) p[d.key] = d.value;
  return p;
}

/** Newman's modularity of a partition of an undirected graph, edges weighted by w (or 1). */
export function modularity(g: Graph, group: ArrayLike<number>, weighted = false): number {
  let total = 0;
  const deg = new Float64Array(g.n);
  const inside = new Map<number, number>();
  const degOf = new Map<number, number>();
  for (let e = 0; e < g.m; e++) {
    const w = weighted ? g.w[e] : 1;
    const u = g.eu[e]; const v = g.ev[e];
    total += w;
    deg[u] += w; deg[v] += w;
    if (group[u] === group[v] && group[u] >= 0) inside.set(group[u], (inside.get(group[u]) ?? 0) + w);
  }
  if (!total) return 0;
  for (let v = 0; v < g.n; v++) if (group[v] >= 0) degOf.set(group[v], (degOf.get(group[v]) ?? 0) + deg[v]);
  let q = 0;
  for (const [k, d] of degOf) q += (inside.get(k) ?? 0) / total - (d / (2 * total)) ** 2;
  return q;
}
