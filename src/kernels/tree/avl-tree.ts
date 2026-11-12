import { NIL, type Key, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { insertAll, L, leaf, R, rotL, rotR, searchAll } from './_bst';

// info holds the height of the node's subtree (a leaf has height 1)
const height = (t: TreeOps, h: number) => (h === NIL ? 0 : t.info(h));
const fix = (t: TreeOps, h: number) => t.setInfo(h, 1 + Math.max(height(t, t.child(h, L)), height(t, t.child(h, R))));
const tilt = (t: TreeOps, h: number) => height(t, t.child(h, L)) - height(t, t.child(h, R));

function rotateRight(t: TreeOps, h: number): number {
  const x = rotR(t, h);
  fix(t, h); fix(t, x);
  return x;
}

function rotateLeft(t: TreeOps, h: number): number {
  const x = rotL(t, h);
  fix(t, h); fix(t, x);
  return x;
}

/** Restore |height(left) - height(right)| <= 1 at h with one or two rotations. */
function rebalance(t: TreeOps, h: number): number {
  fix(t, h);
  const b = tilt(t, h);
  if (b > 1) {
    if (tilt(t, t.child(h, L)) < 0) t.setChild(h, L, rotateLeft(t, t.child(h, L)));
    return rotateRight(t, h);
  }
  if (b < -1) {
    if (tilt(t, t.child(h, R)) > 0) t.setChild(h, R, rotateRight(t, t.child(h, R)));
    return rotateLeft(t, h);
  }
  return h;
}

function insert(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) { const x = leaf(t, k); t.setInfo(x, 1); return x; }
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return h;
  const side = c < 0 ? L : R;
  t.setChild(h, side, insert(t, t.child(h, side), k));
  return rebalance(t, h);
}

// Insert at the bottom, then walk back up fixing heights; the first node whose subtrees differ
// in height by two is repaired by a single rotation, or a double one when the heavy grandchild
// sits on the inside.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'avl',
  infoLabel: 'height',
  run(t) {
    insertAll(t, (h, k) => insert(t, h, k));
    searchAll(t);
  },
};
