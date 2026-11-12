import type { GraphKernel } from '../../engines/graph/trace';

export interface LayoutResult { x: number[]; y: number[]; swing: number[] }

// ForceAtlas2 (Jacomy et al., 2014), with exact all-pairs repulsion in place of the Barnes-Hut
// approximation. Repulsion kr (deg u + 1)(deg v + 1) / d between every pair, attraction d along
// each edge, gravity kg (deg + 1) towards the centre. Each vertex's speed adapts to its swing
// (how much its force changed direction) against the graph's global traction, so oscillating
// vertices slow down and steady ones speed up.
export const kernel: GraphKernel<LayoutResult> = {
  goal: 'force-layout',
  inputs: ['communities', 'small-world', 'grid', 'geometric', 'random'],
  n: { min: 4, max: 100, value: 70 },
  params: [
    { kind: 'range', key: 'iterations', label: 'Iterations', min: 20, max: 500, step: 10, value: 250, rebuild: true },
    { kind: 'range', key: 'gravity', label: 'Gravity kg', min: 0.1, max: 5, step: 0.1, value: 1, rebuild: true },
  ],
  view: { truth: true },
  names: { value: 'Swing', total: 'Total swing' },
  readouts: ['rounds', 'places', 'total'],
  chart: { title: 'Total swing per iteration', x: 'rounds', y: 'swing', series: ['total'], log: true },
  *steps(ops, { p }) {
    const g = ops.g;
    const n = g.n;
    const iters = Number(p.iterations);
    const kg = Number(p.gravity);
    const kr = 2;
    const deg = new Array<number>(n).fill(0);
    for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
    const x: number[] = []; const y: number[] = [];
    for (let v = 0; v < n; v++) { x.push((ops.rnd() - 0.5) * 20); y.push((ops.rnd() - 0.5) * 20); ops.place(v, x[v], y[v]); }
    let fx = new Array<number>(n).fill(0); let fy = new Array<number>(n).fill(0);
    let px = fx.slice(); let py = fy.slice();
    let speed = 1;
    const swing = new Array<number>(n).fill(0);
    for (let it = 0; it < iters; it++) {
      fx = new Array<number>(n).fill(0); fy = new Array<number>(n).fill(0);
      for (let u = 0; u < n; u++) {
        for (let v = u + 1; v < n; v++) {
          let dx = x[u] - x[v]; let dy = y[u] - y[v];
          let d2 = dx * dx + dy * dy;
          if (d2 < 1e-9) { dx = 1e-3 * (u - v); dy = 1e-3; d2 = dx * dx + dy * dy; }
          const f = (kr * (deg[u] + 1) * (deg[v] + 1)) / d2; // kr (..)/d along the unit vector
          fx[u] += dx * f; fy[u] += dy * f; fx[v] -= dx * f; fy[v] -= dy * f;
        }
        const d = Math.hypot(x[u], y[u]) || 1;
        fx[u] -= (kg * (deg[u] + 1) * x[u]) / d; fy[u] -= (kg * (deg[u] + 1) * y[u]) / d;
      }
      for (let e = 0; e < g.m; e++) {
        ops.scan(e);
        const u = g.eu[e]; const v = g.ev[e];
        const dx = x[v] - x[u]; const dy = y[v] - y[u];
        fx[u] += dx; fy[u] += dy; fx[v] -= dx; fy[v] -= dy;
      }
      let gSwing = 0; let gTraction = 0;
      for (let v = 0; v < n; v++) {
        const sw = Math.hypot(fx[v] - px[v], fy[v] - py[v]);
        swing[v] = sw;
        gSwing += (deg[v] + 1) * sw;
        gTraction += (deg[v] + 1) * Math.hypot(fx[v] + px[v], fy[v] + py[v]) / 2;
      }
      // the global speed: tolerance 1, never more than half again the last speed
      const target = gSwing > 0 ? gTraction / gSwing : speed;
      speed = it === 0 ? Math.min(target, 1) : Math.min(target, 1.5 * speed);
      for (let v = 0; v < n; v++) {
        const local = (0.1 * speed) / (1 + speed * Math.sqrt(swing[v]));
        const f = Math.hypot(fx[v], fy[v]);
        const k = f > 0 ? Math.min(local, 10 / f) : 0;
        x[v] += fx[v] * k; y[v] += fy[v] * k;
        ops.place(v, x[v], y[v]);
        ops.value(v, swing[v]);
      }
      px = fx; py = fy;
      ops.round();
      // the iteration’s all-pairs repulsion, which records nothing
      yield (n * (n - 1)) / 2;
    }
    return { x, y, swing };
  },
  report(r, g) {
    let edge = 0;
    for (let e = 0; e < g.m; e++) edge += Math.hypot(r.x[g.eu[e]] - r.x[g.ev[e]], r.y[g.eu[e]] - r.y[g.ev[e]]);
    let all = 0; let pairs = 0;
    for (let u = 0; u < g.n; u++) for (let v = u + 1; v < g.n; v++) { all += Math.hypot(r.x[u] - r.x[v], r.y[u] - r.y[v]); pairs++; }
    return [{ label: 'Edge length / mean distance', value: g.m && pairs ? (edge / g.m / (all / pairs)).toFixed(3) : 'n/a' }];
  },
};
