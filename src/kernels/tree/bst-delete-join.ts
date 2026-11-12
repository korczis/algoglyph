import { NIL, type Key, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { deleteShareParams, insert, insertAll, L, R, rotR, searchAll } from './_bst';

/** Rotate the smallest key of h's subtree up to its root. */
function minToRoot(t: TreeOps, h: number): number {
  const l = t.child(h, L);
  if (l === NIL) return h;
  t.visit(l);
  t.setChild(h, L, minToRoot(t, l));
  return rotR(t, h);
}

/** Join two trees whose keys are all smaller in a than in b. */
function join(t: TreeOps, a: number, b: number): number {
  if (b === NIL) return a;
  const r = minToRoot(t, b);
  t.setChild(r, L, a);
  return r;
}

function remove(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) { t.found(k, false); return NIL; }
  t.visit(h);
  const c = t.cmp(k, t.key(h), h);
  if (c < 0) { t.setChild(h, L, remove(t, t.child(h, L), k)); return h; }
  if (c > 0) { t.setChild(h, R, remove(t, t.child(h, R), k)); return h; }
  t.found(k, true);
  const r = join(t, t.child(h, L), t.child(h, R));
  t.free(h);
  return r;
}

// Delete by replacing the node with the join of its two subtrees: the smallest key on the right
// is rotated up to become their common root. The tree loses its random shape as deletions mount.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'bst',
  deletes: true,
  params: deleteShareParams(),
  run(t) {
    insertAll(t, (h, k) => insert(t, h, k));
    searchAll(t);
    for (const k of t.w.deletes) {
      t.begin('delete', `delete ${k}`);
      t.setRoot(0, remove(t, t.root(), k));
    }
  },
};
