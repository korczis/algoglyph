import type { GraphKernel } from '../../engines/graph/trace';

export interface GeoResult {
  x: number[]; y: number[]; offset: number;
  /** The virial ratio of the last positions: 1 at a fixed point, where sum (x - mean) . F = 0. */
  balance: number;
}

// A spring layout (Fruchterman-Reingold forces: attraction d^2/L along edges, repulsion L^2/d
// between pairs, steps capped by a cooling temperature) plus a spring of strength `pull` from
// each vertex to its place on the map (the small squares). The layout starts on a circle; a
// strong pull pins vertices to the map, a weak one lets the graph's own structure bend it. At a
// fixed point sum (x - mean x) . F = 0: the pairs' L^2 each balance the edges' d^3/L less the map
// springs' k (a - x) . (x - mean x), and their ratio is the force balance of the last positions.
export const kernel: GraphKernel<GeoResult> = {
  goal: 'geo-layout',
  inputs: ['geometric', 'communities', 'grid'],
  n: { min: 4, max: 150, value: 60 },
  params: [
    { kind: 'range', key: 'pull', label: 'Pull to the map', min: 0, max: 1, step: 0.05, value: 0.3, rebuild: true },
    // Ends at 410, before the budget does, because a longer run no longer fits the memory bound
    // of 300,000 recorded events (12 MB, test/kernels-graph.test.ts): an iteration records a place
    // and a value for every vertex, a scan for every edge and a round, 2n + m + 1 events on the n
    // places of the starting circle. At n 150 the most edges of seeds 1-300 on every input is 413
    // (communities, seed 137): 292,890 events at 410 and 300,030 at 420. A frame does one
    // iteration at n 150 whatever the count (its all-pairs repulsion outweighs FRAME_UNITS).
    {
      kind: 'range', key: 'iterations', label: 'Iterations', min: 20, max: 410, step: 10, value: 200, rebuild: true,
      hint: 'Ends at 410, where a run at n 150 still fits the 300,000 events a trace may hold: 292,890 at 410, 300,030 at 420.',
    },
    // The temperature (the longest step a vertex may take) is multiplied by this after each
    // iteration; the cost does not change. Both ends are the ends of what cooling means: at 0 the
    // vertices take one step and freeze, at 1 the temperature never falls, and above 1 the steps
    // would grow.
    { kind: 'range', key: 'cooling', label: 'Cooling per iteration', min: 0, max: 1, step: 0.01, value: 0.98, rebuild: true },
  ],
  view: { anchors: true },
  names: { value: 'Distance from the map', total: 'Total distance from the map' },
  readouts: ['rounds', 'places', 'total'],
  chart: { title: 'Total distance from the map, iteration by iteration', x: 'rounds', y: 'distance', series: ['total'] },
  *steps(ops, { p }) {
    const g = ops.g;
    const n = g.n;
    const pull = Number(p.pull);
    // a run that passes no value takes the constants: the default run is the run before the controls
    const iters = Number(p.iterations ?? 200);
    const cooling = Number(p.cooling ?? 0.98);
    let cx = 0; let cy = 0;
    for (let v = 0; v < n; v++) { cx += g.x[v] / n; cy += g.y[v] / n; }
    let span = 0;
    for (let v = 0; v < n; v++) span = Math.max(span, Math.hypot(g.x[v] - cx, g.y[v] - cy));
    const L = Math.sqrt((Math.PI * span * span) / n);
    const x: number[] = []; const y: number[] = [];
    for (let v = 0; v < n; v++) {
      const a = (2 * Math.PI * v) / n;
      x.push(cx + span * Math.cos(a)); y.push(cy + span * Math.sin(a));
      ops.place(v, x[v], y[v]);
    }
    let temp = span / 4;
    let offset = 0;
    for (let it = 0; it < iters; it++) {
      const fx = new Array<number>(n).fill(0); const fy = new Array<number>(n).fill(0);
      for (let u = 0; u < n; u++) {
        for (let v = u + 1; v < n; v++) {
          const dx = x[u] - x[v]; const dy = y[u] - y[v];
          const d = Math.max(1e-6, Math.hypot(dx, dy));
          const f = (L * L) / d / d;
          fx[u] += dx * f; fy[u] += dy * f; fx[v] -= dx * f; fy[v] -= dy * f;
        }
      }
      for (let e = 0; e < g.m; e++) {
        ops.scan(e);
        const u = g.eu[e]; const v = g.ev[e];
        const dx = x[v] - x[u]; const dy = y[v] - y[u];
        const d = Math.hypot(dx, dy);
        const f = d / L;
        fx[u] += dx * f; fy[u] += dy * f; fx[v] -= dx * f; fy[v] -= dy * f;
      }
      offset = 0;
      for (let v = 0; v < n; v++) {
        // the map spring, scaled so that pull 1 outweighs the graph's own forces
        fx[v] += (pull * 4 * (g.x[v] - x[v]) * n) / Math.max(1, Math.sqrt(n)) / L;
        fy[v] += (pull * 4 * (g.y[v] - y[v]) * n) / Math.max(1, Math.sqrt(n)) / L;
        const f = Math.hypot(fx[v], fy[v]);
        if (f > 0) { const step = Math.min(f, temp) / f; x[v] += fx[v] * step; y[v] += fy[v] * step; }
        ops.place(v, x[v], y[v]);
        const off = Math.hypot(x[v] - g.x[v], y[v] - g.y[v]);
        offset += off;
        ops.value(v, off);
      }
      temp *= cooling;
      ops.round();
      // the iteration’s all-pairs repulsion, which records nothing
      yield (n * (n - 1)) / 2;
    }
    const k = (pull * 4 * n) / Math.max(1, Math.sqrt(n)) / L;
    let mx = 0; let my = 0;
    for (let v = 0; v < n; v++) { mx += x[v] / n; my += y[v] / n; }
    let held = 0;
    for (let e = 0; e < g.m; e++) held += Math.hypot(x[g.eu[e]] - x[g.ev[e]], y[g.eu[e]] - y[g.ev[e]]) ** 3 / L;
    for (let v = 0; v < n; v++) held -= k * ((g.x[v] - x[v]) * (x[v] - mx) + (g.y[v] - y[v]) * (y[v] - my));
    return { x, y, offset, balance: held / ((L * L * n * (n - 1)) / 2) };
  },
  report(r, g) {
    return [
      { label: 'Mean distance from the map', value: (r.offset / g.n).toPrecision(3) },
      { label: 'Force balance', value: r.balance.toFixed(4) },
    ];
  },
};
