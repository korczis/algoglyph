import { NIL, type Key, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { L, leaf, R, rotL, rotR } from './_bst';

/** Bring k (or the last node on its search path) to the root of h, two levels at a time. */
function splay(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) return NIL;
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return h;
  const side = c < 0 ? L : R;
  const x = t.child(h, side);
  if (x === NIL) return h;
  t.visit(x);
  const c2 = t.cmp(k, t.key(x), x);
  if (c2 !== 0) {
    const inner = c2 < 0 ? L : R;
    t.setChild(x, inner, splay(t, t.child(x, inner), k));
    if (inner === side) {
      // zig-zig: rotate the grandparent first
      h = side === L ? rotR(t, h) : rotL(t, h);
    } else if (t.child(x, inner) !== NIL) {
      // zig-zag: rotate the child first
      t.setChild(h, side, side === L ? rotL(t, x) : rotR(t, x));
    }
  }
  if (t.child(h, side) === NIL) return h;
  return side === L ? rotR(t, h) : rotL(t, h);
}

function insert(t: TreeOps, k: Key): void {
  const h = splay(t, t.root(), k);
  if (h === NIL) { t.setRoot(0, leaf(t, k)); return; }
  t.setRoot(0, h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return;
  const x = leaf(t, k);
  if (c < 0) {
    t.setChild(x, L, t.child(h, L));
    t.setChild(h, L, NIL);
    t.setChild(x, R, h);
  } else {
    t.setChild(x, R, t.child(h, R));
    t.setChild(h, R, NIL);
    t.setChild(x, L, h);
  }
  t.setRoot(0, x);
}

function search(t: TreeOps, k: Key): boolean {
  const h = splay(t, t.root(), k);
  t.setRoot(0, h);
  const yes = h !== NIL && t.cmp(k, t.key(h), h) === 0;
  t.found(k, yes);
  return yes;
}

// Every access splays: the key climbs to the root by zig-zig and zig-zag rotations, which fold
// the search path roughly in half, so any sequence of m operations costs O(m lg n) in total.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'bst',
  run(t) {
    for (const k of t.w.keys) {
      t.begin('insert', `insert ${k}`);
      insert(t, k);
    }
    for (const k of t.w.searches) {
      t.begin('search', `search ${k}`);
      search(t, k);
    }
  },
};
