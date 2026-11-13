import { NIL, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { alphabetParams, drive } from './_digital';

const LO = 0;
const EQ = 1;
const HI = 2;
const END = 1;

function insert(t: TreeOps, h: number, s: string, d: number): number {
  const c = s[d];
  if (h === NIL) h = t.make([c], 3);
  t.visit(h);
  const r = t.cmp(c, t.key(h), h);
  if (r < 0) t.setChild(h, LO, insert(t, t.child(h, LO), s, d));
  else if (r > 0) t.setChild(h, HI, insert(t, t.child(h, HI), s, d));
  else if (d + 1 < s.length) t.setChild(h, EQ, insert(t, t.child(h, EQ), s, d + 1));
  else t.setTag(h, END);
  return h;
}

function search(t: TreeOps, s: string): boolean {
  let x = t.root();
  let d = 0;
  while (x !== NIL) {
    t.visit(x);
    const r = t.cmp(s[d], t.key(x), x);
    if (r < 0) x = t.child(x, LO);
    else if (r > 0) x = t.child(x, HI);
    else if (d + 1 < s.length) { x = t.child(x, EQ); d++; } else return t.tag(x) === END;
  }
  return false;
}

// Each node holds one character and three links: to smaller characters at the same position,
// to the next position, and to larger characters. Only links that exist take space.
export const kernel: TreeKernel = {
  input: 'words',
  structure: 'tst',
  colour: 'terminal',
  params: alphabetParams(),
  run(t) {
    drive(t, (k) => t.setRoot(0, insert(t, t.root(), k as string, 0)), (k) => search(t, k as string));
  },
};
