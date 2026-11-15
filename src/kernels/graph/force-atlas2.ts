import { count } from '../../core/format';
import type { GraphKernel } from '../../engines/graph/trace';

export interface LayoutResult {
  x: number[]; y: number[]; swing: number[];
  /** The layout energy whose negative gradient is the force applied, before and after the run. */
  energy: [number, number];
  /** The virial ratio of the last positions: 1 at a fixed point, where sum x . F = 0. */
  balance: number;
}

/** An energy to six significant digits at least: digit groups for a large one. */
const energyText = (e: number) => (Math.abs(e) >= 1e5 ? count(Math.round(e)) : e.toPrecision(6));

// ForceAtlas2 (Jacomy et al., 2014), with exact all-pairs repulsion in place of the Barnes-Hut
// approximation. Repulsion kr (deg u + 1)(deg v + 1) / d between every pair, attraction d along
// each edge, gravity kg (deg + 1) towards the centre. Each vertex's speed adapts to its swing
// (how much its force changed direction) against the graph's global traction, so oscillating
// vertices slow down and steady ones speed up. The forces are minus the gradient of the energy
// E = sum over edges d^2/2 - kr sum over pairs (deg u + 1)(deg v + 1) ln d + kg sum (deg + 1)|x|,
// shown at the start and the end of the run. At a fixed point sum x . F = 0, so the work of
// attraction and gravity, sum over edges d^2 + kg sum (deg + 1)|x|, equals the repulsion's,
// kr sum over pairs (deg u + 1)(deg v + 1); their ratio is the force balance of the last positions.
export const kernel: GraphKernel<LayoutResult> = {
  goal: 'force-layout',
  inputs: ['communities', 'small-world', 'grid', 'geometric', 'random'],
  n: { min: 4, max: 100, value: 70 },
  params: [
    { kind: 'range', key: 'iterations', label: 'Iterations', min: 20, max: 500, step: 10, value: 250, rebuild: true },
    { kind: 'range', key: 'gravity', label: 'Gravity kg', min: 0.1, max: 5, step: 0.1, value: 1, rebuild: true },
    // The repulsion's scaling ratio kr. It costs nothing: every iteration is the same all-pairs
    // pass whatever kr is. Starts at 0.1, as gravity does: at 0 no pair repels, the layout falls
    // into the centre and the force balance divides by zero. Ends at 10 for what the run shows: a
    // larger kr pushes vertices apart at the step cap (10 units an iteration) for longer, and at
    // the default 250 iterations (every input at n 10, 70 and 100, seeds 4242, 7, 1 and 2; 60
    // runs per kr) no run ends with a vertex still moving at the cap up to kr 10, while 1 does at
    // 20, 5 at 30 and 20 at 100: the last positions then show the cap, not the forces' balance.
    {
      kind: 'range', key: 'scaling', label: 'Scaling kr', min: 0.1, max: 10, step: 0.1, value: 2, rebuild: true,
      hint: 'Ends at 10, where every run still settles: of 60 runs per kr at 250 iterations, none ends with a vertex at the step cap up to kr 10, 1 does at 20 and 20 at 100.',
    },
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
    // a run that passes no value takes the constant: the default run is the run before the control
    const kr = Number(p.scaling ?? 2);
    const deg = new Array<number>(n).fill(0);
    for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
    const x: number[] = []; const y: number[] = [];
    for (let v = 0; v < n; v++) { x.push((ops.rnd() - 0.5) * 20); y.push((ops.rnd() - 0.5) * 20); ops.place(v, x[v], y[v]); }
    // the energy of the positions as they stand: the pairs' logarithms cost as one iteration does
    const energy = () => {
      let e = 0;
      for (let i = 0; i < g.m; i++) {
        const dx = x[g.eu[i]] - x[g.ev[i]]; const dy = y[g.eu[i]] - y[g.ev[i]];
        e += (dx * dx + dy * dy) / 2;
      }
      for (let u = 0; u < n; u++) {
        for (let v = u + 1; v < n; v++) e -= kr * (deg[u] + 1) * (deg[v] + 1) * Math.log(Math.hypot(x[u] - x[v], y[u] - y[v]));
        e += kg * (deg[u] + 1) * Math.hypot(x[u], y[u]);
      }
      return e;
    };
    const before = energy();
    yield (n * (n - 1)) / 2;
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
    const after = energy();
    yield (n * (n - 1)) / 2;
    let held = 0; let mass = 0; let squares = 0;
    for (let e = 0; e < g.m; e++) held += (x[g.eu[e]] - x[g.ev[e]]) ** 2 + (y[g.eu[e]] - y[g.ev[e]]) ** 2;
    for (let v = 0; v < n; v++) {
      held += kg * (deg[v] + 1) * Math.hypot(x[v], y[v]);
      mass += deg[v] + 1; squares += (deg[v] + 1) ** 2;
    }
    // sum over pairs of m_u m_v, from the sums of m and of m^2
    const balance = held / ((kr * (mass * mass - squares)) / 2);
    return { x, y, swing, energy: [before, after], balance };
  },
  report(r, g) {
    let edge = 0;
    for (let e = 0; e < g.m; e++) edge += Math.hypot(r.x[g.eu[e]] - r.x[g.ev[e]], r.y[g.eu[e]] - r.y[g.ev[e]]);
    let all = 0; let pairs = 0;
    for (let u = 0; u < g.n; u++) for (let v = u + 1; v < g.n; v++) { all += Math.hypot(r.x[u] - r.x[v], r.y[u] - r.y[v]); pairs++; }
    return [
      { label: 'Edge length / mean distance', value: g.m && pairs ? (edge / g.m / (all / pairs)).toFixed(3) : 'n/a' },
      { label: 'Layout energy', value: `${energyText(r.energy[0])} at the start, ${energyText(r.energy[1])} at the end` },
      { label: 'Force balance', value: r.balance.toFixed(4) },
    ];
  },
};
