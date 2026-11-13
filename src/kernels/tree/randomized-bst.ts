import { NIL, type Key, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { deleteShareParams, fix, insertAll, L, leaf, R, rotL, rotR, searchAll, size } from './_bst';

function insertRoot(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) return leaf(t, k, true);
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return h;
  if (c < 0) {
    t.setChild(h, L, insertRoot(t, t.child(h, L), k));
    return rotR(t, h, true);
  }
  t.setChild(h, R, insertRoot(t, t.child(h, R), k));
  return rotL(t, h, true);
}

/** With probability 1/(size+1) the new key becomes this subtree's root. */
function insert(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) return leaf(t, k, true);
  if (t.random() * (size(t, h) + 1) < 1) return insertRoot(t, h, k);
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return h;
  const side = c < 0 ? L : R;
  t.setChild(h, side, insert(t, t.child(h, side), k));
  fix(t, h);
  return h;
}

/** Join a and b (all keys of a smaller), choosing the root in proportion to subtree sizes. */
function join(t: TreeOps, a: number, b: number): number {
  if (a === NIL) return b;
  if (b === NIL) return a;
  if (t.random() * (size(t, a) + size(t, b)) < size(t, a)) {
    t.visit(a);
    t.setChild(a, R, join(t, t.child(a, R), b));
    fix(t, a);
    return a;
  }
  t.visit(b);
  t.setChild(b, L, join(t, a, t.child(b, L)));
  fix(t, b);
  return b;
}

function remove(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) { t.found(k, false); return NIL; }
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c !== 0) {
    const side = c < 0 ? L : R;
    t.setChild(h, side, remove(t, t.child(h, side), k));
    fix(t, h);
    return h;
  }
  t.found(k, true);
  const r = join(t, t.child(h, L), t.child(h, R));
  t.free(h);
  return r;
}

// Every node keeps its subtree size. A new key becomes the root of a subtree of size s with
// probability 1/(s+1), and deletion joins the two subtrees choosing either root in proportion
// to its size: the tree is distributed as if its keys had arrived in random order.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'bst',
  deletes: true,
  params: deleteShareParams(),
  infoLabel: 'size',
  run(t) {
    insertAll(t, (h, k) => insert(t, h, k));
    searchAll(t);
    for (const k of t.w.deletes) {
      t.begin('delete', `delete ${k}`);
      t.setRoot(0, remove(t, t.root(), k));
    }
  },
};
