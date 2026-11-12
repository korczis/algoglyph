import type { GraphKernel } from '../../engines/graph/trace';

export interface GeoResult { x: number[]; y: number[]; offset: number }

// A spring layout (Fruchterman-Reingold forces: attraction d^2/L along edges, repulsion L^2/d
// between pairs, steps capped by a cooling temperature) plus a spring of strength `pull` from
// each vertex to its place on the map (the small squares). The layout starts on a circle; a
// strong pull pins vertices to the map, a weak one lets the graph's own structure bend it.
export const kernel: GraphKernel<GeoResult> = {
  goal: 'geo-layout',
  inputs: ['geometric', 'communities', 'grid'],
  n: { min: 4, max: 150, value: 60 },
  params: [{ kind: 'range', key: 'pull', label: 'Pull to the map', min: 0, max: 1, step: 0.05, value: 0.3, rebuild: true }],
  view: { anchors: true },
  names: { value: 'Distance from the map', total: 'Total distance from the map' },
  readouts: ['rounds', 'places', 'total'],
  chart: { title: 'Total distance from the map, iteration by iteration', x: 'rounds', y: 'distance', series: ['total'] },
  speed: 120,
  *steps(ops, { p }) {
    const g = ops.g;
    const n = g.n;
    const pull = Number(p.pull);
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
    const iters = 200;
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
      temp *= 0.98;
      ops.round();
      yield;
    }
    return { x, y, offset };
  },
  report(r, g) {
    return [{ label: 'Mean distance from the map', value: (r.offset / g.n).toPrecision(3) }];
  },
};
