import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { drive, keyBitsParams } from './_digital';

function insert(t: TreeOps, k: number): void {
  let x = t.root();
  if (x === NIL) { t.setRoot(0, t.make([k], 2)); return; }
  for (let d = 0; ; d++) {
    t.visit(x);
    if (t.cmp(k, t.key(x), x) === 0) return;
    const b = t.bit(k, d, x);
    const c = t.child(x, b);
    if (c === NIL) { t.setChild(x, b, t.make([k], 2)); return; }
    x = c;
  }
}

function search(t: TreeOps, k: number): boolean {
  let x = t.root();
  for (let d = 0; x !== NIL; d++) {
    t.visit(x);
    if (t.cmp(k, t.key(x), x) === 0) return true;
    x = t.child(x, t.bit(k, d, x));
  }
  return false;
}

// Like a search tree, every node holds a key, but the branch at depth d is decided by bit d of
// the search key rather than by a comparison, so no path is longer than the key's width.
export const kernel: TreeKernel = {
  input: 'bits',
  params: keyBitsParams(),
  structure: 'dst',
  layout: 'tidy',
  run(t) { drive(t, (k) => insert(t, k as number), (k) => search(t, k as number)); },
};
