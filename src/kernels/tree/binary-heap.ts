import type { TreeKernel, TreeOps } from '../../engines/tree/trace';

// a max-heap in a[1..n]: the parent of position k is k/2, its children 2k and 2k+1
function exch(t: TreeOps, i: number, j: number): void {
  const x = t.get(i);
  t.set(i, t.get(j));
  t.set(j, x);
}

function swim(t: TreeOps, k: number): void {
  while (k > 1) {
    t.visit(k);
    if (!t.less(t.get(k >> 1), t.get(k), k)) break;
    exch(t, k >> 1, k);
    k >>= 1;
  }
}

function sink(t: TreeOps, k: number, n: number): void {
  while (2 * k <= n) {
    t.visit(k);
    let j = 2 * k;
    if (j < n && t.less(t.get(j), t.get(j + 1), j)) j++;
    if (!t.less(t.get(k), t.get(j), k)) break;
    exch(t, k, j);
    k = j;
  }
}

// Insert puts the key in the next free leaf and swims it up past smaller parents; remove-max
// takes the root, moves the last leaf into its place and sinks it below its larger child. The
// tree is complete, so both cost at most lg n levels.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'heap',
  view: 'heap',
  run(t) {
    let n = 0;
    for (const k of t.w.keys) {
      t.begin('insert', `insert ${k}`);
      n++;
      t.size(n);
      t.set(n, k as number);
      swim(t, n);
    }
    while (n > 0) {
      t.begin('remove', 'remove the maximum');
      t.visit(1);
      t.emit(t.get(1));
      t.set(1, t.get(n));
      n--;
      t.size(n);
      sink(t, 1, n);
    }
  },
};
