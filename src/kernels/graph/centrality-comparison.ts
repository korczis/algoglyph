import { other } from '../../engines/graph/graph';
import { V, type GraphKernel } from '../../engines/graph/trace';

export interface CentralityResult {
  degree: number[]; closeness: number[]; eigen: number[]; lambda: number; iterations: number; converged: boolean;
  /** The power iteration's round cap this run had. */
  cap: number;
}

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

/** The power iteration's default round cap; a vector still moving then is reported as stopped at it. */
export const POWER_ROUNDS = 300;

// Three passes, each leaving its scores on the vertices. Degree: incident edges. Closeness: a
// breadth-first search from each vertex, (r - 1) / (sum of hop distances) over the r vertices
// it reaches. Eigenvector: power iteration on A + I (the same eigenvectors as A, and it cannot
// oscillate on bipartite graphs) until no score moves by 1e-10 (or for at most `powerRounds` rounds, which the readouts then name), normalised to unit length.
export const kernel: GraphKernel<CentralityResult> = {
  goal: 'centrality',
  inputs: ['communities', 'small-world', 'geometric', 'grid'],
  n: { min: 4, max: 80, value: 50 },
  params: [
    // Starts at 150 for what the readout means: the eigenvalue it names is lambda_max to 1e-3 even
    // when the iteration stopped (its error is second order), and on every input at n 50 and
    // geometric at n 80 (seeds 4242 and 7) that takes up to 106 rounds; slower-mixing inputs need
    // more, and the readout then says the run stopped at the cap.
    // Ends at 850, before the budget does, because a longer run no longer fits the memory bound
    // of 300,000 recorded events (12 MB, test/kernels-graph.test.ts): a round at n 80 records
    // m + n + 1 events (221-310) on a base of 23,002-37,420, and runs need up to 2,526 rounds to
    // converge. Over every input at n 60, 70, 75, 78 and 80, seeds 1-100 (2,000 runs), the worst
    // run took 297,884 events at 850 and 313,234 at 900 (communities, n 80, seed 2, 11 runs past
    // the bound); the 600,000-event cap first truncates a run at 1,900 (1,850: 586,216).
    {
      kind: 'range', key: 'powerRounds', label: 'Power-iteration rounds at most', min: 150, max: 850, step: 50,
      value: POWER_ROUNDS, rebuild: true,
      hint: 'Ends at 850, where a run at n 80 still fits the 300,000 events a trace may hold: 297,884 at 850, 313,234 at 900.',
    },
  ],
  view: { colour: 'value', size: true },
  names: { frontier: 'In a search', done: 'Scored', value: 'Score' },
  readouts: ['rounds', 'scans', 'values', 'change'],
  chart: { title: 'Change per round (degree, closeness, then power iteration)', x: 'rounds', y: 'total change', series: ['change'], log: true },
  *steps(ops, { p }) {
    const g = ops.g;
    const n = g.n;
    // a run that passes no value takes the constant: the default run is the run before the control
    const cap = Number(p.powerRounds ?? POWER_ROUNDS);
    const degree = new Array<number>(n).fill(0);
    for (let v = 0; v < n; v++) {
      for (const e of g.out[v]) { ops.scan(e); degree[v]++; }
      ops.value(v, degree[v]);
    }
    ops.round();
    yield;
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
    yield;
    for (let v = 0; v < n; v++) ops.vertex(v, V.unseen);
    let x = new Array<number>(n).fill(1 / Math.sqrt(n));
    let lambda = 0; let iterations = 0; let converged = false;
    for (let it = 0; it < cap; it++) {
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
    return { degree, closeness, eigen: x, lambda, iterations, converged, cap };
  },
  report(r) {
    const top = (a: number[]) => a.reduce((b, x, i) => (x > a[b] ? i : b), 0);
    return [
      { label: 'Most central', value: `degree ${top(r.degree)}, closeness ${top(r.closeness)}, eigenvector ${top(r.eigen)}` },
      {
        label: 'Power iteration',
        value: `${r.converged ? `converged after ${r.iterations} rounds` : `stopped at the ${r.cap}-round cap`}, eigenvalue ${r.lambda.toFixed(3)}`,
      },
      { label: 'Rank agreement (Spearman)', value: `degree–closeness ${spearman(r.degree, r.closeness).toFixed(2)}, degree–eigenvector ${spearman(r.degree, r.eigen).toFixed(2)}` },
    ];
  },
};
