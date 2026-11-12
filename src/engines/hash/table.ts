// The hash engine's measurable core. A kernel keeps its keys only in a Table it reaches through
// HashOps: every hash evaluation, slot or chain read (a probe), write, removal, resize, page split
// and directory doubling is counted and recorded as a trace, and the plate replays the trace on
// a Table of its own. Nothing here draws; the readouts and charts are computed from the trace.
import type { ParamDef, ParamValue } from '../../core/plate';

/** An open-addressing slot that never held a key. */
export const EMPTY = -1;
/** An open-addressing slot whose key was deleted (a tombstone). */
export const DELETED = -2;

export const OP = {
  /** a: kind, b: key. */
  begin: 0,
  /** a: kind, b: 1 when it succeeded, c: probes, d: page loads. */
  end: 1,
  /** a: function (0 primary, 1 secondary), b: key, c: hash value (as int32). */
  hash: 2,
  /** a: bucket, b: position, c: value read. */
  probe: 3,
  /** a: bucket, b: position, c: value written, d: the key's distance from its home. */
  write: 4,
  /** a: bucket, b: position (the entry is spliced out of a chain or page). */
  remove: 5,
  /** a: new bucket count, b: keys carried over. */
  resize: 6,
  /** a: page index, b: local depth. */
  newPage: 7,
  /** a: page, b: local depth. */
  depth: 8,
  /** a: new global depth. */
  double: 9,
  /** a: directory index, b: page. */
  setDir: 10,
  /** a: directory index, b: page. */
  dirRead: 11,
  /** a: 1 opens a measurement batch, 0 closes it; b: 1 while the workload deletes. */
  check: 12,
  /** a: page read from (simulated) secondary storage. */
  load: 13,
} as const;

export const KIND = { insert: 0, search: 1, remove: 2 } as const;
export const STRIDE = 5;
/** Events a trace may hold. */
export const EVENT_CAP = 3_000_000;
/** The deepest directory the engine allocates (2^MAX_DEPTH entries). */
export const MAX_DEPTH = 18;

/** The table's state: plain data, mutated identically by a kernel's run and by the replay. */
export class Table {
  buckets: number[][] = [];
  /** Per entry: how far the key sits from its home (probe distance, chain position). */
  dist: number[][] = [];
  dir: number[] = [];
  depths: number[] = [];
  globalDepth = 0;
  count = 0;
  tombstones = 0;

  get m(): number { return this.buckets.length; }

  value(b: number, i: number): number {
    const v = this.buckets[b][i];
    return v === undefined ? EMPTY : v;
  }

  write(b: number, i: number, v: number, d: number): void {
    const old = this.value(b, i);
    if (old >= 0) this.count--;
    else if (old === DELETED) this.tombstones--;
    if (v >= 0) this.count++;
    else if (v === DELETED) this.tombstones++;
    this.buckets[b][i] = v;
    this.dist[b][i] = d;
  }

  remove(b: number, i: number): void {
    const [v] = this.buckets[b].splice(i, 1);
    this.dist[b].splice(i, 1);
    if (v >= 0) this.count--;
    else if (v === DELETED) this.tombstones--;
  }

  /** Replace the table by m empty buckets; returns the keys it held, in bucket order. */
  resize(m: number): number[] {
    const keys = this.buckets.flat().filter((v) => v >= 0);
    this.buckets = Array.from({ length: m }, () => []);
    this.dist = Array.from({ length: m }, () => []);
    this.count = 0;
    this.tombstones = 0;
    return keys;
  }

  newPage(depth: number): number {
    this.buckets.push([]);
    this.dist.push([]);
    this.depths.push(depth);
    return this.buckets.length - 1;
  }

  double(): void {
    const next = new Array<number>(2 * Math.max(1, this.dir.length));
    for (let i = 0; i < next.length; i++) next[i] = this.dir[i >> 1];
    this.dir = next;
    this.globalDepth++;
  }
}

/** Apply one recorded event to a table (the replay's only way to change its state). */
export function apply(t: Table, ev: Int32Array, e: number): void {
  const o = STRIDE * e;
  switch (ev[o]) {
    case OP.write: t.write(ev[o + 1], ev[o + 2], ev[o + 3], ev[o + 4]); break;
    case OP.remove: t.remove(ev[o + 1], ev[o + 2]); break;
    case OP.resize: t.resize(ev[o + 1]); break;
    case OP.newPage: t.newPage(ev[o + 2]); break;
    case OP.depth: t.depths[ev[o + 1]] = ev[o + 2]; break;
    case OP.double: t.double(); break;
    case OP.setDir: t.dir[ev[o + 1]] = ev[o + 2]; break;
    default: break;
  }
}

// ---- hash functions -------------------------------------------------------------------------

/** Knuth's multiplier for Fibonacci hashing: the prime 2654435761, close to 2^32 / φ. */
export const GOLDEN = 0x9e3779b1;

/** The inverse of an odd a modulo 2^32 (Newton's iteration doubles the correct bits). */
export function inverse32(a: number): number {
  let x = a;
  for (let i = 0; i < 5; i++) x = Math.imul(x, 2 - Math.imul(a, x));
  return x >>> 0;
}

/** Primary hash: multiplicative (Fibonacci) hashing, a bijection on 32-bit keys. */
export function h1(key: number): number {
  return Math.imul(key, GOLDEN) >>> 0;
}

/** Secondary hash: the 32-bit finaliser of MurmurHash3, unrelated to h1. */
export function h2(key: number): number {
  let h = key >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A 32-bit hash reduced to 0..m-1 by its leading bits (multiply and keep the high word). */
export function slotOf(h: number, m: number): number {
  return Math.floor((h / 4294967296) * m);
}

/** The leading g bits of a 32-bit hash: the directory index of extendible hashing. */
export function topBits(h: number, g: number): number {
  return g === 0 ? 0 : h >>> (32 - g);
}

// ---- the operations a kernel may use --------------------------------------------------------

export interface HashOps {
  /** Buckets in the table: slots, chains or pages. */
  readonly m: number;
  /** Keys stored. */
  readonly count: number;
  /** Keys a page holds (extendible hashing). */
  readonly pageSize: number;
  readonly globalDepth: number;
  /** Values of the kernel's own parameters (Size.opts), empty when none were given. */
  readonly opts: Readonly<Record<string, ParamValue>>;
  /** One counted hash evaluation: fn 0 is h1, fn 1 is h2. */
  hash(key: number, fn?: 0 | 1): number;
  /** Entries in bucket b (structure, not a probe). */
  len(b: number): number;
  /** Read entry i of bucket b: one probe. An open slot reads as EMPTY, DELETED or its key. */
  read(b: number, i?: number): number;
  /** Write entry i of bucket b (i up to its length; at the length it appends). d: distance. */
  write(b: number, i: number, v: number, d?: number): void;
  /** Splice entry i out of bucket b. */
  remove(b: number, i: number): void;
  /** Allocate m empty buckets, returning the keys the old table held (each one read once). */
  resize(m: number): number[];
  /** Read a page from secondary storage (extendible hashing): counted as a page load. */
  load(b: number): void;
  /** Read directory entry i. */
  dir(i: number): number;
  setDir(i: number, b: number): void;
  /** Double the directory: every entry is copied into two. */
  doubleDir(): void;
  newPage(depth: number): number;
  depth(b: number): number;
  setDepth(b: number, d: number): void;
}

export interface Size {
  /** Keys the workload inserts. */
  n: number;
  /** Buckets the plate asks for (fixed-size schemes). */
  m: number;
  pageSize: number;
  /** Values of the kernel's own parameters; a kernel falls back to its defaults without them. */
  opts?: Readonly<Record<string, ParamValue>>;
}

/** Knuth's expected probes for a search at load factor a, as a labelled reference. */
export interface Expected {
  label: string;
  hit(a: number): number;
  miss(a: number): number;
}

/** Expected growth of an extendible-hashing file with n keys and pages of b keys. */
export interface Growth {
  label: string;
  pages(n: number, b: number): number;
  directory(n: number, b: number): number;
}

export interface HashKernel {
  /** How the plate draws the table. */
  layout: 'slots' | 'chains' | 'pages';
  /** The largest load factor (percent) the plate offers; omitted when the kernel sizes itself. */
  maxLoad?: number;
  init(t: HashOps, size: Size): void;
  /** Insert a key; false when it was already present. */
  insert(t: HashOps, key: number): boolean;
  search(t: HashOps, key: number): boolean;
  /** Delete a key; false when it was absent. */
  remove(t: HashOps, key: number): boolean;
  expected?: Expected;
  growth?: Growth;
  /** Parameters of the kernel itself, read through `t.opts` (a plate's, never a lab's). */
  params?: ParamDef[];
}

export interface Counts {
  hashes: number;
  probes: number;
  writes: number;
  removes: number;
  /** Resizes of a table that already held buckets. */
  rehashes: number;
  /** Keys carried from an old table into a new one. */
  rehashed: number;
  loads: number;
  splits: number;
  doublings: number;
  dirReads: number;
}

export interface Trace {
  events: Int32Array;
  length: number;
  counts: Counts;
  /** The table after the run. */
  table: Table;
  pageSize: number;
  truncated: boolean;
}

/** One step of a workload: an operation on a key, or a measurement-batch marker. */
export type Step =
  | { kind: 0 | 1 | 2; key: number }
  | { kind: 'check'; open: boolean; deleting: boolean };

class Stop extends Error {}
/** The directory would outgrow MAX_DEPTH: the run stops there, marked truncated. */
class Limit extends Stop {}

/** A run in progress: steps can be fed in slices, so a long run can be spread over frames. */
export interface Tracer {
  /** Run steps[from..] until they end, the run stops, or `budget` more events are recorded;
   * returns the index of the first step not run. */
  run(steps: Step[], from?: number, budget?: number): number;
  /** Events recorded so far. */
  readonly length: number;
  readonly truncated: boolean;
  result(): Trace;
}

/** Start a run of a kernel: allocate its table, ready for steps. */
export function tracer(kernel: HashKernel, size: Size, cap = EVENT_CAP): Tracer {
  const t = new Table();
  let buf = new Int32Array(STRIDE * 8192);
  let len = 0;
  const counts: Counts = { hashes: 0, probes: 0, writes: 0, removes: 0, rehashes: 0, rehashed: 0,
    loads: 0, splits: 0, doublings: 0, dirReads: 0 };
  let opProbes = 0;
  let opLoads = 0;
  const push = (op: number, a = 0, b = 0, c = 0, d = 0) => {
    if (len >= cap) throw new Stop();
    if (STRIDE * (len + 1) > buf.length) {
      const next = new Int32Array(buf.length * 2);
      next.set(buf);
      buf = next;
    }
    const o = STRIDE * len;
    buf[o] = op; buf[o + 1] = a; buf[o + 2] = b; buf[o + 3] = c; buf[o + 4] = d;
    len++;
  };
  const bucket = (b: number) => {
    if (!Number.isInteger(b) || b < 0 || b >= t.m) throw new RangeError(`bucket ${b} outside 0..${t.m - 1}`);
  };
  // every operation records its event first and changes state only once the event is in the
  // trace, so a truncated run's table and counts are exactly what its events replay to
  const ops: HashOps = {
    get m() { return t.m; },
    get count() { return t.count; },
    get globalDepth() { return t.globalDepth; },
    pageSize: size.pageSize,
    opts: size.opts ?? {},
    hash(key, fn = 0) {
      const h = fn === 0 ? h1(key) : h2(key);
      push(OP.hash, fn, key, h | 0);
      counts.hashes++;
      return h;
    },
    len(b) { bucket(b); return t.buckets[b].length; },
    read(b, i = 0) {
      bucket(b);
      const v = t.value(b, i);
      push(OP.probe, b, i, v);
      counts.probes++;
      opProbes++;
      return v;
    },
    write(b, i, v, d = 0) {
      bucket(b);
      if (i < 0 || i > t.buckets[b].length) throw new RangeError(`position ${i} outside bucket ${b}`);
      push(OP.write, b, i, v, d);
      counts.writes++;
      t.write(b, i, v, d);
    },
    remove(b, i) {
      bucket(b);
      if (i < 0 || i >= t.buckets[b].length) throw new RangeError(`position ${i} outside bucket ${b}`);
      push(OP.remove, b, i);
      counts.removes++;
      t.remove(b, i);
    },
    resize(m) {
      if (!Number.isInteger(m) || m < 1) throw new RangeError(`table size ${m}`);
      const had = t.m > 0;
      push(OP.resize, m, t.count);
      const keys = t.resize(m);
      if (had) { counts.rehashes++; counts.rehashed += keys.length; }
      return keys;
    },
    load(b) { bucket(b); push(OP.load, b); counts.loads++; opLoads++; },
    dir(i) {
      if (i < 0 || i >= t.dir.length) throw new RangeError(`directory index ${i}`);
      push(OP.dirRead, i, t.dir[i]);
      counts.dirReads++;
      return t.dir[i];
    },
    setDir(i, b) {
      if (i < 0 || i >= Math.max(1, t.dir.length)) throw new RangeError(`directory index ${i}`);
      push(OP.setDir, i, b);
      t.dir[i] = b;
    },
    doubleDir() {
      if (t.globalDepth >= MAX_DEPTH) throw new Limit();
      push(OP.double, t.globalDepth + 1);
      counts.doublings++;
      t.double();
    },
    newPage(depth) {
      push(OP.newPage, t.m, depth);
      if (t.m > 0) counts.splits++;
      return t.newPage(depth);
    },
    depth(b) { bucket(b); return t.depths[b]; },
    setDepth(b, d) { bucket(b); push(OP.depth, b, d); t.depths[b] = d; },
  };
  let truncated = false;
  const guard = (f: () => void) => {
    if (truncated) return;
    try { f(); } catch (e) {
      if (!(e instanceof Stop)) throw e;
      truncated = true;
    }
  };
  guard(() => kernel.init(ops, size));
  return {
    get length() { return len; },
    get truncated() { return truncated; },
    run(steps, from = 0, budget = Infinity) {
      const until = len + budget;
      let i = from;
      guard(() => {
        for (; i < steps.length && len < until; i++) {
          const s = steps[i];
          if (s.kind === 'check') { push(OP.check, s.open ? 1 : 0, s.deleting ? 1 : 0); continue; }
          push(OP.begin, s.kind, s.key);
          opProbes = 0;
          opLoads = 0;
          const ok = s.kind === KIND.insert ? kernel.insert(ops, s.key)
            : s.kind === KIND.search ? kernel.search(ops, s.key) : kernel.remove(ops, s.key);
          push(OP.end, s.kind, ok ? 1 : 0, opProbes, opLoads);
        }
      });
      return truncated ? steps.length : i;
    },
    result: () => ({ events: buf, length: len, counts: { ...counts }, table: t, pageSize: size.pageSize, truncated }),
  };
}

/** Run a kernel over a whole workload, recording every operation. */
export function trace(kernel: HashKernel, steps: Step[], size: Size, cap = EVENT_CAP): Trace {
  const r = tracer(kernel, size, cap);
  r.run(steps);
  return r.result();
}

/** The keys a table holds, whatever its layout. */
export function keysOf(t: Table): number[] {
  return t.buckets.flat().filter((v) => v >= 0);
}
