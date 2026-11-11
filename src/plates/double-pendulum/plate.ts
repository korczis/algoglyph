import { paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { energy, rk4, type Pendulum, type State } from './dynamics';

export const doublePendulum: PlateCode = {
  id: 'double-pendulum',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 240,
  params: [
    { kind: 'range', key: 'count', label: 'Pendulums', min: 1, max: 240, step: 1, value: 120,
      rebuild: true },
    {
      kind: 'select', key: 'spread', label: 'Total offset', value: '1e-6', rebuild: true,
      options: ['1e-9', '1e-6', '1e-4', '1e-2'].map((v) => ({ value: v, label: `${v} rad` })),
    },
    { kind: 'range', key: 'theta', label: 'Release angle (°)', min: 30, max: 179, step: 1,
      value: 120, rebuild: true },
    { kind: 'range', key: 'dt', label: 'Step size (ms)', min: 0.5, max: 10, step: 0.5, value: 2 },
    { kind: 'range', key: 'substeps', label: 'Steps per frame', min: 1, max: 40, step: 1, value: 8 },
    { kind: 'range', key: 'g', label: 'Gravity (m/s²)', min: 1, max: 25, step: 0.1, value: 9.81 },
    { kind: 'toggle', key: 'trails', label: 'Trails', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let states: State[] = [];
    let t = 0;
    let e0 = 0;
    const k: Pendulum = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 };

    return {
      setup() {
        const n = num(params, 'count');
        const spread = Number(params.spread);
        const theta = (num(params, 'theta') * Math.PI) / 180;
        states = Array.from({ length: n }, (_, i): State => {
          const u = n === 1 ? 0 : i / (n - 1) - 0.5;
          return [theta, theta + u * spread, 0, 0];
        });
        k.g = num(params, 'g');
        e0 = energy(states[0], k);
        t = 0;
        p.background(...ctx.bg);
      },
      draw() {
        const g = num(params, 'g');
        if (g !== k.g) {
          k.g = g;
          e0 = energy(states[0], k);
        }
        const dt = num(params, 'dt') / 1000;
        const steps = num(params, 'substeps');
        for (let s = 0; s < steps; s++) {
          for (let i = 0; i < states.length; i++) states[i] = rk4(states[i], k, dt);
          t += dt;
        }

        const trails = bool(params, 'trails');
        if (trails) {
          p.noStroke();
          p.fill(ctx.bg[0], ctx.bg[1], ctx.bg[2], ctx.thumbnail ? 10 : 22);
          p.rect(0, 0, ctx.width, ctx.height);
        } else p.background(...ctx.bg);

        const pal = ctx.palette();
        const cx = ctx.width / 2;
        const cy = ctx.height * 0.42;
        const L = Math.min(ctx.width, ctx.height) * 0.27;
        const n = states.length;
        for (let i = 0; i < n; i++) {
          const [t1, t2] = states[i];
          const x1 = cx + Math.sin(t1) * L;
          const y1 = cy + Math.cos(t1) * L;
          const x2 = x1 + Math.sin(t2) * L;
          const y2 = y1 + Math.cos(t2) * L;
          const c = ramp(pal, n === 1 ? 0.7 : i / (n - 1));
          p.stroke(c[0], c[1], c[2], trails ? 70 : 140);
          p.strokeWeight(1);
          p.line(cx, cy, x1, y1);
          p.line(x1, y1, x2, y2);
          p.noStroke();
          p.fill(c[0], c[1], c[2], 220);
          p.circle(x2, y2, 3.2);
        }
        p.fill(...ctx.fg);
        p.circle(cx, cy, 5);

        let lo = Infinity;
        let hi = -Infinity;
        const ref = states[0][1];
        for (const s of states) {
          // angle relative to the first pendulum, wrapped to (−π, π]
          const a = Math.atan2(Math.sin(s[1] - ref), Math.cos(s[1] - ref));
          if (a < lo) lo = a;
          if (a > hi) hi = a;
        }
        const drift = e0 !== 0 ? Math.abs((energy(states[0], k) - e0) / e0) : 0;
        ctx.stats([
          { label: 'simulated time', value: `${t.toFixed(2)} s` },
          { label: 'lower-arm spread', value: `${(hi - lo).toExponential(2)} rad` },
          { label: 'energy drift (pendulum 1)', value: `${(drift * 100).toExponential(2)} %` },
          { label: 'integrator', value: `RK4, dt ${num(params, 'dt')} ms` },
        ]);
      },
    };
  },
};

export default doublePendulum;
