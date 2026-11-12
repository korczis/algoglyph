import { OP, type GridKernel, type GridOps, type Steps } from '../../engines/grid/trace';

export interface FibResult {
  naive: number;
  memo: number;
}

// Row 0 is the naive recursion: every call stores its value again, so the cell of argument k is
// written once per call on k. Row 1 is the memo table: a call first looks its argument up and
// computes it only on a miss.
export const kernel: GridKernel<{ n: number }, FibResult> = {
  size: { label: 'n', min: 2, max: 24, step: 1, value: 12 },
  speed: 12,
  colour: 'log',
  readouts: [
    { name: 'Naive calls', of: (t) => t.inRow(OP.visit, 0) },
    { name: 'Naive recomputations', of: (t) => t.inRow(OP.write, 0) - t.computedByRow[0] },
    { name: 'Memoised calls', of: (t) => t.inRow(OP.visit, 1) },
    { name: 'Memo hits (reused)', of: (t) => t.hits },
    { name: 'Table cells computed', of: (t) => t.inRow(OP.write, 1) },
  ],
  chart: {
    kind: 'scaling',
    ns: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
    x: 'n',
    y: 'calls',
    logY: true,
    series: [
      { name: 'Naive recursion', of: (t) => t.inRow(OP.visit, 0) },
      { name: 'Memoised', of: (t) => t.inRow(OP.visit, 1) },
    ],
  },
  instance(n) {
    return {
      rows: 2,
      cols: n + 1,
      rowLabels: ['naive', 'memo'],
      colLabels: Array.from({ length: n + 1 }, (_, k) => String(k)),
      input: `F(${n})`,
      data: { n },
      *run(g: GridOps) {
        function* naive(k: number): Steps<number> {
          g.visit(0, k);
          yield;
          const v = k < 2 ? k : (yield* naive(k - 1)) + (yield* naive(k - 2));
          g.write(0, k, v);
          return v;
        }
        function* memo(k: number): Steps<number> {
          g.visit(1, k);
          yield;
          if (g.known(1, k)) return g.read(1, k);
          const v = k < 2 ? k : (yield* memo(k - 1)) + (yield* memo(k - 2));
          g.write(1, k, v);
          return v;
        }
        const a = yield* naive(n);
        const b = yield* memo(n);
        return { result: { naive: a, memo: b }, summary: `F(${n}) = ${b}` };
      },
    };
  },
};
