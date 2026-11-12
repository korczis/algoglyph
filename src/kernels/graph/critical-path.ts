import { E, V, type GraphKernel } from '../../engines/graph/trace';

export interface CpmResult { es: number[]; lf: number[]; slack: number[]; length: number; order: number[] }

// The critical path method on a task graph (each vertex a task with a duration, each edge a
// dependency). A forward pass in topological order gives every task its earliest start, the
// latest finish of its predecessors; the project takes as long as the latest finish. A backward
// pass gives every task its latest finish, the earliest latest start of its successors. Slack is
// the difference; the tasks with none form the critical path.
export const kernel: GraphKernel<CpmResult> = {
  goal: 'cpm',
  inputs: ['dag'],
  n: { min: 3, max: 300, value: 40 },
  view: { colour: 'value' },
  names: { frontier: 'Forward pass done', done: 'Both passes done', marked: 'Critical (no slack)', tree: 'Critical edges', value: 'Earliest start, then slack' },
  readouts: ['scans', 'frontier', 'done', 'marked'],
  chart: { title: 'Forward, then backward pass', y: 'tasks', series: ['frontier', 'done', 'marked'] },
  *steps(ops) {
    const g = ops.g;
    const n = g.n;
    const indeg = new Array<number>(n).fill(0);
    for (let e = 0; e < g.m; e++) { ops.scan(e); indeg[g.ev[e]]++; }
    const order: number[] = [];
    for (let v = 0; v < n; v++) if (!indeg[v]) order.push(v);
    const es = new Array<number>(n).fill(0);
    for (let h = 0; h < order.length; h++) {
      const u = order[h];
      ops.value(u, es[u]);
      ops.discover(u);
      for (const e of g.out[u]) {
        ops.scan(e);
        const v = g.ev[e];
        es[v] = Math.max(es[v], es[u] + g.vw[u]);
        if (--indeg[v] === 0) order.push(v);
      }
    }
    let length = 0;
    for (let v = 0; v < n; v++) length = Math.max(length, es[v] + g.vw[v]);
    const lf = new Array<number>(n).fill(length);
    const slack = new Array<number>(n).fill(0);
    for (let h = order.length - 1; h >= 0; h--) {
      const u = order[h];
      for (const e of g.out[u]) { ops.scan(e); lf[u] = Math.min(lf[u], lf[g.ev[e]] - g.vw[g.ev[e]]); }
      slack[u] = lf[u] - g.vw[u] - es[u];
      ops.value(u, slack[u]);
      ops.settle(u);
      yield;
    }
    for (let v = 0; v < n; v++) if (slack[v] === 0) ops.vertex(v, V.mark);
    for (let e = 0; e < g.m; e++) {
      const u = g.eu[e]; const v = g.ev[e];
      if (!slack[u] && !slack[v] && es[u] + g.vw[u] === es[v]) ops.edge(e, E.mark);
    }
    return { es, lf, slack, length, order };
  },
  report(r) {
    return [
      { label: 'Project length', value: String(r.length) },
      { label: 'Critical tasks', value: `${r.slack.filter((x) => x === 0).length} of ${r.slack.length}` },
    ];
  },
};
