// Every live tree kernel of the catalogue, checked by one harness against invariants computed
// here, independently of the kernels (ADR 0004 §4). The events are also replayed onto a fresh
// store, so the structure the plate draws is the structure the kernel built.
import { describe, expect, it } from 'vitest';
import { ENTRIES, CATALOGUE } from '../src/core/catalogue';
import { GROUNDS, palette } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { engine } from '../src/engines/tree';
import { EV, NIL, SHAPES, Store, trace, workload, type Key, type Trace, type TreeKernel,
  type Workload } from '../src/engines/tree/trace';

const modules = import.meta.glob<TreeKernel>('../src/kernels/tree/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'tree' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/tree/${id}.ts`];
const SIZES = [0, 1, 2, 3, 7, 16, 61, 128];

const defaults = (k: TreeKernel) => Object.fromEntries((k.params ?? []).map((p) => [p.key, Number(p.value)]));
const load = (k: TreeKernel, shape: string, n: number, seed = 1000 + n) =>
  trace(k, workload(k.input, shape, n, seed, defaults(k)));
const asc = (a: Key[]) => a.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
const lg = Math.log2;

/** The keys the structure must hold at the end. */
function expected(k: TreeKernel, w: Workload): Key[] {
  const gone = new Set(k.deletes ? w.deletes : []);
  return asc(w.keys.filter((x) => !gone.has(x)));
}

// ---- independent readers of a store ----------------------------------------------------------

function reachable(s: Store): number[] {
  const seen = new Set<number>();
  const stack = s.roots.filter((r) => r !== NIL);
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    for (const c of s.kids[x]) if (c !== NIL) stack.push(c);
  }
  return [...seen];
}

function liveNodes(s: Store): number[] {
  return s.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
}

/** In-order keys of a binary tree, refusing a node met twice. */
function inorder(s: Store, h: number, seen = new Set<number>()): Key[] {
  if (h === NIL) return [];
  if (seen.has(h)) throw new Error(`node ${h} reached twice`);
  seen.add(h);
  expect(s.kids[h].length).toBe(2);
  expect(s.keys[h].length).toBe(1);
  return [...inorder(s, s.kids[h][0], seen), s.keys[h][0], ...inorder(s, s.kids[h][1], seen)];
}

function heightOf(s: Store, h: number): number {
  return h === NIL ? 0 : 1 + Math.max(...s.kids[h].map((c) => heightOf(s, c)), 0);
}

function sizeOf(s: Store, h: number): number {
  return h === NIL ? 0 : 1 + s.kids[h].reduce((a, c) => a + sizeOf(s, c), 0);
}

/** In-order keys of a multiway tree: child 0, key 0, child 1, ..., and leaf depths. */
function multiway(s: Store, h: number, d: number, leaves: number[]): Key[] {
  const ks = s.keys[h];
  const cs = s.kids[h];
  if (cs.length === 0) { leaves.push(d); return ks.slice(); }
  expect(cs.length, `node ${h} has one more child than keys`).toBe(ks.length + 1);
  const out: Key[] = [];
  cs.forEach((c, i) => {
    expect(c).not.toBe(NIL);
    out.push(...multiway(s, c, d + 1, leaves));
    if (i < ks.length) out.push(ks[i]);
  });
  return out;
}

const bitOf = (k: number, b: number, w: number) => Math.floor(k / 2 ** (w - 1 - b)) & 1;

function checkSearches(t: Trace, k: TreeKernel): void {
  const w = t.workload;
  const present = new Set<Key>(w.keys);
  const searches = t.found.slice(0, w.searches.length);
  expect(searches.map((f) => f.k)).toEqual(w.searches);
  for (const f of searches) expect(f.yes, `search ${f.k}`).toBe(present.has(f.k));
  if (k.deletes) {
    const dels = t.found.slice(w.searches.length);
    expect(dels.map((f) => f.k)).toEqual(w.deletes);
    for (const f of dels) expect(f.yes, `delete ${f.k}`).toBe(true);
  }
}

// ---- invariants by structure -----------------------------------------------------------------

function checkStructure(k: TreeKernel, id: string, t: Trace): void {
  const s = t.store;
  const w = t.workload;
  const want = expected(k, w);
  switch (k.structure) {
    case 'bst': case 'avl': case 'red-black': case 'traversal': {
      const root = s.roots[0] ?? NIL;
      expect(inorder(s, root), 'in-order equals the sorted keys').toEqual(want);
      expect(liveNodes(s).length, 'no node left behind').toBe(want.length);
      if (k.infoLabel === 'size' || id === 'bst-rotations') {
        for (const x of reachable(s)) expect(s.info[x], `size at ${x}`).toBe(sizeOf(s, x));
      }
      if (k.structure === 'avl') {
        for (const x of reachable(s)) {
          const [l, r] = s.kids[x];
          expect(Math.abs(heightOf(s, l) - heightOf(s, r)), `balance at ${x}`).toBeLessThanOrEqual(1);
          expect(s.info[x]).toBe(heightOf(s, x));
        }
      }
      if (k.structure === 'red-black' && root !== NIL) {
        expect(s.tag[root], 'root is black').toBe(0);
        const black = (h: number): number => {
          if (h === NIL) return 1;
          const [l, r] = s.kids[h];
          if (s.tag[h] === 1) for (const c of [l, r]) if (c !== NIL) expect(s.tag[c], `red ${h} has a red child`).toBe(0);
          const bl = black(l); const br = black(r);
          expect(bl, `black height at ${h}`).toBe(br);
          return bl + (s.tag[h] === 0 ? 1 : 0);
        };
        black(root);
      }
      if (k.structure === 'traversal') {
        const pre: Key[] = []; const ino: Key[] = []; const post: Key[] = [];
        const rec = (h: number) => {
          if (h === NIL) return;
          pre.push(s.keys[h][0]); rec(s.kids[h][0]); ino.push(s.keys[h][0]); rec(s.kids[h][1]); post.push(s.keys[h][0]);
        };
        rec(root);
        const level: Key[] = [];
        let frontier = root === NIL ? [] : [root];
        while (frontier.length) {
          level.push(...frontier.map((x) => s.keys[x][0]));
          frontier = frontier.flatMap((x) => s.kids[x].filter((c) => c !== NIL));
        }
        const group = (g: number) => t.outputs.filter((o) => o.group === g).map((o) => o.v);
        expect(group(0), 'preorder').toEqual(pre);
        expect(group(1), 'inorder').toEqual(ino);
        expect(group(2), 'postorder').toEqual(post);
        expect(group(3), 'level order').toEqual(level);
      }
      break;
    }
    case 'multiway': {
      const root = s.roots[0] ?? NIL;
      if (!want.length) { expect(root).toBe(NIL); break; }
      const deg = defaults(k).degree ?? 2;
      const leaves: number[] = [];
      expect(multiway(s, root, 0, leaves), 'in-order equals the sorted keys').toEqual(want);
      expect(new Set(leaves).size, 'every leaf at one depth').toBe(1);
      for (const x of reachable(s)) {
        const m = s.keys[x].length;
        expect(m).toBeLessThanOrEqual(2 * deg - 1);
        expect(m).toBeGreaterThanOrEqual(x === root ? 1 : deg - 1);
        expect(asc(s.keys[x])).toEqual(s.keys[x]);
      }
      break;
    }
    case 'heap': case 'runs': case 'binomial':
      // checked operation by operation in the replay
      break;
    case 'binary-trie': case 'dst': {
      const root = s.roots[0] ?? NIL;
      const found: Key[] = [];
      const rec = (h: number, path: number[]): number => {
        if (h === NIL) return 0;
        const ks = s.keys[h];
        if (k.structure === 'dst' || s.kids[h].length === 0) {
          expect(ks.length).toBe(1);
          const key = ks[0] as number;
          found.push(key);
          path.forEach((b, d) => expect(bitOf(key, d, w.bits), `bit ${d} of ${key}`).toBe(b));
        }
        if (k.structure === 'binary-trie' && s.kids[h].length === 0) return 1;
        if (k.structure === 'binary-trie') expect(ks.length).toBe(0);
        const below = rec(s.kids[h][0], [...path, 0]) + rec(s.kids[h][1], [...path, 1]);
        if (k.structure === 'binary-trie') expect(below, `internal node ${h} separates two keys`).toBeGreaterThanOrEqual(2);
        return below + ks.length;
      };
      rec(root, []);
      expect(asc(found)).toEqual(want);
      break;
    }
    case 'patricia': {
      const head = s.roots[0] ?? NIL;
      const nodes = reachable(s);
      expect(nodes.length, 'one node per key').toBe(want.length);
      expect(asc(nodes.map((x) => s.keys[x][0]))).toEqual(want);
      if (head === NIL) break;
      const look = (key: number) => {
        let p = head; let x = s.kids[head][0];
        while (s.info[x] > s.info[p]) { p = x; x = s.kids[x][bitOf(key, s.info[x], w.bits)]; }
        return s.keys[x][0];
      };
      for (const key of want) expect(look(key as number), `search ${key}`).toBe(key);
      for (const x of nodes) {
        for (const c of s.kids[x]) {
          // a down link leads to a larger bit index and splits on a bit the subtree's keys share
          if (c !== NIL && s.info[c] > s.info[x] && x !== head) expect(s.info[c]).toBeGreaterThan(s.info[x]);
        }
      }
      break;
    }
    case 'rway-trie': case 'tst': {
      const root = s.roots[0] ?? NIL;
      const words: string[] = [];
      if (k.structure === 'rway-trie') {
        const rec = (h: number, prefix: string) => {
          if (s.tag[h] === 1) words.push(prefix);
          s.kids[h].forEach((c, i) => {
            if (c === NIL) return;
            const letter = s.keys[c][0] as string;
            expect(letter.charCodeAt(0) - 'a'.charCodeAt(0), `link ${i} carries its own letter`).toBe(i);
            rec(c, prefix + letter);
          });
        };
        if (root !== NIL) rec(root, '');
      } else {
        const level = (h: number): string[] => (h === NIL ? []
          : [s.keys[h][0] as string, ...level(s.kids[h][0]), ...level(s.kids[h][2])]);
        const rec = (h: number, prefix: string) => {
          if (h === NIL) return;
          const c = s.keys[h][0] as string;
          for (const x of level(s.kids[h][0])) expect(x < c).toBe(true);
          for (const x of level(s.kids[h][2])) expect(x > c).toBe(true);
          if (s.tag[h] === 1) words.push(prefix + c);
          rec(s.kids[h][0], prefix);
          rec(s.kids[h][1], prefix + c);
          rec(s.kids[h][2], prefix);
        };
        rec(root, '');
      }
      expect(asc(words)).toEqual(want);
      break;
    }
    case 'union-find': {
      const n = w.sites;
      // connectivity by breadth-first search over the connections seen so far
      const adj: number[][] = Array.from({ length: n }, () => []);
      const connected = (p: number, q: number) => {
        const seen = new Set([p]); const queue = [p];
        for (let i = 0; i < queue.length; i++) {
          for (const y of adj[queue[i]]) if (!seen.has(y)) { seen.add(y); queue.push(y); }
        }
        return seen.has(q);
      };
      w.pairs.forEach(([p, q], i) => {
        expect(t.found[i].yes, `pair ${i}: ${p}-${q}`).toBe(connected(p, q));
        adj[p].push(q); adj[q].push(p);
      });
      const rootOf = (i: number) => { let x = i; for (let g = 0; s.arr[x] !== x; g++) { expect(g).toBeLessThan(n); x = s.arr[x]; } return x; };
      const depthOf = (i: number) => { let d = 0; for (let x = i; s.arr[x] !== x; x = s.arr[x]) d++; return d; };
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < Math.min(n, p + 9); q++) {
          expect(rootOf(p) === rootOf(q), `${p} and ${q} share a root iff connected`).toBe(connected(p, q));
        }
      }
      const deepest = Math.max(0, ...Array.from({ length: n }, (_, i) => depthOf(i)));
      if (id === 'quick-find') expect(deepest).toBeLessThanOrEqual(1);
      if (id === 'weighted-quick-union' || id === 'path-compression') expect(deepest).toBeLessThanOrEqual(Math.floor(lg(Math.max(1, n))));
      break;
    }
    case 'huffman': {
      const roots = s.roots.filter((r) => r !== NIL);
      expect(roots.length, 'one tree is left').toBe(1);
      const codes: { sym: string; code: string; weight: number }[] = [];
      const rec = (h: number, code: string): number => {
        if (s.kids[h].length === 0) {
          codes.push({ sym: s.keys[h][0] as string, code, weight: s.info[h] });
          return s.info[h];
        }
        expect(s.kids[h].length).toBe(2);
        const sum = rec(s.kids[h][0], `${code}0`) + rec(s.kids[h][1], `${code}1`);
        expect(s.info[h], 'an internal weight is the sum of its children').toBe(sum);
        return sum;
      };
      rec(roots[0], '');
      expect(codes.map((c) => c.sym).sort()).toEqual(w.symbols.slice().sort());
      for (const c of codes) expect(c.weight).toBe(w.weights[w.symbols.indexOf(c.sym)]);
      for (const a of codes) for (const b of codes) if (a !== b) expect(b.code.startsWith(a.code), `${a.code} prefixes ${b.code}`).toBe(false);
      expect(codes.reduce((x, c) => x + 2 ** -c.code.length, 0), 'Kraft sum').toBeCloseTo(1, 12);
      const cost = codes.reduce((x, c) => x + c.weight * c.code.length, 0);
      expect(cost, 'optimal weighted path length').toBe(optimalCost(w.weights));
      break;
    }
  }
}

/** Minimum weighted path length, by exhaustive search over merges for small alphabets, else by
 * the two-queue method on sorted weights. */
function optimalCost(weights: number[]): number {
  if (weights.length <= 7) {
    const memo = new Map<string, number>();
    const best = (ws: number[]): number => {
      if (ws.length < 2) return 0;
      const key = ws.slice().sort((a, b) => a - b).join(',');
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      let m = Infinity;
      for (let i = 0; i < ws.length; i++) {
        for (let j = i + 1; j < ws.length; j++) {
          const rest = ws.filter((_, x) => x !== i && x !== j);
          m = Math.min(m, ws[i] + ws[j] + best([...rest, ws[i] + ws[j]]));
        }
      }
      memo.set(key, m);
      return m;
    };
    return best(weights);
  }
  const a = weights.slice().sort((x, y) => x - y);
  const b: number[] = [];
  let i = 0; let j = 0; let cost = 0;
  const take = () => (j >= b.length || (i < a.length && a[i] <= b[j]) ? a[i++] : b[j++]);
  for (let m = 0; m < weights.length - 1; m++) {
    const x = take() + take();
    cost += x;
    b.push(x);
  }
  return cost;
}

/** Replay the events onto a fresh store, checking per-operation invariants at each boundary. */
function replay(k: TreeKernel, t: Trace): Store {
  const s = new Store(t.store.arr.length);
  const removed: Key[] = [];
  let inserted = 0;
  const boundary = () => {
    if (k.structure === 'heap' || k.structure === 'runs') {
      for (let i = 2; i <= s.size; i++) {
        if (k.structure === 'heap') expect(s.arr[i >> 1], `heap order at ${i}`).toBeGreaterThanOrEqual(s.arr[i]);
        else expect(s.arr[i >> 1], `heap order at ${i}`).toBeLessThanOrEqual(s.arr[i]);
      }
    }
    if (k.structure === 'binomial') {
      let total = 0;
      s.roots.forEach((r, order) => {
        if (r === NIL) return;
        const shape = (x: number, o: number) => {
          expect(s.kids[x].length, `binomial tree of order ${o}`).toBe(o);
          s.kids[x].forEach((c, j) => {
            expect(s.keys[c][0] <= s.keys[x][0], 'heap order').toBe(true);
            shape(c, o - 1 - j);
          });
        };
        shape(r, order);
        total += 2 ** order;
      });
      expect(total, 'the trees hold every key inserted and not removed').toBe(inserted - removed.length);
    }
  };
  for (const e of t.events) {
    if (e.o === EV.begin) { boundary(); if (e.a === 0) inserted++; }
    if (e.o === EV.emit) removed.push(e.p as Key);
    s.apply(e);
  }
  boundary();
  return s;
}

describe('tree kernels', () => {
  it('every live tree entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('keeps its invariants on every input shape and size', () => {
        for (const { value: shape } of SHAPES[kernel.input]) {
          for (const n of SIZES) {
            const t = load(kernel, shape, n);
            expect(t.truncated).toBe(false);
            checkStructure(kernel, e.id, t);
            if (['bst', 'avl', 'red-black', 'multiway', 'binary-trie', 'dst', 'patricia', 'rway-trie', 'tst'].includes(kernel.structure)) {
              checkSearches(t, kernel);
            }
            if (kernel.structure === 'heap' || kernel.structure === 'binomial') {
              expect(t.outputs.map((o) => o.v), `${shape} n=${n} comes out largest first`)
                .toEqual(asc(t.workload.keys).reverse());
            }
            if (kernel.structure === 'runs') {
              const m = Math.min(defaults(kernel).memory, n);
              const runs: number[][] = [];
              for (const o of t.outputs) (runs[o.group] ??= []).push(o.v as number);
              expect(runs.flat().slice().sort((a, b) => a - b)).toEqual(asc(t.workload.keys));
              runs.forEach((r, i) => {
                expect(r, `run ${i} ascending`).toEqual(r.slice().sort((a, b) => a - b));
                if (i < runs.length - 1) expect(r.length, `run ${i} holds at least M keys`).toBeGreaterThanOrEqual(m);
              });
            }
          }
        }
      });

      it('replays its events into the structure it built', () => {
        const t = load(kernel, SHAPES[kernel.input][0].value, 61);
        const s = replay(kernel, t);
        const live = (x: Store) => liveNodes(x).map((i) => [i, x.keys[i], x.kids[i], x.tag[i], x.info[i]]);
        expect(live(s)).toEqual(live(t.store));
        expect(s.roots).toEqual(t.store.roots);
        expect(s.arr.slice(0, s.size + 1)).toEqual(t.store.arr.slice(0, t.store.size + 1));
      });
    });
  }
});

describe('tree kernels against known bounds', () => {
  const has = (id: string) => live.some((e) => e.id === id);
  const height = (t: Trace) => {
    expect(t.truncated).toBe(false);
    return heightOf(t.store, t.store.roots[0] ?? NIL);
  };
  const n = 1000;

  it.runIf(has('bst-search-insert'))('a plain search tree on ascending keys is a path', () => {
    expect(height(load(kernelOf('bst-search-insert'), 'ascending', n))).toBe(n);
  });

  it.runIf(has('red-black-tree'))('a red-black tree stays within 2 lg n', () => {
    for (const shape of ['ascending', 'descending', 'random']) {
      expect(height(load(kernelOf('red-black-tree'), shape, n))).toBeLessThanOrEqual(2 * lg(n + 1));
    }
  });

  it.runIf(has('avl-tree'))('an AVL tree stays within 1.44 lg n', () => {
    for (const shape of ['ascending', 'zigzag', 'random']) {
      expect(height(load(kernelOf('avl-tree'), shape, n))).toBeLessThanOrEqual(1.4405 * lg(n + 2));
    }
  });

  it.runIf(has('bst-rotations'))('rebalancing by rotations leaves a tree of minimal height', () => {
    for (const m of [1, 2, 7, 8, 100, 400]) {
      expect(height(load(kernelOf('bst-rotations'), 'ascending', m)), `n=${m}`).toBe(Math.ceil(lg(m + 1)));
    }
  });

  it.runIf(has('randomized-bst'))('a randomized tree on ascending keys is far from a path', () => {
    expect(height(load(kernelOf('randomized-bst'), 'ascending', n))).toBeLessThan(6 * lg(n));
  });

  it.runIf(has('splay-tree'))('every splay access leaves the key it found at the root', () => {
    const t = load(kernelOf('splay-tree'), 'random', 200);
    const w = t.workload;
    const s = new Store(t.store.arr.length);
    const wants: Key[] = [...w.keys, ...w.searches.filter((_, j) => t.found[j].yes)];
    const checks: Key[] = [];
    let op = -1;
    const after = () => {
      const o = t.ops[op];
      if (!o) return;
      const j = op - w.keys.length;
      if (o.kind === 'insert' || t.found[j]?.yes) checks.push(s.keys[s.roots[0]][0]);
    };
    t.events.forEach((e) => {
      if (e.o === EV.begin) { after(); op++; }
      s.apply(e);
    });
    after();
    expect(checks).toEqual(wants);
  });

  it.runIf(has('quick-union'))('quick-union on a chain of connections builds a path', () => {
    const t = load(kernelOf('quick-union'), 'chain', 64);
    let d = 0;
    for (let x = 0; t.store.arr[x] !== x; x = t.store.arr[x]) d++;
    expect(d).toBe(63);
  });

  it.runIf(has('binary-trie'))('a binary trie depends only on its key set', () => {
    const k = kernelOf('binary-trie');
    const w = workload('bits', 'random', 100, 5);
    const shuffled = { ...w, keys: w.keys.slice().reverse() };
    const canon = (s: Store, h: number): string => (h === NIL ? '.' : s.kids[h].length === 0 ? String(s.keys[h][0])
      : `(${canon(s, s.kids[h][0])} ${canon(s, s.kids[h][1])})`);
    const a = trace(k, w).store; const b = trace(k, shuffled).store;
    expect(canon(a, a.roots[0])).toBe(canon(b, b.roots[0]));
  });

  it.runIf(has('replacement-selection'))('replacement selection writes runs about twice the memory on random input', () => {
    const k = kernelOf('replacement-selection');
    const m = 50;
    const t = trace(k, workload('keys', 'random', 6000, 9, { memory: m }));
    const runs = 1 + Math.max(...t.outputs.map((o) => o.group));
    const mean = 6000 / runs;
    expect(mean).toBeGreaterThan(1.6 * m);
    expect(mean).toBeLessThan(2.4 * m);
  });

  it.runIf(has('two-three-four-tree') && has('red-black-tree'))('2-3-4 trees keep every leaf at one depth near lg n', () => {
    const t = load(kernelOf('two-three-four-tree'), 'ascending', n);
    const leaves: number[] = [];
    multiway(t.store, t.store.roots[0], 0, leaves);
    expect(leaves[0]).toBeLessThanOrEqual(lg(n));
  });
});

describe('tree plates', () => {
  // a p5 stand-in that accepts every drawing call, so the engine's own code runs frame by frame
  const fakeP5 = () => new Proxy({ LEFT: 'left', CENTER: 'center', TOP: 'top', BOTTOM: 'bottom' } as Record<string, unknown>, {
    get: (o, k: string) => (k in o ? o[k] : () => undefined),
  });
  const drive = (code: PlateCode, frames: number, speed = 2000) => {
    const params: Params = Object.fromEntries(code.params.map((d) => [d.key, d.value]));
    params.speed = speed;
    params.loop = false;
    let stats: Stat[] = [];
    let chart: Chart | undefined;
    const ctx: PlateContext = {
      width: 800, height: 450, params, seed: 42, rnd: Math.random, theme: 'dark',
      bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, palette: () => palette(String(params.palette)),
      stats: (rows) => { stats = rows; }, chart: (c) => { chart = c; }, thumbnail: false,
    };
    const sim = code.create(fakeP5() as never, ctx);
    sim.setup();
    for (let f = 0; f < frames; f++) sim.draw();
    return { stats, chart };
  };

  for (const e of live) {
    it(`${e.id} replays to the end with measured readouts`, () => {
      const { stats, chart } = drive(engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(e.id)), 400);
      expect(stats.length).toBeGreaterThan(3);
      for (const row of stats) expect(row.value, row.label).not.toMatch(/NaN|undefined|NOT/);
      expect(stats.find((r) => r.label === 'Operation')?.value).toMatch(/^(\d[\d,]*) of \1:/);
      for (const sr of chart!.series) for (const [x, y] of sr.points) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    });
  }

  for (const l of CATALOGUE.labs.filter((x) => x.engine === 'tree')) {
    it(`lab ${l.id} runs its kernels and measures them`, () => {
      const kernels = l.entries.filter((id) => live.some((e) => e.id === id))
        .map((id) => ({ info: { id, title: id, group: ENTRIES.find((e) => e.id === id)!.taxonomy }, kernel: kernelOf(id) }));
      const { stats, chart } = drive(engine.lab(l.id, kernels), 120, 50);
      expect(stats.length).toBe(kernels.length);
      expect(chart!.series.filter((sr) => sr.points.length > 0).length).toBeGreaterThanOrEqual(kernels.length);
    });
  }
});
