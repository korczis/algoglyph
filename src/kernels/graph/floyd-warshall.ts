import { V, type GraphKernel } from '../../engines/graph/trace';

export interface ApspResult { dist: Float64Array; negative: boolean }

// The distance matrix starts from the edges; round k lets every path pass through vertex k,
// so d[i][j] = min(d[i][j], d[i][k] + d[k][j]). A negative diagonal entry at the end means a
// negative cycle.
export const kernel: GraphKernel<ApspResult> = {
  goal: 'apsp',
  inputs: ['digraph', 'geometric', 'dag', 'signed', 'signed-dag'],
  n: { min: 3, max: 60, value: 22 },
  view: { matrix: 'distance' },
  names: { frontier: 'Intermediate vertex', done: 'Used as intermediate', marked: 'On a negative cycle' },
  readouts: ['cells', 'rounds', 'done'],
  chart: { title: 'Finite entries of the distance matrix', x: 'rounds', y: 'pairs', series: ['cells'] },
  speed: 4,
  run(ops) {
    const g = ops.g;
    const n = g.n;
    const d = new Float64Array(n * n).fill(Infinity);
    const set = (i: number, j: number, x: number) => { d[i * n + j] = x; ops.cell(i, j, x); };
    for (let v = 0; v < n; v++) set(v, v, 0);
    for (let e = 0; e < g.m; e++) {
      ops.scan(e);
      const u = g.eu[e]; const v = g.ev[e]; const w = g.w[e];
      if (w < d[u * n + v]) set(u, v, w);
      if (!g.directed && w < d[v * n + u]) set(v, u, w);
    }
    ops.round();
    for (let k = 0; k < n; k++) {
      ops.discover(k);
      for (let i = 0; i < n; i++) {
        const dik = d[i * n + k];
        if (!Number.isFinite(dik)) continue;
        for (let j = 0; j < n; j++) {
          const x = dik + d[k * n + j];
          if (x < d[i * n + j]) set(i, j, x);
        }
      }
      ops.settle(k);
      ops.round();
    }
    let negative = false;
    for (let v = 0; v < n; v++) if (d[v * n + v] < 0) { negative = true; ops.vertex(v, V.mark); }
    return { dist: d, negative };
  },
  report(r, g) {
    let fin = 0;
    for (const x of r.dist) if (Number.isFinite(x)) fin++;
    return [
      { label: 'Finite distances', value: `${fin} of ${g.n * g.n} pairs` },
      { label: 'Negative cycle', value: r.negative ? 'yes' : 'none' },
    ];
  },
};
