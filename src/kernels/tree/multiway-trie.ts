import { NIL, wordLetters, type TreeKernel, type TreeOps } from '../../engines/tree/trace';
import { alphabetParams, drive } from './_digital';

const FIRST = wordLetters().charCodeAt(0);
const END = 1;

function insert(t: TreeOps, s: string, R: number): void {
  if (t.root() === NIL) t.setRoot(0, t.make([], R));
  let x = t.root();
  for (let i = 0; i < s.length; i++) {
    t.visit(x);
    const c = t.char(s, i, x) - FIRST;
    let y = t.child(x, c);
    if (y === NIL) { y = t.make([s[i]], R); t.setChild(x, c, y); }
    x = y;
  }
  t.visit(x);
  t.setTag(x, END);
}

function search(t: TreeOps, s: string): boolean {
  let x = t.root();
  for (let i = 0; x !== NIL && i < s.length; i++) {
    t.visit(x);
    x = t.child(x, t.char(s, i, x) - FIRST);
  }
  if (x === NIL) return false;
  t.visit(x);
  return t.tag(x) === END;
}

// One node per distinct prefix, with one link per letter of the alphabet; the i-th character
// of the key picks the link at depth i, and a mark says where a word ends. A search reads each
// character once and makes no key comparison at all.
export const kernel: TreeKernel = {
  input: 'words',
  structure: 'rway-trie',
  colour: 'terminal',
  params: alphabetParams(),
  run(t) {
    // one link per letter of the workload's alphabet
    const R = wordLetters(t.w.opts.letters).length;
    drive(t, (k) => insert(t, k as string, R), (k) => search(t, k as string));
  },
};
