import { other } from '../../engines/graph/graph';
import { E, V, type GraphKernel } from '../../engines/graph/trace';

export interface EgoResult { hop: number[] }

// A breadth-first search from the subject that stops after k levels: ring by ring, the vertices
// within k hops and the edges among them. Everything farther stays dimmed.
export const kernel: GraphKernel<EgoResult> = {
  goal: 'ego',
  inputs: ['communities', 'small-world', 'geometric', 'random'],
  n: { min: 4, max: 300, value: 90 },
  params: [{ kind: 'range', key: 'k', label: 'Hops k', min: 1, max: 6, step: 1, value: 2, rebuild: true }],
  pick: 's',
  endpoints: 's',
  view: { colour: 'group' },
  names: { frontier: 'Newest ring', done: 'Expanded', groups: 'Rings', tree: 'Discovery edges' },
  readouts: ['scans', 'done', 'frontier', 'rounds'],
  chart: { title: 'Vertices revealed, ring by ring', x: 'rounds', y: 'vertices', series: ['done', 'frontier'] },
  *steps(ops, { s, p }) {
    const g = ops.g;
    const k = Number(p.k);
    const hop = new Array<number>(g.n).fill(-1);
    hop[s] = 0;
    ops.group(s, 0);
    ops.discover(s);
    let ring = [s];
    for (let d = 0; d < k && ring.length; d++) {
      const next: number[] = [];
      for (const u of ring) {
        ops.settle(u);
        yield;
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = other(g, e, u);
          if (hop[v] >= 0) continue;
          hop[v] = d + 1;
          ops.group(v, d + 1);
          ops.parent(v, e);
          ops.discover(v);
          next.push(v);
        }
      }
      ring = next;
      ops.round();
      yield;
    }
    for (let v = 0; v < g.n; v++) if (hop[v] < 0) ops.vertex(v, V.dim);
    for (let e = 0; e < g.m; e++) if (hop[g.eu[e]] < 0 || hop[g.ev[e]] < 0) ops.edge(e, E.drop);
    return { hop };
  },
  report(r) {
    const per = new Map<number, number>();
    for (const h of r.hop) if (h >= 0) per.set(h, (per.get(h) ?? 0) + 1);
    return [{ label: 'Ring sizes', value: [...per.keys()].sort((a, b) => a - b).map((h) => per.get(h)).join(', ') }];
  },
};
