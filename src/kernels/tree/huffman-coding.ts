import type { TreeKernel, TreeOps } from '../../engines/tree/trace';

// The priority queue is a min-heap of node ids in a[1..n], ordered by the weight kept in each
// node's info. Root slot s holds the tree that symbol s's leaf currently belongs to.
function lighter(t: TreeOps, i: number, j: number): boolean {
  return t.less(t.info(t.get(i)), t.info(t.get(j)));
}

function exch(t: TreeOps, i: number, j: number): void {
  const x = t.get(i);
  t.set(i, t.get(j));
  t.set(j, x);
}

function push(t: TreeOps, n: number, x: number): void {
  t.set(n, x);
  for (let k = n; k > 1 && lighter(t, k, k >> 1); k >>= 1) exch(t, k, k >> 1);
}

function pop(t: TreeOps, n: number): number {
  const top = t.get(1);
  t.set(1, t.get(n));
  n--;
  let k = 1;
  while (2 * k <= n) {
    let j = 2 * k;
    if (j < n && lighter(t, j + 1, j)) j++;
    if (!lighter(t, j, k)) break;
    exch(t, k, j);
    k = j;
  }
  return top;
}

// Start with one leaf per symbol, weighted by its frequency; repeatedly take the two lightest
// trees from the priority queue and hang them under a new node whose weight is their sum.
export const kernel: TreeKernel = {
  input: 'weights',
  structure: 'huffman',
  infoLabel: 'weight',
  run(t) {
    const { symbols, weights } = t.w;
    const slot = new Map<number, number>();
    let n = 0;
    symbols.forEach((s, i) => {
      t.begin('insert', `leaf ${s} (${weights[i]})`);
      const x = t.make([s], 0);
      t.setInfo(x, weights[i]);
      t.setRoot(i, x);
      slot.set(x, i);
      n++;
      push(t, n, x);
    });
    while (n > 1) {
      t.begin('merge', 'merge the two lightest trees');
      const a = pop(t, n--);
      const b = pop(t, n--);
      t.visit(a); t.visit(b);
      const z = t.make([], 2);
      t.setInfo(z, t.info(a) + t.info(b));
      t.setChild(z, 0, a);
      t.setChild(z, 1, b);
      const sa = slot.get(a)!;
      t.setRoot(sa, z);
      t.setRoot(slot.get(b)!, -1);
      slot.set(z, sa);
      n++;
      push(t, n, z);
    }
  },
};
