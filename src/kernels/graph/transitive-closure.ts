import type { GraphKernel } from '../../engines/graph/trace';

export interface ClosureResult { reach: Uint8Array }

// Warshall's algorithm on the reachability matrix (every vertex reaches itself): after round k,
// i reaches j through intermediate vertices 0..k only. Row i gains row k whenever i reaches k.
export const kernel: GraphKernel<ClosureResult> = {
  goal: 'closure',
  inputs: ['digraph', 'dag', 'ownership'],
  n: { min: 4, max: 64, value: 24 },
  view: { matrix: 'boolean' },
  names: { frontier: 'Intermediate vertex', done: 'Used as intermediate' },
  readouts: ['cells', 'rounds', 'done'],
  chart: { title: 'Pairs known to be reachable', x: 'rounds', y: 'pairs', series: ['cells'] },
  speed: 4,
  *steps(ops) {
    const g = ops.g;
    const n = g.n;
    const reach = new Uint8Array(n * n);
    const set = (i: number, j: number) => {
      if (reach[i * n + j]) return;
      reach[i * n + j] = 1;
      ops.cell(i, j, 1);
    };
    for (let v = 0; v < n; v++) set(v, v);
    for (let e = 0; e < g.m; e++) { ops.scan(e); set(g.eu[e], g.ev[e]); }
    ops.round();
    yield;
    for (let k = 0; k < n; k++) {
      ops.discover(k);
      for (let i = 0; i < n; i++) {
        if (!reach[i * n + k]) continue;
        for (let j = 0; j < n; j++) if (reach[k * n + j]) set(i, j);
      }
      ops.settle(k);
      yield;
      ops.round();
      yield;
    }
    return { reach };
  },
  report(r, g) {
    let pairs = 0;
    for (const x of r.reach) pairs += x;
    return [{ label: 'Reachable pairs', value: `${pairs} of ${g.n * g.n}` }];
  },
};
