import { E, type GraphKernel } from '../../engines/graph/trace';
import { dijkstra, pathTo } from './_dijkstra';

export interface CredibleResult { dist: number[]; path: number[] | null; edges: number[]; confidence: number }

/** The cost of an edge of confidence c under the chosen rule. */
export function credibleCost(c: number, rule: string): number {
  return rule === 'log' ? -Math.log(c) : 1 - c;
}

// Each link carries a confidence c in (0, 1). Dijkstra runs from the source to the target over
// costs of 1 - c (the default: doubt adds up along the chain) or -ln c (minimising it
// maximises the product of the confidences, the probability that every link holds).
export const kernel: GraphKernel<CredibleResult> = {
  goal: 'credible',
  inputs: ['links'],
  n: { min: 4, max: 300, value: 90 },
  params: [{
    kind: 'select', key: 'cost', label: 'Edge cost', value: 'doubt', rebuild: true,
    options: [{ value: 'doubt', label: '1 − confidence' }, { value: 'log', label: '−ln confidence (product)' }],
  }],
  pick: 's',
  endpoints: 'st',
  view: { colour: 'value' },
  names: { frontier: 'In the queue', done: 'Settled', tree: 'Best links so far', value: 'Cost' },
  readouts: ['scans', 'relaxations', 'done', 'frontier'],
  chart: { title: 'Settled vertices and the queue', y: 'vertices', series: ['done', 'frontier'] },
  speed: 3,
  run(ops, { s, t, p }) {
    const g = ops.g;
    const rule = String(p.cost);
    const { dist, parentEdge } = dijkstra(ops, s, (e) => credibleCost(g.w[e], rule), { target: t });
    const path = pathTo(g, parentEdge, s, t);
    let confidence = 0;
    if (path) {
      confidence = 1;
      for (const e of path.edges) { confidence *= g.w[e]; ops.edge(e, E.mark); }
    }
    return { dist, path: path?.verts ?? null, edges: path?.edges ?? [], confidence };
  },
  report(r) {
    if (!r.path) return [{ label: 'Path', value: 'target not reachable' }];
    return [
      { label: 'Best path', value: `${r.edges.length} links` },
      { label: 'Product of confidences', value: r.confidence.toPrecision(3) },
    ];
  },
};
