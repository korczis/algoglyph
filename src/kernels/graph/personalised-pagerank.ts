import type { GraphKernel } from '../../engines/graph/trace';
import { pagerank, type RankResult } from './_pagerank';

// PageRank whose teleport vector is the subject alone: the surfer restarts at the subject with
// probability 1 - d. The stationary scores measure proximity to the subject through many short
// paths, not global importance.
export const kernel: GraphKernel<RankResult> = {
  goal: 'pagerank',
  inputs: ['communities', 'small-world', 'digraph', 'geometric'],
  n: { min: 3, max: 150, value: 80 },
  params: [{ kind: 'range', key: 'damping', label: 'Damping d', min: 0.05, max: 0.95, step: 0.05, value: 0.85, rebuild: true }],
  pick: 's',
  endpoints: 's',
  view: { colour: 'value', size: true },
  names: { value: 'Rank' },
  readouts: ['rounds', 'scans', 'change'],
  chart: { title: 'Total change per round (log)', x: 'rounds', y: 'L1 change', series: ['change'], log: true },
  speed: 60,
  *steps(ops, { s, p }) {
    const n = ops.g.n;
    const tele = new Array<number>(n).fill(0);
    tele[s] = 1;
    return yield* pagerank(ops, Number(p.damping), tele);
  },
  report(r, _g, { s }) {
    let top = -1;
    for (let v = 0; v < r.rank.length; v++) if (v !== s && (top < 0 || r.rank[v] > r.rank[top])) top = v;
    return [
      { label: 'Converged', value: `after ${r.rounds} rounds` },
      { label: 'Closest to the subject', value: top < 0 ? 'none' : `vertex ${top}: ${r.rank[top].toFixed(4)}` },
    ];
  },
};
