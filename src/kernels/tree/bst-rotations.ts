import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { insert, insertAll, L, R, rotL, rotR, searchAll, size } from './_bst';

/** Rotate the node of rank k (0-based) in h's subtree up to its root. */
function partition(t: TreeOps, h: number, k: number): number {
  t.visit(h);
  const s = size(t, t.child(h, L));
  if (s > k) {
    t.setChild(h, L, partition(t, t.child(h, L), k));
    return rotR(t, h, true);
  }
  if (s < k) {
    t.setChild(h, R, partition(t, t.child(h, R), k - s - 1));
    return rotL(t, h, true);
  }
  return h;
}

/** Rotate the median to the root, then balance both subtrees the same way. */
function balance(t: TreeOps, h: number): number {
  if (h === NIL || size(t, h) < 2) return h;
  const r = partition(t, h, Math.floor(size(t, h) / 2));
  t.setChild(r, L, balance(t, t.child(r, L)));
  t.setChild(r, R, balance(t, t.child(r, R)));
  return r;
}

// Build a tree in arrival order, then rebalance it with nothing but rotations: partition the
// median up to the root and recurse. In-order is unchanged by every rotation.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'bst',
  run(t) {
    insertAll(t, (h, k) => insert(t, h, k, true));
    searchAll(t);
    t.begin('balance', 'balance by rotations');
    t.setRoot(0, balance(t, t.root()));
    searchAll(t);
  },
};
