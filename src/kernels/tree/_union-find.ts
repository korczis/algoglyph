// Union-find on sites 0..n-1, worked through the array: a[i] is site i's component id or
// parent, a[n + i] the size of the tree rooted at i where a kernel weights its unions. Each
// array access is counted, the classic cost model of these algorithms.
import type { TreeOps } from '../../engines/tree/trace';

export interface UnionFind {
  weighted?: boolean;
  /** Point every site on a find's path straight at the root. */
  compress?: boolean;
}

export function find(t: TreeOps, p: number, compress = false): number {
  let x = p;
  for (;;) {
    t.visit(x);
    const y = t.get(x);
    if (y === x) break;
    x = y;
  }
  if (compress) {
    let y = p;
    while (y !== x) {
      const up = t.get(y);
      t.set(y, x);
      y = up;
    }
  }
  return x;
}

/** Run the workload's pairs through a forest-based union-find. */
export function forest(t: TreeOps, uf: UnionFind): void {
  const n = t.w.sites;
  t.size(n);
  for (let i = 0; i < n; i++) {
    t.set(i, i);
    if (uf.weighted) t.set(n + i, 1);
  }
  for (const [p, q] of t.w.pairs) {
    t.begin('union', `union ${p} ${q}`);
    const i = find(t, p, uf.compress);
    const j = find(t, q, uf.compress);
    if (i === j) { t.found(`${p}-${q}`, true); continue; }
    t.found(`${p}-${q}`, false);
    if (!uf.weighted) { t.set(i, j); continue; }
    const si = t.get(n + i);
    const sj = t.get(n + j);
    if (si < sj) { t.set(i, j); t.set(n + j, si + sj); } else { t.set(j, i); t.set(n + i, si + sj); }
  }
}
