import { mulberry32 } from '../../core/random';
import { between, type GridKernel, type GridOps } from '../../engines/grid/trace';
import { DP_READOUTS, DP_SERIES, range } from './_dp';

export interface KnapsackData {
  weights: number[];
  values: number[];
  capacity: number;
}

export interface KnapsackResult {
  best: number;
  /** Indices (0-based) of the items taken. */
  items: number[];
}

// 0/1 knapsack. Row i, column w holds the best value of the first i items within capacity w:
// either item i is left out (the cell above) or it is taken (the cell above, w_i to the left,
// plus its value). The traceback walks up from the corner, stepping left whenever an item was
// taken.
export const kernel: GridKernel<KnapsackData, KnapsackResult> = {
  size: { label: 'Items', min: 2, max: 14, step: 1, value: 7 },
  speed: 3,
  colour: 'linear',
  path: true,
  readouts: DP_READOUTS,
  chart: { kind: 'scaling', ns: [2, 4, 6, 8, 10, 12, 14, 16], x: 'items n (capacity grows with n)',
    y: 'operations', logX: true, logY: true, series: DP_SERIES },
  instance(n, seed) {
    const rnd = mulberry32(seed);
    const weights = range(n).map(() => between(rnd, 1, 8));
    const values = range(n).map(() => between(rnd, 1, 20));
    const capacity = Math.max(4, Math.round(n * 2.5));
    return {
      rows: n + 1,
      cols: capacity + 1,
      rowLabels: ['-', ...weights.map((w, i) => `${w}/${values[i]}`)],
      colLabels: range(capacity + 1).map(String),
      input: `${n} items (weight/value) ${weights.map((w, i) => `${w}/${values[i]}`).join(' ')}, capacity ${capacity}`,
      data: { weights, values, capacity },
      *run(g: GridOps) {
        for (let w = 0; w <= capacity; w++) g.write(0, w, 0);
        for (let i = 1; i <= n; i++) {
          const wt = weights[i - 1];
          for (let w = 0; w <= capacity; w++) {
            g.visit(i, w);
            const skip = g.read(i - 1, w);
            let best = skip;
            if (wt <= w) {
              const take = g.read(i - 1, w - wt) + values[i - 1];
              if (g.less(skip, take)) best = take;
            }
            g.write(i, w, best);
            yield;
          }
        }
        const best = g.read(n, capacity);
        const items: number[] = [];
        let w = capacity;
        for (let i = n; i >= 1; i--) {
          g.mark(i, w);
          yield;
          if (!g.equal(g.read(i, w), g.read(i - 1, w))) {
            items.push(i - 1);
            w -= weights[i - 1];
          }
        }
        g.mark(0, w);
        items.reverse();
        return {
          result: { best, items },
          summary: `best value ${best}, items ${items.map((i) => i + 1).join(', ') || 'none'}`,
        };
      },
    };
  },
};
