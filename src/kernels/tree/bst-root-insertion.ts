import { NIL, type Key, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { insertAll, L, leaf, R, rotL, rotR, searchAll } from './_bst';

// Insert as usual, and on the way back up rotate the new node over each ancestor, so it ends
// at the root: recently inserted keys are found after a few comparisons.
function insertRoot(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) return leaf(t, k);
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c === 0) return h;
  if (c < 0) {
    t.setChild(h, L, insertRoot(t, t.child(h, L), k));
    return rotR(t, h);
  }
  t.setChild(h, R, insertRoot(t, t.child(h, R), k));
  return rotL(t, h);
}

export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'bst',
  run(t) {
    insertAll(t, (h, k) => insertRoot(t, h, k));
    searchAll(t);
  },
};
