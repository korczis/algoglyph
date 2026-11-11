import { mulberry32 } from '../../core/random';
import { between, type GridKernel, type GridOps } from '../../engines/grid/trace';
import { DP_READOUTS, DP_SERIES } from './_dp';

export interface LcsData {
  a: string;
  b: string;
}

export interface LcsResult {
  length: number;
  /** One longest common subsequence, read back along the traceback. */
  lcs: string;
}

const ALPHABET = 'ACGT';

function word(rnd: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[between(rnd, 0, ALPHABET.length - 1)];
  return s;
}

// Cell (i, j) is the LCS length of the first i letters of a and the first j of b: one more than
// the diagonal when the letters match, otherwise the larger of the cells above and to the left.
// The traceback walks back from the corner, taking a letter on every diagonal step.
export const kernel: GridKernel<LcsData, LcsResult> = {
  size: { label: 'Length of a', min: 2, max: 20, step: 1, value: 10 },
  speed: 3,
  colour: 'linear',
  path: true,
  readouts: DP_READOUTS,
  chart: { kind: 'scaling', ns: [2, 4, 8, 12, 16, 24, 32], x: 'string length n', y: 'operations',
    logX: true, logY: true, series: DP_SERIES },
  instance(n, seed) {
    const rnd = mulberry32(seed);
    const a = word(rnd, n);
    const b = word(rnd, Math.max(1, n + between(rnd, -2, 2)));
    const m = b.length;
    return {
      rows: n + 1,
      cols: m + 1,
      rowLabels: ['-', ...a],
      colLabels: ['-', ...b],
      input: `a = ${a}, b = ${b}`,
      data: { a, b },
      run(g: GridOps) {
        for (let j = 0; j <= m; j++) g.write(0, j, 0);
        for (let i = 1; i <= n; i++) g.write(i, 0, 0);
        for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= m; j++) {
            g.visit(i, j);
            if (g.equal(a.charCodeAt(i - 1), b.charCodeAt(j - 1))) {
              g.write(i, j, g.read(i - 1, j - 1) + 1);
            } else {
              const up = g.read(i - 1, j);
              const left = g.read(i, j - 1);
              g.write(i, j, g.less(up, left) ? left : up);
            }
          }
        }
        const length = g.read(n, m);
        let lcs = '';
        let i = n;
        let j = m;
        while (i > 0 && j > 0) {
          g.mark(i, j);
          if (g.equal(a.charCodeAt(i - 1), b.charCodeAt(j - 1))) {
            lcs = a[i - 1] + lcs;
            i--; j--;
          } else if (g.less(g.read(i - 1, j), g.read(i, j - 1))) j--;
          else i--;
        }
        g.mark(i, j);
        return { result: { length, lcs }, summary: `length ${length}: ${lcs || '(empty)'}` };
      },
    };
  },
};
