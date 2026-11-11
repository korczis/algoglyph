import { other } from '../../engines/graph/graph';
import { V, type GraphKernel } from '../../engines/graph/trace';

export interface CentralityResult { degree: number[]; closeness: number[]; eigen: number[]; lambda: number; iterations: number; converged: boolean }

/** Spearman's rank correlation of two score lists (ties take their mean rank). */
export function spearman(a: number[], b: number[]): number {
  const rank = (x: number[]) => {
    const idx = x.map((_, i) => i).sort((i, j) => x[i] - x[j]);
    const r = new Array<number>(x.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
      for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a); const rb = rank(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n; const mb = rb.reduce((s, x) => s + x, 0) / n;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < n; i++) { sab += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
}

// Three passes, each leaving its scores on the vertices. Degree: incident edges. Closeness: a
// breadth-first search from each vertex, (r - 1) / (sum of hop distances) over the r vertices
// it reaches. Eigenvector: power iteration on A + I (the same eigenvectors as A, and it cannot
// oscillate on bipartite graphs) until no score moves by 1e-10 (or for at most 300 rounds, which the readouts then say), normalised to unit length.
export const kernel: GraphKernel<CentralityResult> = {
  goal: 'centrality',
  inputs: ['communities', 'small-world', 'geometric', 'grid'],
  n: { min: 4, max: 80, value: 50 },
  view: { colour: 'value', size: true },
  names: { frontier: 'In a search', done: 'Scored', value: 'Score' },
  readouts: ['rounds', 'scans', 'values', 'change'],
  chart: { title: 'Change per round (degree, closeness, then power iteration)', x: 'rounds', y: 'total change', series: ['change'], log: true },
  speed: 600,
  *steps(ops) {
    const g = ops.g;
    const n = g.n;
    const degree = new Array<number>(n).fill(0);
    for (let v = 0; v < n; v++) {
      for (const e of g.out[v]) { ops.scan(e); degree[v]++; }
      ops.value(v, degree[v]);
    }
    ops.round();
    const closeness = new Array<number>(n).fill(0);
    for (let s = 0; s < n; s++) {
      const dist = new Array<number>(n).fill(-1);
      dist[s] = 0;
      const queue = [s];
      let sum = 0;
      for (let h = 0; h < queue.length; h++) {
        const u = queue[h];
        for (const e of g.out[u]) {
          ops.scan(e);
          const w = other(g, e, u);
          if (dist[w] < 0) { dist[w] = dist[u] + 1; sum += dist[w]; queue.push(w); }
        }
      }
      closeness[s] = sum ? (queue.length - 1) / sum : 0;
      ops.value(s, closeness[s]);
      ops.settle(s);
      yield;
    }
    ops.round();
    for (let v = 0; v < n; v++) ops.vertex(v, V.unseen);
    let x = new Array<number>(n).fill(1 / Math.sqrt(n));
    let lambda = 0; let iterations = 0; let converged = false;
    for (let it = 0; it < 300; it++) {
      iterations = it + 1;
      const y = x.slice();
      for (let e = 0; e < g.m; e++) {
        ops.scan(e);
        y[g.eu[e]] += x[g.ev[e]];
        y[g.ev[e]] += x[g.eu[e]];
      }
      const norm = Math.sqrt(y.reduce((s, q) => s + q * q, 0)) || 1;
      lambda = norm - 1;
      let moved = 0;
      for (let v = 0; v < n; v++) { y[v] /= norm; moved = Math.max(moved, Math.abs(y[v] - x[v])); ops.value(v, y[v]); }
      x = y;
      ops.round();
      yield;
      if (moved < 1e-10) { converged = true; break; }
    }
    return { degree, closeness, eigen: x, lambda, iterations, converged };
  },
  report(r) {
    const top = (a: number[]) => a.reduce((b, x, i) => (x > a[b] ? i : b), 0);
    return [
      { label: 'Most central', value: `degree ${top(r.degree)}, closeness ${top(r.closeness)}, eigenvector ${top(r.eigen)}` },
      { label: 'Power iteration', value: `${r.converged ? 'converged' : 'stopped'} after ${r.iterations} rounds, eigenvalue ${r.lambda.toFixed(3)}` },
      { label: 'Rank agreement (Spearman)', value: `degree–closeness ${spearman(r.degree, r.closeness).toFixed(2)}, degree–eigenvector ${spearman(r.degree, r.eigen).toFixed(2)}` },
    ];
  },
};
