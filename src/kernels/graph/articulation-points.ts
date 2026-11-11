import { V, type GraphKernel } from '../../engines/graph/trace';
import { lowLink } from './_lowlink';

export interface ArticulationResult { cut: boolean[]; block: number[] }

// One DFS with low points. A non-root vertex u separates its child v's subtree when no back
// edge from that subtree climbs above u (low[v] >= disc[u]); a root separates when it has two
// tree children. The edges stacked since the tree edge (u, v) then form one biconnected block.
export const kernel: GraphKernel<ArticulationResult> = {
  goal: 'articulation',
  inputs: ['geometric', 'small-world', 'random', 'islands'],
  n: { min: 6, max: 300, value: 70 },
  pick: 's',
  endpoints: 's',
  names: { frontier: 'On the stack', done: 'Finished', marked: 'Articulation points', tree: 'DFS tree edges', value: 'Low point' },
  readouts: ['scans', 'done', 'marked', 'tree'],
  chart: { title: 'Depth of the stack', y: 'vertices', series: ['frontier', 'done'] },
  speed: 3,
  run(ops, { s }) {
    const g = ops.g;
    const cut = new Array<boolean>(g.n).fill(false);
    const block = new Array<number>(g.m).fill(-1);
    const stacked: number[] = [];
    let blocks = 0;
    const ll = lowLink(ops, s, {
      edge: (e) => { stacked.push(e); },
      child: (u, v, e, l) => {
        if (l.low[v] < l.disc[u]) return;
        if (!l.isRoot[u]) cut[u] = true;
        for (;;) {
          const f = stacked.pop() as number;
          block[f] = blocks;
          if (f === e) break;
        }
        blocks++;
      },
    });
    for (let v = 0; v < g.n; v++) if (ll.isRoot[v] && ll.children[v] >= 2) cut[v] = true;
    for (let v = 0; v < g.n; v++) if (cut[v]) ops.vertex(v, V.mark);
    return { cut, block };
  },
  report(r) {
    return [
      { label: 'Articulation points', value: String(r.cut.filter(Boolean).length) },
      { label: 'Biconnected blocks', value: String(new Set(r.block.filter((b) => b >= 0)).size) },
    ];
  },
};
