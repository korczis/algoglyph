import { other } from '../../engines/graph/graph';
import type { GraphKernel } from '../../engines/graph/trace';

export interface LabelsResult { label: number[]; rounds: number; converged: boolean }

// Every vertex starts with its own label. In each round the vertices, in a fresh random order,
// take the label most common among their neighbours (a tie keeps the current label if it is
// among the most common, else picks one of them at random). The rounds stop when one changes
// nothing: then every vertex holds a most common label of its neighbourhood.
export const kernel: GraphKernel<LabelsResult> = {
  goal: 'lpa',
  inputs: ['communities', 'small-world', 'geometric', 'islands'],
  n: { min: 4, max: 300, value: 90 },
  view: { colour: 'group', truth: true },
  names: { groups: 'Labels in use' },
  readouts: ['rounds', 'groups', 'modularity', 'scans'],
  chart: { title: 'Labels in use', x: 'rounds', y: 'labels', series: ['groups'] },
  speed: 6,
  *steps(ops) {
    const g = ops.g;
    const label = Array.from({ length: g.n }, (_, v) => v);
    for (let v = 0; v < g.n; v++) ops.group(v, v);
    const order = label.slice();
    let rounds = 0; let converged = false;
    while (rounds < 200) {
      rounds++;
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(ops.rnd() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      let changed = 0;
      for (const v of order) {
        if (!g.out[v].length) continue;
        const count = new Map<number, number>();
        for (const e of g.out[v]) {
          ops.scan(e);
          const l = label[other(g, e, v)];
          count.set(l, (count.get(l) ?? 0) + 1);
        }
        const most = Math.max(...count.values());
        if (count.get(label[v]) === most) continue;
        const best = [...count.keys()].filter((l) => count.get(l) === most).sort((a, b) => a - b);
        label[v] = best[Math.floor(ops.rnd() * best.length)];
        ops.group(v, label[v]);
        changed++;
      }
      ops.round();
      yield;
      if (!changed) { converged = true; break; }
    }
    return { label, rounds, converged };
  },
  report(r) {
    return [{ label: 'Settled', value: r.converged ? `after ${r.rounds} rounds` : `not within ${r.rounds} rounds` }];
  },
};
