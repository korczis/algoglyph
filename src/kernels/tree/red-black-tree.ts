import { NIL, type Key, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { insertAll, L, R, searchAll } from './_bst';

const RED = 1;
const BLACK = 0;
const red = (t: TreeOps, h: number) => h !== NIL && t.tag(h) === RED;

function rotate(t: TreeOps, h: number, up: number): number {
  const down = 1 - up;
  const x = t.child(h, up);
  t.rotate(h);
  t.setChild(h, up, t.child(x, down));
  t.setChild(x, down, h);
  t.setTag(x, t.tag(h));
  t.setTag(h, RED);
  return x;
}

/** A 4-node (black node, two red children) becomes two 2-nodes and passes its middle key up. */
function flip(t: TreeOps, h: number): void {
  t.setTag(h, 1 - t.tag(h));
  t.setTag(t.child(h, L), 1 - t.tag(t.child(h, L)));
  t.setTag(t.child(h, R), 1 - t.tag(t.child(h, R)));
}

function insert(t: TreeOps, h: number, k: Key): number {
  if (h === NIL) return t.make([k], 2, RED);
  t.visit(h);
  if (red(t, t.child(h, L)) && red(t, t.child(h, R))) flip(t, h);
  const c = t.cmp(k, t.key(h), h);
  if (c !== 0) {
    const side = c < 0 ? L : R;
    t.setChild(h, side, insert(t, t.child(h, side), k));
  }
  if (red(t, t.child(h, R)) && !red(t, t.child(h, L))) h = rotate(t, h, R);
  if (red(t, t.child(h, L)) && red(t, t.child(t.child(h, L), L))) h = rotate(t, h, L);
  return h;
}

// The left-leaning formulation: a red link joins a node to its parent inside one 2-3-4 node.
// Four-nodes are split by a colour flip on the way down, and rotations on the way up keep red
// links leaning left and never two in a row, so every root-to-leaf path has the same number of
// black links.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'red-black',
  colour: 'red-black',
  run(t) {
    insertAll(t, (h, k) => {
      const r = insert(t, h, k);
      t.setTag(r, BLACK);
      return r;
    });
    searchAll(t);
  },
};
