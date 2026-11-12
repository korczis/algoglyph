import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { insert, insertAll, L, R } from './_bst';

export const ORDERS = ['preorder', 'inorder', 'postorder', 'level order'] as const;

function walk(t: TreeOps, h: number, order: number): void {
  if (h === NIL) return;
  t.visit(h);
  if (order === 0) t.emit(t.key(h), 0);
  walk(t, t.child(h, L), order);
  if (order === 1) t.emit(t.key(h), 1);
  walk(t, t.child(h, R), order);
  if (order === 2) t.emit(t.key(h), 2);
}

// Grow a search tree, then visit it four ways: root before, between and after its subtrees
// (recursion, an implicit stack), and level by level (an explicit queue).
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'traversal',
  run(t) {
    insertAll(t, (h, k) => insert(t, h, k));
    for (let o = 0; o < 3; o++) {
      t.begin('traverse', ORDERS[o]);
      walk(t, t.root(), o);
    }
    t.begin('traverse', ORDERS[3]);
    const queue = t.root() === NIL ? [] : [t.root()];
    for (let i = 0; i < queue.length; i++) {
      const h = queue[i];
      t.visit(h);
      t.emit(t.key(h), 3);
      for (const side of [L, R]) if (t.child(h, side) !== NIL) queue.push(t.child(h, side));
    }
  },
};
