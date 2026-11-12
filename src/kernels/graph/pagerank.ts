import type { GraphKernel } from '../../engines/graph/trace';
import { pagerank, type RankResult } from './_pagerank';

// The random surfer follows an out-edge with probability d and jumps to a vertex chosen
// uniformly with probability 1 - d (always, from a vertex with no out-edges). Power iteration
// converges at rate d per round to the surfer's stationary distribution, which sums to one.
export const kernel: GraphKernel<RankResult> = {
  goal: 'pagerank',
  inputs: ['digraph', 'small-world', 'communities', 'random', 'ownership'],
  n: { min: 3, max: 150, value: 80 },
  params: [{ kind: 'range', key: 'damping', label: 'Damping d', min: 0.05, max: 0.95, step: 0.05, value: 0.85, rebuild: true }],
  view: { colour: 'value', size: true },
  names: { value: 'Rank' },
  readouts: ['rounds', 'scans', 'change'],
  chart: { title: 'Total change per round (log)', x: 'rounds', y: 'L1 change', series: ['change'], log: true },
  *steps(ops, { p }) {
    const n = ops.g.n;
    return yield* pagerank(ops, Number(p.damping), new Array<number>(n).fill(1 / n));
  },
  report(r) {
    let top = 0;
    for (let v = 1; v < r.rank.length; v++) if (r.rank[v] > r.rank[top]) top = v;
    return [
      { label: 'Converged', value: `after ${r.rounds} rounds; scores sum to ${r.rank.reduce((s, x) => s + x, 0).toFixed(6)}` },
      { label: 'Highest rank', value: `vertex ${top}: ${r.rank[top].toFixed(4)}` },
    ];
  },
};
