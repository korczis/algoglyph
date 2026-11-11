import { mulberry32 } from '../../core/random';
import { between, type GridKernel, type GridOps } from '../../engines/grid/trace';
import { DP_READOUTS, DP_SERIES, range } from './_dp';

export interface BstData {
  /** Access frequency of key k (keys are 0 .. n-1 in order). */
  freq: number[];
}

export interface BstResult {
  /** Sum over keys of frequency x (depth + 1), the root at depth 0. */
  cost: number;
  /** parent[k] is the parent key of k, -1 for the root. */
  parent: number[];
}

// Cell (i, j) is the least weighted search cost of a tree on keys i .. j-1. Choosing root r puts
// every key of the range one level deeper, so the cost is the range's total frequency plus the
// cheapest tree on each side of r; both sides are shorter ranges already in the table.
export const kernel: GridKernel<BstData, BstResult> = {
  size: { label: 'Keys', min: 2, max: 12, step: 1, value: 7 },
  speed: 4,
  colour: 'linear',
  readouts: DP_READOUTS,
  chart: { kind: 'scaling', ns: [2, 4, 6, 8, 12, 16, 24, 32], x: 'keys n', y: 'operations',
    logX: true, logY: true, series: DP_SERIES },
  instance(n, seed) {
    const rnd = mulberry32(seed);
    const freq = range(n).map(() => between(rnd, 1, 20));
    const prefix = [0];
    for (const f of freq) prefix.push(prefix[prefix.length - 1] + f);
    return {
      rows: n + 1,
      cols: n + 1,
      rowLabels: range(n + 1).map(String),
      colLabels: range(n + 1).map(String),
      inactive: (r, c) => c < r,
      input: `frequencies ${freq.join(' ')}`,
      data: { freq },
      run(g: GridOps) {
        const root = range(n + 1).map(() => new Array<number>(n + 1).fill(-1));
        for (let i = 0; i <= n; i++) g.write(i, i, 0);
        for (let len = 1; len <= n; len++) {
          for (let i = 0; i + len <= n; i++) {
            const j = i + len;
            g.visit(i, j);
            let best = 0;
            for (let r = i; r < j; r++) {
              const q = g.read(i, r) + g.read(r + 1, j);
              if (r === i || g.less(q, best)) { best = q; root[i][j] = r; }
            }
            g.write(i, j, best + prefix[j] - prefix[i]);
          }
        }
        const parent = new Array<number>(n).fill(-1);
        const build = (i: number, j: number, up: number): void => {
          g.mark(i, j);
          if (i === j) return;
          const r = root[i][j];
          parent[r] = up;
          build(i, r, r);
          build(r + 1, j, r);
        };
        const cost = g.read(0, n);
        build(0, n, -1);
        return { result: { cost, parent }, summary: `expected cost ${cost}, root key ${root[0][n] + 1}` };
      },
    };
  },
};
