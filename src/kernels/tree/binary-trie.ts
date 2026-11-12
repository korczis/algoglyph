import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { drive } from './_digital';

// Internal nodes are make([], 2) and branch on one bit per level; keys live in leaves, make([k], 0).
const isLeaf = (t: TreeOps, x: number) => t.degree(x) === 0;

/** A subtree holding two leaves whose keys agree on bits before d: branch until they differ. */
function separate(t: TreeOps, a: number, b: number, d: number): number {
  const z = t.make([], 2);
  const ba = t.bit(t.key(a) as number, d, z);
  const bb = t.bit(t.key(b) as number, d, z);
  if (ba === bb) t.setChild(z, ba, separate(t, a, b, d + 1));
  else { t.setChild(z, ba, a); t.setChild(z, bb, b); }
  return z;
}

function insert(t: TreeOps, k: number): void {
  let x = t.root();
  if (x === NIL) { t.setRoot(0, t.make([k], 0)); return; }
  let parent = NIL; let side = 0; let d = 0;
  for (;;) {
    t.visit(x);
    if (isLeaf(t, x)) {
      if (t.cmp(k, t.key(x), x) === 0) return;
      const z = separate(t, x, t.make([k], 0), d);
      if (parent === NIL) t.setRoot(0, z); else t.setChild(parent, side, z);
      return;
    }
    const b = t.bit(k, d, x);
    const c = t.child(x, b);
    if (c === NIL) { t.setChild(x, b, t.make([k], 0)); return; }
    parent = x; side = b; x = c; d++;
  }
}

function search(t: TreeOps, k: number): boolean {
  let x = t.root();
  let d = 0;
  while (x !== NIL) {
    t.visit(x);
    if (isLeaf(t, x)) return t.cmp(k, t.key(x), x) === 0;
    x = t.child(x, t.bit(k, d++, x));
  }
  return false;
}

// Branch left on a 0 bit and right on a 1, one bit per level, and stop as soon as a key is
// alone in its subtree. The trie depends only on the set of keys, never on their order.
export const kernel: TreeKernel = {
  input: 'bits',
  structure: 'binary-trie',
  run(t) { drive(t, (k) => insert(t, k as number), (k) => search(t, k as number)); },
};
