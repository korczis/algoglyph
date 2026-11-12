import type { TreeKernel, TreeOps } from '../../engines/tree/trace';

// A heap value packs the run a key belongs to above the key, so the minimum is always the
// smallest key of the current run, and keys held back for the next run sort after all of them.
const RUN = 2 ** 20;

function sink(t: TreeOps, k: number, n: number): void {
  while (2 * k <= n) {
    t.visit(k);
    let j = 2 * k;
    if (j < n && t.less(t.get(j + 1), t.get(j), j)) j++;
    if (!t.less(t.get(j), t.get(k), k)) break;
    const x = t.get(k);
    t.set(k, t.get(j));
    t.set(j, x);
    k = j;
  }
}

function swim(t: TreeOps, k: number): void {
  while (k > 1) {
    t.visit(k);
    if (!t.less(t.get(k), t.get(k >> 1), k)) break;
    const x = t.get(k);
    t.set(k, t.get(k >> 1));
    t.set(k >> 1, x);
    k >>= 1;
  }
}

// Fill memory with M keys, then repeatedly write out the smallest and read the next input key in
// its place. A key smaller than the one just written cannot join the current run, so it is
// marked for the next. On random input the runs come out about 2M long.
export const kernel: TreeKernel = {
  input: 'keys',
  structure: 'runs',
  view: 'heap',
  params: [{ kind: 'range', key: 'memory', label: 'Memory M (keys held)', min: 2, max: 64, step: 1, value: 8, rebuild: true }],
  decode: (v) => ({ key: v % RUN, group: Math.floor(v / RUN) }),
  run(t) {
    const input = t.w.keys as number[];
    const m = Math.min(t.w.opts.memory ?? 8, input.length);
    let n = 0;
    let next = 0;
    for (; next < m; next++) {
      t.begin('insert', `read ${input[next]}`);
      n++;
      t.size(n);
      t.set(n, input[next]);
      swim(t, n);
    }
    while (n > 0) {
      const top = t.get(1);
      const run = Math.floor(top / RUN);
      const key = top % RUN;
      if (next < input.length) {
        const x = input[next++];
        t.begin('replace', `write ${key}, read ${x}`);
        t.visit(1);
        t.emit(key, run);
        const r = t.less(x, key, 1) ? run + 1 : run;
        t.set(1, r * RUN + x);
      } else {
        t.begin('drain', `write ${key}`);
        t.visit(1);
        t.emit(key, run);
        t.set(1, t.get(n));
        n--;
        t.size(n);
      }
      sink(t, 1, n);
    }
  },
};
