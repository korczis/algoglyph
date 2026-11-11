import { V, type GraphKernel } from '../../engines/graph/trace';
import { arcs, minCut, value, type FlowResult } from './_flow';
import { FLOW_VIEW } from './_maxflow';

// Generic push-relabel with a FIFO queue of active vertices. The source starts at height V and
// saturates its edges; an active vertex (excess > 0) pushes along residual arcs to a vertex one
// step lower, and is lifted to one above its lowest residual neighbour when it cannot. Excess
// that cannot reach the sink climbs back over the source's height and returns to it.
export const kernel: GraphKernel<FlowResult> = {
  goal: 'maxflow',
  ...FLOW_VIEW,
  view: { flow: true, colour: 'value' },
  names: { frontier: 'Active (excess)', done: 'Source side of the cut', value: 'Height' },
  readouts: ['flow', 'frontier', 'values', 'flows', 'scans'],
  chart: { title: 'Active vertices', y: 'vertices', series: ['frontier'] },
  speed: 16,
  run(ops, { s, t }) {
    const g = ops.g;
    const f = new Array<number>(g.m).fill(0);
    const h = new Array<number>(g.n).fill(0);
    const ex = new Array<number>(g.n).fill(0);
    const active: number[] = [];
    const activate = (v: number) => {
      if (v === s || v === t || ex[v] <= 0 || active.includes(v)) return;
      active.push(v);
      ops.discover(v);
    };
    h[s] = g.n;
    for (let v = 0; v < g.n; v++) ops.value(v, h[v]);
    for (const e of g.out[s]) {
      ops.scan(e);
      f[e] = g.cap[e];
      ops.flow(e, f[e]);
      ex[g.ev[e]] += f[e]; ex[s] -= f[e];
      activate(g.ev[e]);
    }
    while (active.length) {
      const u = active.shift() as number;
      while (ex[u] > 0) {
        // discharge: push along every admissible arc (one step downhill); whatever arcs remain
        // after a full scan are not admissible, so lift u just above the lowest of them
        let lowest = Infinity;
        for (const a of arcs(ops, f, u)) {
          ops.scan(a.e);
          if (h[u] !== h[a.to] + 1) { lowest = Math.min(lowest, h[a.to]); continue; }
          const d = Math.min(ex[u], a.room);
          f[a.e] += a.fwd ? d : -d;
          ops.flow(a.e, f[a.e]);
          ex[u] -= d; ex[a.to] += d;
          activate(a.to);
          if (!ex[u]) break;
        }
        if (ex[u] > 0) {
          h[u] = lowest + 1;
          ops.value(u, h[u]);
        }
      }
      ops.vertex(u, V.unseen);
      ops.round();
    }
    const side = minCut(ops, f, s);
    for (let v = 0; v < g.n; v++) if (side[v]) ops.vertex(v, V.done);
    return { flow: f, value: value(ops, f, s), side };
  },
};
