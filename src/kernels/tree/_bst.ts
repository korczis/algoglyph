// Binary search tree moves shared by the binary-tree kernels. A node is make([key], 2): child 0
// is the left link, child 1 the right; `info` holds the subtree size where a kernel keeps it.
import { NIL, type Key, type TreeOps } from '../../engines/tree/trace';

export const L = 0;
export const R = 1;

export const left = (t: TreeOps, h: number) => t.child(h, L);
export const right = (t: TreeOps, h: number) => t.child(h, R);

/** Subtree size kept in info (0 for an empty link). */
export const size = (t: TreeOps, h: number) => (h === NIL ? 0 : t.info(h));
export function fix(t: TreeOps, h: number): void {
  t.setInfo(h, 1 + size(t, left(t, h)) + size(t, right(t, h)));
}

export function leaf(t: TreeOps, k: Key, sized = false): number {
  const x = t.make([k], 2);
  if (sized) t.setInfo(x, 1);
  return x;
}

/** Rotate h's left child up: returns the new subtree root. */
export function rotR(t: TreeOps, h: number, sized = false): number {
  const x = left(t, h);
  t.rotate(h);
  t.setChild(h, L, right(t, x));
  t.setChild(x, R, h);
  if (sized) { fix(t, h); fix(t, x); }
  return x;
}

/** Rotate h's right child up: returns the new subtree root. */
export function rotL(t: TreeOps, h: number, sized = false): number {
  const x = right(t, h);
  t.rotate(h);
  t.setChild(h, R, left(t, x));
  t.setChild(x, L, h);
  if (sized) { fix(t, h); fix(t, x); }
  return x;
}

/** Plain insertion at the bottom; returns the subtree root. Duplicates are ignored. */
export function insert(t: TreeOps, h: number, k: Key, sized = false): number {
  if (h === NIL) return leaf(t, k, sized);
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return h;
  const side = c < 0 ? L : R;
  t.setChild(h, side, insert(t, t.child(h, side), k, sized));
  if (sized) fix(t, h);
  return h;
}

/** Search from the root without changing the tree, reporting the result. */
export function search(t: TreeOps, k: Key): boolean {
  let x = t.root();
  while (x !== NIL) {
    t.visit(x);
    const c = t.cmp(k, t.key(x), x);
    if (c === 0) { t.found(k, true); return true; }
    x = t.child(x, c < 0 ? L : R);
  }
  t.found(k, false);
  return false;
}

/** Insert every key, then search for every search key: the common symbol-table workload. */
export function insertAll(t: TreeOps, ins: (h: number, k: Key) => number): void {
  for (const k of t.w.keys) {
    t.begin('insert', `insert ${k}`);
    t.setRoot(0, ins(t.root(), k));
  }
}

export function searchAll(t: TreeOps, find: (k: Key) => boolean = (k) => search(t, k), phase?: string): void {
  for (const k of t.w.searches) {
    t.begin('search', `search ${k}`, phase);
    find(k);
  }
}
