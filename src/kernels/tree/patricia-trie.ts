import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { drive } from './_digital';

// Every node holds one key and, in info, the index of the bit it branches on. The root (the
// header) holds the first key and bit -1 and uses only its left link. A link that does not lead
// to a node with a larger bit index points back up, to the node whose key ends the search.
function descend(t: TreeOps, k: number, stopAt = Infinity): { p: number; x: number } {
  const head = t.root();
  let p = head;
  let x = t.child(head, 0);
  while (t.info(x) > t.info(p) && t.info(x) < stopAt) {
    t.visit(x);
    p = x;
    x = t.child(x, t.bit(k, t.info(x), x));
  }
  return { p, x };
}

function insert(t: TreeOps, k: number): void {
  const head = t.root();
  if (head === NIL) {
    const h = t.make([k], 2);
    t.setInfo(h, -1);
    t.setChild(h, 0, h);
    t.setRoot(0, h);
    return;
  }
  t.visit(head);
  const { x: hit } = descend(t, k);
  t.visit(hit);
  const other = t.key(hit) as number;
  if (t.cmp(k, other, hit) === 0) return;
  let i = 0;
  while (t.bit(k, i, hit) === t.bit(other, i, hit)) i++;
  const { p, x } = descend(t, k, i);
  const z = t.make([k], 2);
  t.setInfo(z, i);
  const b = t.bit(k, i, z);
  t.setChild(z, b, z);
  t.setChild(z, 1 - b, x);
  if (p === head) t.setChild(head, 0, z);
  else t.setChild(p, t.bit(k, t.info(p), p), z);
}

function search(t: TreeOps, k: number): boolean {
  const head = t.root();
  if (head === NIL) return false;
  t.visit(head);
  const { x } = descend(t, k);
  t.visit(x);
  return t.cmp(k, t.key(x), x) === 0;
}

// A search tests only the bits where keys actually differ, follows links while they lead to a
// higher bit index, and ends with a single full comparison against the key it lands on.
export const kernel: TreeKernel = {
  input: 'bits',
  structure: 'patricia',
  layout: 'tidy',
  infoLabel: 'bit',
  run(t) { drive(t, (k) => insert(t, k as number), (k) => search(t, k as number)); },
};
