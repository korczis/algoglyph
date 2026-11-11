// The tree engine's measurable core. A kernel builds and searches its structure only through
// TreeOps: nodes with keys and ordered child slots, an optional array (heaps, union-find), and
// a few root slots for forests. Every operation is counted and recorded as an event; the plate
// replays the events onto a Store of its own, so the picture and the readouts come from the run.
import type { ParamDef } from '../../core/plate';
import { mulberry32 } from '../../core/random';

export type Key = number | string;
export const NIL = -1;

export const EV = {
  /** An operation starts: a = op kind index, p = its caption. */
  begin: 0,
  make: 1,
  free: 2,
  keys: 3,
  child: 4,
  children: 5,
  tag: 6,
  info: 7,
  root: 8,
  visit: 9,
  compare: 10,
  digit: 11,
  rotate: 12,
  split: 13,
  get: 14,
  set: 15,
  size: 16,
  emit: 17,
  found: 18,
} as const;

export const OP_KINDS = ['insert', 'search', 'delete', 'union', 'remove', 'traverse', 'balance',
  'merge', 'replace', 'drain'] as const;
export type OpKind = (typeof OP_KINDS)[number];

/** One event: op, three integers, and an optional payload (keys, child list, caption). */
export interface Ev {
  o: number;
  a: number;
  b: number;
  c: number;
  p?: unknown;
}

export interface Counts {
  compares: number;
  digits: number;
  visits: number;
  links: number;
  rotations: number;
  splits: number;
  recolours: number;
  nodes: number;
  reads: number;
  writes: number;
}

const zero = (): Counts => ({ compares: 0, digits: 0, visits: 0, links: 0, rotations: 0, splits: 0,
  recolours: 0, nodes: 0, reads: 0, writes: 0 });

/** The structure a kernel leaves behind; the plate keeps its own copy, replayed from events. */
export class Store {
  keys: Key[][] = [];
  kids: number[][] = [];
  tag: number[] = [];
  info: number[] = [];
  alive: boolean[] = [];
  roots: number[] = [];
  arr: number[] = [];
  /** How much of the array is in use (a heap's size, the number of union-find sites). */
  size = 0;
  constructor(arrayLength = 0) {
    this.arr = new Array<number>(arrayLength).fill(0);
  }
  apply(e: Ev): void {
    switch (e.o) {
      case EV.make:
        this.keys[e.a] = (e.p as Key[]).slice();
        this.kids[e.a] = new Array<number>(e.b).fill(NIL);
        this.tag[e.a] = e.c;
        this.info[e.a] = 0;
        this.alive[e.a] = true;
        break;
      case EV.free: this.alive[e.a] = false; break;
      case EV.keys: this.keys[e.a] = (e.p as Key[]).slice(); break;
      case EV.child: this.kids[e.a][e.b] = e.c; break;
      case EV.children: this.kids[e.a] = (e.p as number[]).slice(); break;
      case EV.tag: this.tag[e.a] = e.b; break;
      case EV.info: this.info[e.a] = e.b; break;
      case EV.root:
        while (this.roots.length <= e.a) this.roots.push(NIL);
        this.roots[e.a] = e.b;
        break;
      case EV.set: this.arr[e.a] = e.b; break;
      case EV.size: this.size = e.a; break;
      default: break;
    }
  }
  /** Live nodes reachable from the roots by child links, each once, with its depth. */
  walk(): { id: number; depth: number }[] {
    const seen = new Set<number>();
    const out: { id: number; depth: number }[] = [];
    const stack: [number, number][] = [];
    for (let r = this.roots.length - 1; r >= 0; r--) if (this.roots[r] !== NIL) stack.push([this.roots[r], 0]);
    while (stack.length) {
      const [x, d] = stack.pop()!;
      if (seen.has(x) || !this.alive[x]) continue;
      seen.add(x);
      out.push({ id: x, depth: d });
      const k = this.kids[x];
      for (let i = k.length - 1; i >= 0; i--) if (k[i] !== NIL && !seen.has(k[i])) stack.push([k[i], d + 1]);
    }
    return out;
  }
}

export type InputKind = 'keys' | 'bits' | 'words' | 'pairs' | 'weights';

export interface Workload {
  kind: InputKind;
  shape: string;
  /** Inserted in this order. */
  keys: Key[];
  /** Looked up after the inserts: about half present, half absent. */
  searches: Key[];
  /** Removed after the searches, by the kernels that delete. */
  deletes: Key[];
  /** Union-find: the connections, in order, over sites 0..sites-1. */
  pairs: [number, number][];
  sites: number;
  /** Digital keys: their width in bits, most significant first. */
  bits: number;
  /** Huffman: symbol labels and their frequencies. */
  symbols: string[];
  weights: number[];
  /** Values of the kernel's own parameters (memory size, B-tree degree). */
  opts: Record<string, number>;
  seed: number;
}

export interface TreeOps {
  readonly w: Workload;
  make(keys: Key[], degree: number, tag?: number): number;
  free(x: number): void;
  keys(x: number): readonly Key[];
  key(x: number, i?: number): Key;
  setKeys(x: number, keys: Key[]): void;
  degree(x: number): number;
  child(x: number, i: number): number;
  /** A link change; counted only when it changes something. */
  setChild(x: number, i: number, c: number): void;
  setChildren(x: number, cs: number[]): void;
  tag(x: number): number;
  /** A recolour; counted only when it changes the colour. */
  setTag(x: number, t: number): void;
  /** Bookkeeping kept in a node (size, height, bit index, weight); recorded, not counted. */
  info(x: number): number;
  setInfo(x: number, v: number): void;
  root(slot?: number): number;
  setRoot(slot: number, x: number): void;
  /** One step of a search path onto node (or array position) x. */
  visit(x: number): void;
  /** One three-way key comparison: -1, 0 or 1. `at` is the node it happens at. */
  cmp(a: Key, b: Key, at?: number): number;
  less(a: Key, b: Key, at?: number): boolean;
  /** One digit inspection: bit b (0 = most significant) of a w-bit key. */
  bit(k: number, b: number, at?: number): number;
  /** One character inspection of a string key: its code, or -1 past the end. */
  char(s: string, i: number, at?: number): number;
  rotate(x: number): void;
  split(x: number): void;
  get(i: number): number;
  set(i: number, v: number): void;
  /** The part of the array in use (drawing only). */
  size(n: number): void;
  begin(kind: OpKind, caption: string, phase?: string): void;
  /** Output, in order; `group` separates runs or traversal orders. */
  emit(v: Key, group?: number): void;
  found(k: Key, yes: boolean): void;
  /** Seeded randomness, for the randomized kernels. */
  random(): number;
}

export interface Structure {
  /** What the test harness checks the result against. */
  kind: 'bst' | 'avl' | 'red-black' | 'multiway' | 'heap' | 'binomial' | 'runs' | 'binary-trie'
    | 'dst' | 'patricia' | 'rway-trie' | 'tst' | 'union-find' | 'huffman' | 'traversal';
}

export interface TreeKernel {
  input: InputKind;
  structure: Structure['kind'];
  /** How the plate draws it: explicit nodes, a heap in the array, or parent links in the array. */
  view?: 'nodes' | 'heap' | 'parent';
  /** Node placement: in-order (a key between its subtrees) or tidy (a node centred over its
   * children); in-order is used by default for nodes shaped like search-tree nodes. */
  layout?: 'inorder' | 'tidy';
  /** How nodes are coloured: by key, red/black tag, terminal tag, or component (parent view). */
  colour?: 'key' | 'red-black' | 'terminal';
  /** Whether the kernel removes `w.deletes` after its searches. */
  deletes?: boolean;
  /** Parameters of the kernel itself, read through `w.opts`. */
  params?: ParamDef[];
  /** Array view: how a stored value reads (replacement selection packs run and key). */
  decode?(v: number): { key: number; group: number };
  /** A node's bookkeeping value worth printing beside it (bit index, weight). */
  infoLabel?: string;
  run(t: TreeOps): void;
}

export interface OpRecord {
  kind: OpKind;
  caption: string;
  /** A stage of the run the kernel names (before and after rebalancing), for separate costs. */
  phase?: string;
  /** Index of its begin event, and the counts when it began. */
  at: number;
  c: Counts;
}

export interface Trace {
  events: Ev[];
  counts: Counts;
  ops: OpRecord[];
  outputs: { v: Key; group: number }[];
  found: { k: Key; yes: boolean }[];
  /** The structure as the kernel left it. */
  store: Store;
  workload: Workload;
  /** Events performed, recorded or not. */
  steps: number;
  truncated: boolean;
}

export const EVENT_CAP = 2_000_000;

/** Children in `next` that `prev` did not hold: the links a child-list rewrite creates. */
export function linksCreated(prev: readonly number[], next: readonly number[]): number {
  const had = new Set(prev);
  let made = 0;
  for (const c of next) if (c !== NIL && !had.has(c)) made++;
  return made;
}

class Stop extends Error {}

/** Array length a workload needs: heap positions 1..n, or ids and sizes of union-find sites. */
function arrayLength(w: Workload): number {
  return Math.max(w.keys.length, w.weights.length, 2 * w.sites) + 2;
}

/** Run `kernel` on `w`, recording every operation (or, with record off, only counting). */
export function trace(kernel: TreeKernel, w: Workload, record = true, cap = EVENT_CAP): Trace {
  const s = new Store(arrayLength(w));
  const events: Ev[] = [];
  const counts = zero();
  const ops: OpRecord[] = [];
  const outputs: { v: Key; group: number }[] = [];
  const found: { k: Key; yes: boolean }[] = [];
  const rnd = mulberry32(w.seed ^ 0x5bd1e995);
  let n = 0;
  const push = (e: Ev) => {
    if (n >= cap) throw new Stop();
    n++;
    s.apply(e);
    if (record) events.push(e);
  };
  const node = (x: number) => {
    if (!Number.isInteger(x) || x < 0 || x >= s.kids.length || !s.alive[x]) throw new RangeError(`node ${x} does not exist`);
  };
  const cell = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= s.arr.length) throw new RangeError(`index ${i} outside 0..${s.arr.length - 1}`);
  };
  const cmp = (a: Key, b: Key) => (a < b ? -1 : a > b ? 1 : 0);
  const ops_: TreeOps = {
    w,
    make(keys, degree, tag = 0) {
      const x = s.kids.length;
      counts.nodes++;
      push({ o: EV.make, a: x, b: degree, c: tag, p: keys.slice() });
      return x;
    },
    free(x) { node(x); push({ o: EV.free, a: x, b: 0, c: 0 }); },
    keys(x) { node(x); return s.keys[x]; },
    key(x, i = 0) { node(x); return s.keys[x][i]; },
    setKeys(x, keys) { node(x); push({ o: EV.keys, a: x, b: 0, c: 0, p: keys.slice() }); },
    degree(x) { node(x); return s.kids[x].length; },
    child(x, i) {
      node(x);
      if (i < 0 || i >= s.kids[x].length) throw new RangeError(`child ${i} of node ${x} (degree ${s.kids[x].length})`);
      return s.kids[x][i];
    },
    setChild(x, i, c) {
      node(x);
      if (i < 0 || i >= s.kids[x].length) throw new RangeError(`child ${i} of node ${x} (degree ${s.kids[x].length})`);
      if (c !== NIL) node(c);
      if (s.kids[x][i] === c) return;
      counts.links++;
      push({ o: EV.child, a: x, b: i, c });
    },
    setChildren(x, cs) {
      node(x);
      for (const c of cs) if (c !== NIL) node(c);
      const old = s.kids[x];
      if (old.length === cs.length && old.every((c, i) => c === cs[i])) return;
      // a link is counted when it is created; shifting a slot or dropping a child is not one
      counts.links += linksCreated(old, cs);
      push({ o: EV.children, a: x, b: 0, c: 0, p: cs.slice() });
    },
    tag(x) { node(x); return s.tag[x]; },
    setTag(x, t) {
      node(x);
      if (s.tag[x] === t) return;
      counts.recolours++;
      push({ o: EV.tag, a: x, b: t, c: 0 });
    },
    info(x) { node(x); return s.info[x]; },
    setInfo(x, v) {
      node(x);
      if (s.info[x] === v) return;
      push({ o: EV.info, a: x, b: v, c: 0 });
    },
    root(slot = 0) { return s.roots[slot] ?? NIL; },
    setRoot(slot, x) {
      if (x !== NIL) node(x);
      if ((s.roots[slot] ?? NIL) === x) return;
      counts.links++;
      push({ o: EV.root, a: slot, b: x, c: 0 });
    },
    visit(x) { counts.visits++; push({ o: EV.visit, a: x, b: 0, c: 0 }); },
    cmp(a, b, at = NIL) { counts.compares++; push({ o: EV.compare, a: at, b: 0, c: 0 }); return cmp(a, b); },
    less(a, b, at = NIL) { return ops_.cmp(a, b, at) < 0; },
    bit(k, b, at = NIL) {
      counts.digits++;
      push({ o: EV.digit, a: at, b, c: 0 });
      return Math.floor(k / 2 ** (w.bits - 1 - b)) & 1;
    },
    char(str, i, at = NIL) {
      counts.digits++;
      push({ o: EV.digit, a: at, b: i, c: 0 });
      return i < str.length ? str.charCodeAt(i) : -1;
    },
    rotate(x) { counts.rotations++; push({ o: EV.rotate, a: x, b: 0, c: 0 }); },
    split(x) { counts.splits++; push({ o: EV.split, a: x, b: 0, c: 0 }); },
    get(i) { cell(i); counts.reads++; push({ o: EV.get, a: i, b: 0, c: 0 }); return s.arr[i]; },
    set(i, v) { cell(i); counts.writes++; push({ o: EV.set, a: i, b: v, c: 0 }); },
    size(k) { push({ o: EV.size, a: k, b: 0, c: 0 }); },
    begin(kind, caption, phase) {
      ops.push({ kind, caption, at: n, c: { ...counts }, ...(phase ? { phase } : {}) });
      push({ o: EV.begin, a: OP_KINDS.indexOf(kind), b: 0, c: 0, p: caption });
    },
    emit(v, group = 0) { outputs.push({ v, group }); push({ o: EV.emit, a: group, b: 0, c: 0, p: v }); },
    found(k, yes) { found.push({ k, yes }); push({ o: EV.found, a: yes ? 1 : 0, b: 0, c: 0, p: k }); },
    random: rnd,
  };
  let truncated = false;
  try {
    kernel.run(ops_);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    truncated = true;
  }
  return { events, counts, ops, outputs, found, store: s, workload: w, steps: n, truncated };
}

/** The counts an operation kind spent, summed over its operations, and how many there were. */
export function costOf(t: Trace, kind: OpKind, fields: (keyof Counts)[], phase?: string):
  { total: number; ops: number; max: number } {
  let total = 0; let count = 0; let max = 0;
  t.ops.forEach((op, i) => {
    if (op.kind !== kind || (phase !== undefined && (op.phase ?? '') !== phase)) return;
    const end = i + 1 < t.ops.length ? t.ops[i + 1].c : t.counts;
    // the cost of one operation is the sum of its fields, so its maximum is a maximum of sums
    let d = 0;
    for (const f of fields) d += end[f] - op.c[f];
    total += d; count++; max = Math.max(max, d);
  });
  return { total, ops: count, max };
}

/** The (kind, phase) groups of a trace's operations, in order of first appearance. */
export function opGroups(t: Trace): { kind: OpKind; phase: string }[] {
  const seen = new Map<string, { kind: OpKind; phase: string }>();
  for (const op of t.ops) {
    const g = { kind: op.kind, phase: op.phase ?? '' };
    const key = `${g.kind}|${g.phase}`;
    if (!seen.has(key)) seen.set(key, g);
  }
  return [...seen.values()];
}

// ---- workloads ------------------------------------------------------------------------------

export const SHAPES: Record<InputKind, { value: string; label: string }[]> = {
  keys: [
    { value: 'random', label: 'Random order' },
    { value: 'ascending', label: 'Ascending' },
    { value: 'descending', label: 'Descending' },
    { value: 'zigzag', label: 'Zig-zag (low, high, low...)' },
  ],
  bits: [
    { value: 'random', label: 'Random keys' },
    { value: 'ascending', label: 'Ascending' },
    { value: 'clustered', label: 'Clustered (shared prefixes)' },
  ],
  words: [
    { value: 'random', label: 'Random words' },
    { value: 'ascending', label: 'Alphabetical' },
    { value: 'prefixes', label: 'Many shared prefixes' },
  ],
  pairs: [
    { value: 'random', label: 'Random connections' },
    { value: 'chain', label: 'Chain (worst case for quick-union)' },
    { value: 'clusters', label: 'Local clusters' },
  ],
  weights: [
    { value: 'zipf', label: 'Zipf-like frequencies' },
    { value: 'uniform', label: 'Random frequencies' },
    { value: 'fibonacci', label: 'Fibonacci frequencies (deepest tree)' },
  ],
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** The letters words are drawn from; a small alphabet makes prefixes shared and tries deep. */
export const WORD_LETTERS = 'abcde';
/** Largest alphabet a Huffman workload can label. */
export const MAX_SYMBOLS = ALPHABET.length;

function order(seq: number[], shape: string, rnd: () => number): number[] {
  const a = seq.slice().sort((x, y) => x - y);
  if (shape === 'ascending') return a;
  if (shape === 'descending') return a.reverse();
  if (shape === 'zigzag') {
    const out: number[] = [];
    for (let i = 0, j = a.length - 1; i <= j; i++, j--) { out.push(a[i]); if (i !== j) out.push(a[j]); }
    return out;
  }
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function sample<T>(pool: T[], k: number, rnd: () => number): T[] {
  const a = pool.slice();
  for (let i = 0; i < Math.min(k, a.length); i++) {
    const j = i + Math.floor(rnd() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(k, a.length));
}

function randomWord(rnd: () => number, letters: string, prefix = ''): string {
  const len = 1 + Math.floor(rnd() * 4) + (rnd() < 0.3 ? 1 : 0);
  let s = prefix;
  while (s.length < len + prefix.length) s += letters[Math.floor(rnd() * letters.length)];
  return s;
}

/** A seeded workload of n items of the kernel's input kind. */
export function workload(kind: InputKind, shape: string, n: number, seed: number,
  opts: Record<string, number> = {}): Workload {
  const rnd = mulberry32(seed);
  const w: Workload = { kind, shape, keys: [], searches: [], deletes: [], pairs: [], sites: 0, bits: 0,
    symbols: [], weights: [], opts, seed };
  if (kind === 'keys' || kind === 'bits') {
    let pool: number[];
    if (kind === 'keys') {
      // keys 1..2n: n of them inserted, the rest available as misses
      pool = Array.from({ length: 2 * n }, (_, i) => i + 1);
    } else {
      w.bits = Math.max(4, Math.ceil(Math.log2(Math.max(2, 4 * n))));
      const span = 2 ** w.bits;
      pool = Array.from({ length: span }, (_, i) => i);
      if (shape === 'clustered') {
        // a few dense blocks: keys that agree on their leading bits
        const block = Math.max(4, Math.ceil(n / 4));
        const starts = sample(Array.from({ length: Math.floor(span / block) }, (_, i) => i * block), 4, rnd);
        pool = starts.flatMap((s) => Array.from({ length: block }, (_, i) => s + i));
      }
    }
    const chosen = sample(pool, n, rnd);
    const inSet = new Set(chosen);
    w.keys = order(chosen, shape === 'clustered' ? 'random' : shape, rnd);
    const misses = (kind === 'keys' ? pool : Array.from({ length: 2 ** w.bits }, (_, i) => i)).filter((x) => !inSet.has(x));
    const m = Math.max(1, Math.floor(n / 2));
    const hits = sample(chosen, Math.ceil(m / 2), rnd);
    const miss = sample(misses, Math.floor(m / 2), rnd);
    w.searches = order([...hits, ...miss], 'random', rnd);
    w.deletes = sample(chosen, Math.floor(n / 2), rnd);
  } else if (kind === 'words') {
    const set = new Set<string>();
    const stems = Array.from({ length: 3 }, () => randomWord(rnd, WORD_LETTERS));
    let guard = 0;
    while (set.size < n && guard++ < n * 200) {
      set.add(shape === 'prefixes' ? randomWord(rnd, WORD_LETTERS, stems[Math.floor(rnd() * stems.length)])
        : randomWord(rnd, WORD_LETTERS));
    }
    const words = [...set];
    w.keys = shape === 'ascending' ? words.slice().sort() : sample(words, words.length, rnd);
    const misses: string[] = [];
    guard = 0;
    while (misses.length < Math.floor(n / 4) && guard++ < n * 200) {
      const x = randomWord(rnd, WORD_LETTERS);
      if (!set.has(x) && !misses.includes(x)) misses.push(x);
    }
    w.searches = sample([...sample(words, Math.ceil(n / 4), rnd), ...misses], n, rnd);
    w.deletes = sample(words, Math.floor(n / 2), rnd);
  } else if (kind === 'pairs') {
    w.sites = n;
    const m = Math.ceil(1.5 * n);
    if (shape === 'chain') {
      for (let i = 0; i + 1 < n; i++) w.pairs.push([i, i + 1]);
      while (w.pairs.length < m && n > 1) {
        const p = Math.floor(rnd() * n); const q = Math.floor(rnd() * n);
        if (p !== q) w.pairs.push([p, q]);
      }
    } else {
      const width = Math.max(2, Math.round(Math.sqrt(n)));
      while (w.pairs.length < m && n > 1) {
        const p = Math.floor(rnd() * n);
        const q = shape === 'clusters'
          ? Math.min(n - 1, Math.max(0, p + Math.round((rnd() - 0.5) * 2 * width)))
          : Math.floor(rnd() * n);
        if (p !== q) w.pairs.push([p, q]);
      }
    }
  } else {
    const k = Math.max(2, Math.min(MAX_SYMBOLS, n));
    w.symbols = ALPHABET.slice(0, k).split('');
    if (shape === 'fibonacci') {
      const f = [1, 1];
      while (f.length < k) f.push(f[f.length - 1] + f[f.length - 2]);
      w.weights = sample(f, k, rnd);
    } else if (shape === 'uniform') {
      w.weights = Array.from({ length: k }, () => 1 + Math.floor(rnd() * 100));
    } else {
      w.weights = sample(Array.from({ length: k }, (_, i) => Math.max(1, Math.round(1000 / (i + 1)))), k, rnd);
    }
  }
  return w;
}
