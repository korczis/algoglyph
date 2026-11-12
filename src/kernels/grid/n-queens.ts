import { OP, type GridKernel, type GridOps, type Steps } from '../../engines/grid/trace';
import { range } from './_dp';

export interface QueensResult {
  /** Every solution, as the column of the queen in each row. */
  solutions: number[][];
}

// Row by row, try each column; a queen goes down only on a square no earlier queen attacks
// (its column and both diagonals are kept as flags), and is taken back when the rows below it
// are exhausted. Every solution is recorded, so the search runs to the end of the tree.
export const kernel: GridKernel<{ n: number }, QueensResult> = {
  size: { label: 'Board size', min: 4, max: 10, step: 1, value: 6 },
  colour: 'linear',
  readouts: [
    { name: 'Positions tried', of: (t) => t.count(OP.visit) },
    { name: 'Queens placed', of: (t) => t.count(OP.place) },
    { name: 'Backtracks (queens taken back)', of: (t) => t.count(OP.remove) },
    { name: 'Solutions found', of: (t) => t.count(OP.solution) },
  ],
  chart: {
    kind: 'rows',
    title: 'Search effort by row',
    x: 'row',
    y: 'count',
    series: [
      { name: 'Positions tried', op: OP.visit },
      { name: 'Queens placed', op: OP.place },
      { name: 'Backtracks', op: OP.remove },
    ],
  },
  instance(n) {
    return {
      rows: n,
      cols: n,
      rowLabels: range(n).map((r) => String(r + 1)),
      colLabels: range(n).map((c) => String.fromCharCode(97 + c)),
      input: `${n} x ${n} board`,
      data: { n },
      *run(g: GridOps) {
        const col = new Uint8Array(n);
        const down = new Uint8Array(2 * n);
        const up = new Uint8Array(2 * n);
        const queen = new Array<number>(n).fill(-1);
        const solutions: number[][] = [];
        function* solve(r: number): Steps<void> {
          if (r === n) {
            g.solution();
            solutions.push(queen.slice());
            return;
          }
          for (let c = 0; c < n; c++) {
            g.visit(r, c);
            yield;
            if (col[c] || down[r + c] || up[r - c + n]) continue;
            g.place(r, c);
            col[c] = 1; down[r + c] = 1; up[r - c + n] = 1; queen[r] = c;
            yield* solve(r + 1);
            col[c] = 0; down[r + c] = 0; up[r - c + n] = 0; queen[r] = -1;
            g.remove(r, c);
          }
        }
        yield* solve(0);
        return { result: { solutions }, summary: `${solutions.length} solutions` };
      },
    };
  },
};
