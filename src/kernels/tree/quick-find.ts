import type { TreeKernel } from '../../engines/tree/trace';

// a[i] is the component id of site i, so a find is one read; a union rewrites every site that
// carries the first id, which scans the whole array each time.
export const kernel: TreeKernel = {
  input: 'pairs',
  structure: 'union-find',
  view: 'parent',
  run(t) {
    const n = t.w.sites;
    t.size(n);
    for (let i = 0; i < n; i++) t.set(i, i);
    for (const [p, q] of t.w.pairs) {
      t.begin('union', `union ${p} ${q}`);
      t.visit(p); t.visit(q);
      const pid = t.get(p);
      const qid = t.get(q);
      if (pid === qid) { t.found(`${p}-${q}`, true); continue; }
      t.found(`${p}-${q}`, false);
      for (let i = 0; i < n; i++) {
        if (t.get(i) === pid) { t.visit(i); t.set(i, qid); }
      }
    }
  },
};
