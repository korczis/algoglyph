// Independent search trees for the searching wing's claims (test/searching-trees-claims.test.ts).
// Each is the textbook structure written on plain objects, sharing no code with the kernels in
// src/kernels/tree: no TreeOps, no store, no trace. Only the input is shared, drawn by the
// engine's workload() at the claim's own setup, so the oracle and the plate see the same keys.
//
// The counts follow the plate's published conventions, which are part of the claim:
// - a key comparison is one three-way comparison of the sought key with one stored key;
// - a rotation is one single rotation, so a double rotation counts two;
// - a recolouring is one node whose colour actually changes (setting a colour it already has is
//   not one, and a new node is born red without a recolouring);
// - a node split is one full node divided around its median, the root's included;
// - height is in levels, the number of nodes on the longest root-to-leaf path: an empty tree has
//   0, a single node 1. A path of n nodes has height n; a perfect tree of 2^k − 1 nodes has k.

export interface Counts { compares: number; rotations: number; recolours: number; splits: number }
const zero = (): Counts => ({ compares: 0, rotations: 0, recolours: 0, splits: 0 });

interface Bin { key: number; l: Bin | null; r: Bin | null; h: number; red: boolean; size: number }
const node = (key: number, red = false): Bin => ({ key, l: null, r: null, h: 1, red, size: 1 });

/** Height in levels and the number of keys of a binary tree. */
export function binShape(x: Bin | null): { height: number; size: number } {
  if (!x) return { height: 0, size: 0 };
  const a = binShape(x.l);
  const b = binShape(x.r);
  return { height: 1 + Math.max(a.height, b.height), size: 1 + a.size + b.size };
}

/** Keys of a binary tree in order: the check that every oracle stays a search tree. */
export function inorder(x: Bin | null, out: number[] = []): number[] {
  if (x) { inorder(x.l, out); out.push(x.key); inorder(x.r, out); }
  return out;
}

function cmp(c: Counts, a: number, b: number): number {
  c.compares++;
  return a < b ? -1 : a > b ? 1 : 0;
}

function rotRight(c: Counts, h: Bin): Bin {
  c.rotations++;
  const x = h.l!;
  h.l = x.r;
  x.r = h;
  return x;
}

function rotLeft(c: Counts, h: Bin): Bin {
  c.rotations++;
  const x = h.r!;
  h.r = x.l;
  x.l = h;
  return x;
}

/** Search from the root, one comparison per node on the path. */
function binSearch(c: Counts, root: Bin | null, k: number): boolean {
  for (let x = root; x;) {
    const d = cmp(c, k, x.key);
    if (d === 0) return true;
    x = d < 0 ? x.l : x.r;
  }
  return false;
}

export interface BinRun { root: Bin | null; counts: Counts }

/** Plain insertion at the bottom, then the searches. */
export function plainBst(keys: number[], searches: number[]): BinRun {
  const c = zero();
  let root: Bin | null = null;
  for (const k of keys) {
    if (!root) { root = node(k); continue; }
    let x = root;
    for (;;) {
      const d = cmp(c, k, x.key);
      if (d === 0) break;
      const next = d < 0 ? x.l : x.r;
      if (!next) { if (d < 0) x.l = node(k); else x.r = node(k); break; }
      x = next;
    }
  }
  for (const k of searches) binSearch(c, root, k);
  return { root, counts: c };
}

/** Root insertion: insert at the bottom, then rotate the new node over each ancestor. */
export function rootInsertionBst(keys: number[], searches: number[]): BinRun {
  const c = zero();
  const ins = (h: Bin | null, k: number): Bin => {
    if (!h) return node(k);
    const d = cmp(c, k, h.key);
    if (d === 0) return h;
    if (d < 0) { h.l = ins(h.l, k); return rotRight(c, h); }
    h.r = ins(h.r, k);
    return rotLeft(c, h);
  };
  let root: Bin | null = null;
  for (const k of keys) root = ins(root, k);
  for (const k of searches) binSearch(c, root, k);
  return { root, counts: c };
}

/** Plain insertion, the searches, then balance by rotating the median of every subtree to its
 * root (rank ⌊size / 2⌋, 0-based), then the searches again. Sizes are recomputed by walking, so
 * the oracle keeps no size field the kernel could share a mistake with. */
export function rotationBalancedBst(keys: number[], searches: number[]): BinRun {
  const first = plainBst(keys, searches);
  const c = first.counts;
  const sz = (x: Bin | null): number => (x ? 1 + sz(x.l) + sz(x.r) : 0);
  const partition = (h: Bin, k: number): Bin => {
    const s = sz(h.l);
    if (s > k) { h.l = partition(h.l!, k); return rotRight(c, h); }
    if (s < k) { h.r = partition(h.r!, k - s - 1); return rotLeft(c, h); }
    return h;
  };
  const balance = (h: Bin | null): Bin | null => {
    if (!h || sz(h) < 2) return h;
    const r = partition(h, Math.floor(sz(h) / 2));
    r.l = balance(r.l);
    r.r = balance(r.r);
    return r;
  };
  const root = balance(first.root);
  for (const k of searches) binSearch(c, root, k);
  return { root, counts: c };
}

/** AVL insertion (Adelson-Velsky and Landis): insert at the bottom and rebalance every node on
 * the way back up, a single rotation for an outside-heavy grandchild, two for an inside one. */
export function avl(keys: number[], searches: number[]): BinRun {
  const c = zero();
  const ht = (x: Bin | null) => (x ? x.h : 0);
  const fix = (x: Bin) => { x.h = 1 + Math.max(ht(x.l), ht(x.r)); };
  const rr = (h: Bin) => { const x = rotRight(c, h); fix(h); fix(x); return x; };
  const rl = (h: Bin) => { const x = rotLeft(c, h); fix(h); fix(x); return x; };
  const tilt = (x: Bin) => ht(x.l) - ht(x.r);
  const ins = (h: Bin | null, k: number): Bin => {
    if (!h) return node(k);
    const d = cmp(c, k, h.key);
    if (d === 0) return h;
    if (d < 0) h.l = ins(h.l, k); else h.r = ins(h.r, k);
    fix(h);
    if (tilt(h) > 1) {
      if (tilt(h.l!) < 0) h.l = rl(h.l!);
      return rr(h);
    }
    if (tilt(h) < -1) {
      if (tilt(h.r!) > 0) h.r = rr(h.r!);
      return rl(h);
    }
    return h;
  };
  let root: Bin | null = null;
  for (const k of keys) root = ins(root, k);
  for (const k of searches) binSearch(c, root, k);
  return { root, counts: c };
}

/** Left-leaning red-black insertion as Sedgewick (2008) gives it in its 2-3-4 form: flip a
 * 4-node on the way down, then on the way up rotate a right-leaning red link left and two reds
 * in a row right, and colour the root black after each insertion. */
export function llrb(keys: number[], searches: number[]): BinRun {
  const c = zero();
  const isRed = (x: Bin | null) => !!x && x.red;
  const paint = (x: Bin, red: boolean) => { if (x.red !== red) { x.red = red; c.recolours++; } };
  const rotate = (h: Bin, toLeft: boolean): Bin => {
    const x = toLeft ? rotLeft(c, h) : rotRight(c, h);
    paint(x, h.red);
    paint(h, true);
    return x;
  };
  const flip = (h: Bin) => { paint(h, !h.red); paint(h.l!, !h.l!.red); paint(h.r!, !h.r!.red); };
  const ins = (h: Bin | null, k: number): Bin => {
    if (!h) return node(k, true);
    if (isRed(h.l) && isRed(h.r)) flip(h);
    const d = cmp(c, k, h.key);
    if (d < 0) h.l = ins(h.l, k); else if (d > 0) h.r = ins(h.r, k);
    if (isRed(h.r) && !isRed(h.l)) h = rotate(h, true);
    if (isRed(h.l) && isRed(h.l!.l)) h = rotate(h, false);
    return h;
  };
  let root: Bin | null = null;
  for (const k of keys) { root = ins(root, k); paint(root, false); }
  for (const k of searches) binSearch(c, root, k);
  return { root, counts: c };
}

/** Bottom-up splaying (Sleator and Tarjan 1985), written recursively: the accessed key, or the
 * last node on its path, climbs to the root by zig-zig and zig-zag steps, and a final zig when
 * the path has odd length. An insertion splays first and makes the new key the root, splitting
 * the old root's tree around it; a search splays and compares once more at the root. */
export function splay(keys: number[], searches: number[]): BinRun {
  const c = zero();
  const sp = (h: Bin | null, k: number): Bin | null => {
    if (!h) return null;
    const d = cmp(c, k, h.key);
    if (d === 0) return h;
    const goLeft = d < 0;
    const x = goLeft ? h.l : h.r;
    if (!x) return h;
    const d2 = cmp(c, k, x.key);
    if (d2 !== 0) {
      const innerLeft = d2 < 0;
      if (innerLeft) x.l = sp(x.l, k); else x.r = sp(x.r, k);
      if (innerLeft === goLeft) {
        h = goLeft ? rotRight(c, h) : rotLeft(c, h);
      } else if (innerLeft ? x.l : x.r) {
        const y = goLeft ? rotLeft(c, x) : rotRight(c, x);
        if (goLeft) h.l = y; else h.r = y;
      }
    }
    if (!(goLeft ? h.l : h.r)) return h;
    return goLeft ? rotRight(c, h) : rotLeft(c, h);
  };
  let root: Bin | null = null;
  for (const k of keys) {
    const h = sp(root, k);
    if (!h) { root = node(k); continue; }
    const d = cmp(c, k, h.key);
    if (d === 0) { root = h; continue; }
    const x = node(k);
    if (d < 0) { x.l = h.l; h.l = null; x.r = h; } else { x.r = h.r; h.r = null; x.l = h; }
    root = x;
  }
  for (const k of searches) {
    root = sp(root, k);
    if (root) cmp(c, k, root.key);
  }
  return { root, counts: c };
}

interface Page { keys: number[]; kids: Page[] }

export interface PageRun { root: Page | null; counts: Counts }

/** Height in levels and the number of keys of a multiway tree. */
export function pageShape(x: Page | null): { height: number; size: number; leafDepths: Set<number> } {
  const depths = new Set<number>();
  let size = 0;
  let height = 0;
  const walk = (p: Page, d: number) => {
    size += p.keys.length;
    height = Math.max(height, d);
    if (p.kids.length === 0) depths.add(d);
    for (const q of p.kids) walk(q, d + 1);
  };
  if (x) walk(x, 1);
  return { height, size, leafDepths: depths };
}

/** A B-tree of minimum degree t grown top-down (Cormen et al., B-TREE-INSERT): every full node
 * (2t − 1 keys) met on the way down, the root included, is split around its median first. Within
 * a node the keys are scanned left to right, or found by binary search, one comparison per key
 * looked at; the 2-3-4 tree is the case t = 2 with the linear scan. */
export function bTree(keys: number[], searches: number[], t: number, binary: boolean): PageRun {
  const c = zero();
  const locate = (p: Page, k: number): { i: number; eq: boolean } => {
    if (!binary) {
      for (let i = 0; i < p.keys.length; i++) {
        const d = cmp(c, k, p.keys[i]);
        if (d <= 0) return { i, eq: d === 0 };
      }
      return { i: p.keys.length, eq: false };
    }
    let lo = 0;
    let hi = p.keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const d = cmp(c, k, p.keys[mid]);
      if (d === 0) return { i: mid, eq: true };
      if (d < 0) hi = mid; else lo = mid + 1;
    }
    return { i: lo, eq: false };
  };
  const full = (p: Page) => p.keys.length === 2 * t - 1;
  const splitChild = (x: Page, i: number) => {
    c.splits++;
    const y = x.kids[i];
    const z: Page = { keys: y.keys.slice(t), kids: y.kids.length ? y.kids.slice(t) : [] };
    const mid = y.keys[t - 1];
    y.keys = y.keys.slice(0, t - 1);
    if (y.kids.length) y.kids = y.kids.slice(0, t);
    x.keys.splice(i, 0, mid);
    x.kids.splice(i + 1, 0, z);
  };
  let root: Page | null = null;
  for (const k of keys) {
    if (!root) { root = { keys: [k], kids: [] }; continue; }
    if (full(root)) {
      const s: Page = { keys: [], kids: [root] };
      splitChild(s, 0);
      root = s;
    }
    let x = root;
    for (;;) {
      const { i, eq } = locate(x, k);
      if (eq) break;
      if (x.kids.length === 0) { x.keys.splice(i, 0, k); break; }
      if (full(x.kids[i])) {
        splitChild(x, i);
        const d = cmp(c, k, x.keys[i]);
        if (d === 0) break;
        x = x.kids[d < 0 ? i : i + 1];
      } else x = x.kids[i];
    }
  }
  for (const k of searches) {
    for (let x: Page | null = root; x;) {
      const { i, eq } = locate(x, k);
      if (eq || x.kids.length === 0) break;
      x = x.kids[i];
    }
  }
  return { root, counts: c };
}
