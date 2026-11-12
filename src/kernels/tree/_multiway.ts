// Balanced multiway search trees grown top-down (2-3-4 trees and B-trees). A node holds its keys
// in order; a leaf has no child slots, an internal node one more child than keys. A full node
// met on the way down is split first, so an insertion never has to come back up.
import { NIL, type Key, type TreeOps } from '../../engines/tree/trace';

/** Position of k in x: the first key not less than k, and whether it equals k. */
function locate(t: TreeOps, x: number, k: Key, binary: boolean): { i: number; eq: boolean } {
  const ks = t.keys(x);
  if (!binary) {
    for (let i = 0; i < ks.length; i++) {
      const c = t.cmp(k, ks[i], x);
      if (c <= 0) return { i, eq: c === 0 };
    }
    return { i: ks.length, eq: false };
  }
  let lo = 0; let hi = ks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = t.cmp(k, ks[mid], x);
    if (c === 0) return { i: mid, eq: true };
    if (c < 0) hi = mid; else lo = mid + 1;
  }
  return { i: lo, eq: false };
}

const isLeaf = (t: TreeOps, x: number) => t.degree(x) === 0;

/** Split the full child i of x around its middle key, which moves up into x. */
function splitChild(t: TreeOps, x: number, i: number, deg: number): void {
  const y = t.child(x, i);
  t.split(y);
  const ks = t.keys(y).slice();
  const leaf = isLeaf(t, y);
  const z = t.make(ks.slice(deg), 0);
  if (!leaf) {
    const cs = Array.from({ length: t.degree(y) }, (_, j) => t.child(y, j));
    t.setChildren(z, cs.slice(deg));
    t.setChildren(y, cs.slice(0, deg));
  }
  t.setKeys(y, ks.slice(0, deg - 1));
  const xk = t.keys(x).slice();
  xk.splice(i, 0, ks[deg - 1]);
  t.setKeys(x, xk);
  const xc = Array.from({ length: t.degree(x) }, (_, j) => t.child(x, j));
  xc.splice(i + 1, 0, z);
  t.setChildren(x, xc);
}

/** Insert k into a tree of minimum degree `deg` (at most 2 deg - 1 keys per node). */
export function insert(t: TreeOps, k: Key, deg: number, binary: boolean): void {
  const full = (x: number) => t.keys(x).length === 2 * deg - 1;
  let r = t.root();
  if (r === NIL) { t.setRoot(0, t.make([k], 0)); return; }
  if (full(r)) {
    const s = t.make([], 1);
    t.setChild(s, 0, r);
    t.setRoot(0, s);
    splitChild(t, s, 0, deg);
    r = s;
  }
  let x = r;
  for (;;) {
    t.visit(x);
    const { i, eq } = locate(t, x, k, binary);
    if (eq) return;
    if (isLeaf(t, x)) {
      const ks = t.keys(x).slice();
      ks.splice(i, 0, k);
      t.setKeys(x, ks);
      return;
    }
    let j = i;
    if (full(t.child(x, i))) {
      splitChild(t, x, i, deg);
      const c = t.cmp(k, t.key(x, i), x);
      if (c === 0) return;
      if (c > 0) j = i + 1;
    }
    x = t.child(x, j);
  }
}

export function search(t: TreeOps, k: Key, binary: boolean): boolean {
  let x = t.root();
  while (x !== NIL) {
    t.visit(x);
    const { i, eq } = locate(t, x, k, binary);
    if (eq) { t.found(k, true); return true; }
    if (isLeaf(t, x)) break;
    x = t.child(x, i);
  }
  t.found(k, false);
  return false;
}
