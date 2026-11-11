import { mulberry32 } from '../../core/random';
import { between, type GridKernel, type GridOps } from '../../engines/grid/trace';
import { DP_READOUTS, DP_SERIES, range } from './_dp';

export interface ChainData {
  /** Matrix i is dims[i] x dims[i + 1]. */
  dims: number[];
}

export interface ChainResult {
  cost: number;
  /** The cheapest order, fully parenthesised, matrices named A1 .. An. */
  order: string;
}

// Cell (i, j) holds the fewest scalar multiplications that compute A_i .. A_j. It tries every
// split k between i and j: the two shorter chains (already in the table, to its left and below)
// plus the cost of multiplying their results. Chains are filled by length, diagonal by diagonal.
export const kernel: GridKernel<ChainData, ChainResult> = {
  size: { label: 'Matrices', min: 2, max: 12, step: 1, value: 7 },
  speed: 4,
  colour: 'log',
  readouts: DP_READOUTS,
  chart: { kind: 'scaling', ns: [2, 4, 6, 8, 12, 16, 24, 32], x: 'matrices n', y: 'operations',
    logX: true, logY: true, series: DP_SERIES },
  instance(n, seed) {
    const rnd = mulberry32(seed);
    const dims = range(n + 1).map(() => between(rnd, 2, 30));
    const names = range(n).map((i) => `A${i + 1}`);
    return {
      rows: n,
      cols: n,
      rowLabels: names,
      colLabels: names,
      inactive: (r, c) => c < r,
      input: `dimensions ${dims.join(' x ')}`,
      data: { dims },
      run(g: GridOps) {
        const split = range(n).map(() => new Array<number>(n).fill(-1));
        for (let i = 0; i < n; i++) g.write(i, i, 0);
        for (let len = 2; len <= n; len++) {
          for (let i = 0; i + len - 1 < n; i++) {
            const j = i + len - 1;
            g.visit(i, j);
            let best = 0;
            for (let k = i; k < j; k++) {
              const q = g.read(i, k) + g.read(k + 1, j) + dims[i] * dims[k + 1] * dims[j + 1];
              if (k === i || g.less(q, best)) { best = q; split[i][j] = k; }
            }
            g.write(i, j, best);
          }
        }
        const paren = (i: number, j: number): string => {
          g.mark(i, j);
          if (i === j) return names[i];
          const k = split[i][j];
          return `(${paren(i, k)} ${paren(k + 1, j)})`;
        };
        const cost = g.read(0, n - 1);
        const order = paren(0, n - 1);
        return { result: { cost, order }, summary: `${cost} multiplications: ${order}` };
      },
    };
  },
};
