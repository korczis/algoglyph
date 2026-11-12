import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';

// Root slot k holds a binomial tree of 2^k keys or nothing, like bit k of the queue's size. A
// node's children are its subtrees in decreasing order, and every key is at least its children.
const kids = (t: TreeOps, x: number) => Array.from({ length: t.degree(x) }, (_, i) => t.child(x, i));

/** Link two trees of equal order: the smaller root becomes the larger root's first child. */
function link(t: TreeOps, a: number, b: number): number {
  const [hi, lo] = t.less(t.key(a), t.key(b), a) ? [b, a] : [a, b];
  t.setChildren(hi, [lo, ...kids(t, hi)]);
  return hi;
}

/** Add the trees of `other` (slot k holds order k) into the root slots, carrying like binary addition. */
function merge(t: TreeOps, other: number[]): void {
  let carry = NIL;
  const width = Math.max(other.length, rootCount(t)) + 1;
  for (let k = 0; k < width; k++) {
    const trees = [t.root(k), other[k] ?? NIL, carry].filter((x) => x !== NIL);
    for (const x of trees) t.visit(x);
    if (trees.length === 0) { carry = NIL; continue; }
    if (trees.length === 1) { t.setRoot(k, trees[0]); carry = NIL; continue; }
    if (trees.length === 2) { t.setRoot(k, NIL); carry = link(t, trees[0], trees[1]); continue; }
    t.setRoot(k, trees[2]);
    carry = link(t, trees[0], trees[1]);
  }
}

function rootCount(t: TreeOps): number {
  let k = 0;
  for (let i = 0; i < 64; i++) if (t.root(i) !== NIL) k = i + 1;
  return k;
}

function removeMax(t: TreeOps): void {
  let best = NIL; let slot = -1;
  for (let k = 0; k < rootCount(t); k++) {
    const x = t.root(k);
    if (x === NIL) continue;
    t.visit(x);
    if (best === NIL || t.less(t.key(best), t.key(x), x)) { best = x; slot = k; }
  }
  if (best === NIL) return;
  t.emit(t.key(best));
  t.setRoot(slot, NIL);
  // its children are trees of orders slot-1 .. 0: a queue of their own
  const cs = kids(t, best);
  t.setChildren(best, []);
  t.free(best);
  merge(t, cs.slice().reverse());
}

export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'binomial',
  layout: 'tidy',
  run(t) {
    for (const k of t.w.keys) {
      t.begin('insert', `insert ${k}`);
      merge(t, [t.make([k], 0)]);
    }
    for (let i = 0; i < t.w.keys.length; i++) {
      t.begin('remove', 'remove the maximum');
      removeMax(t);
    }
  },
};
