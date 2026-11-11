import { paletteParam, ramp } from '../../core/palette';
import { bool, num, type Plate } from '../../core/plate';

type V3 = [number, number, number];

export function lorenz([x, y, z]: V3, sigma: number, rho: number, beta: number): V3 {
  return [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
}

export function rk4Lorenz(s: V3, dt: number, sigma: number, rho: number, beta: number): V3 {
  const f = (v: V3) => lorenz(v, sigma, rho, beta);
  const add = (a: V3, b: V3, h: number): V3 => [a[0] + b[0] * h, a[1] + b[1] * h, a[2] + b[2] * h];
  const k1 = f(s);
  const k2 = f(add(s, k1, dt / 2));
  const k3 = f(add(s, k2, dt / 2));
  const k4 = f(add(s, k3, dt));
  return [0, 1, 2].map((i) => s[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as V3;
}

export const lorenzAttractor: Plate = {
  id: 'lorenz-attractor',
  title: 'Lorenz Butterfly',
  category: 'physics',
  mode: 'webgl',
  aspect: 16 / 10,
  summary: 'A swarm of tracers on the Lorenz system, released a hair apart, smearing across '
    + 'both wings of the strange attractor. Drag to orbit, scroll to zoom.',
  notes: [
    'Edward Lorenz\'s 1963 three-variable model of convection: dx/dt = σ(y − x), '
      + 'dy/dt = x(ρ − z) − y, dz/dt = xy − βz. With σ = 10, β = 8/3 and ρ = 28 the orbits '
      + 'never settle and never repeat, wrapping round two unstable fixed points.',
    'All tracers start within 10⁻⁴ of each other and are integrated with RK4. The readout '
      + 'measures how far apart the swarm has drifted: a few orbits are enough to lose every '
      + 'trace of the shared start.',
    'Lower ρ below about 24.74 and the wings become stable fixed points; the swarm spirals in '
      + 'and stops. Colour is speed along the trail.',
  ],
  complexity: 'RK4, O(tracers × trail)',
  tags: ['chaos', 'strange attractor', '3D'],
  interaction: 'Drag to orbit, scroll to zoom.',
  thumbnailFrames: 260,
  params: [
    { kind: 'range', key: 'tracers', label: 'Tracers', min: 1, max: 48, step: 1, value: 16,
      rebuild: true },
    { kind: 'range', key: 'trail', label: 'Trail length', min: 100, max: 2400, step: 50,
      value: 900, rebuild: true },
    { kind: 'range', key: 'sigma', label: 'σ', min: 1, max: 20, step: 0.1, value: 10 },
    { kind: 'range', key: 'rho', label: 'ρ', min: 10, max: 60, step: 0.1, value: 28 },
    { kind: 'range', key: 'beta', label: 'β', min: 0.5, max: 5, step: 0.01, value: 2.67 },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 12, step: 1, value: 3 },
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let trails: V3[][] = [];
    let heads: V3[] = [];
    let angle = 0;
    let steps = 0;
    const dt = 0.006;

    return {
      setup() {
        const n = num(params, 'tracers');
        heads = Array.from({ length: n }, (): V3 => [
          1 + (ctx.rnd() - 0.5) * 1e-4, 1 + (ctx.rnd() - 0.5) * 1e-4, 20 + (ctx.rnd() - 0.5) * 1e-4,
        ]);
        trails = heads.map(() => []);
        steps = 0;
        angle = ctx.rnd() * Math.PI * 2;
      },
      draw() {
        const sigma = num(params, 'sigma');
        const rho = num(params, 'rho');
        const beta = num(params, 'beta');
        const max = num(params, 'trail');
        const n = num(params, 'speed');
        for (let s = 0; s < n; s++) {
          for (let i = 0; i < heads.length; i++) {
            heads[i] = rk4Lorenz(heads[i], dt, sigma, rho, beta);
            trails[i].push(heads[i]);
            if (trails[i].length > max) trails[i].shift();
          }
          steps++;
        }

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        if (bool(params, 'spin')) angle += 0.0025;
        const k = Math.min(ctx.width, ctx.height) / 62;
        p.rotateX(-0.35);
        p.rotateY(angle);
        p.scale(k);
        const pal = ctx.palette();
        p.noFill();
        p.strokeWeight(1.3);
        for (let i = 0; i < trails.length; i++) {
          const tr = trails[i];
          p.beginShape();
          for (let j = 1; j < tr.length; j++) {
            const a = tr[j - 1];
            const b = tr[j];
            const v = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt;
            const c = ramp(pal, Math.min(1, v / 220));
            const fade = j / tr.length;
            p.stroke(c[0], c[1], c[2], 40 + 215 * fade);
            // the attractor sits around z ≈ ρ − 1; centre it and map z to screen-up
            p.vertex(b[0], -(b[2] - 25), b[1]);
          }
          p.endShape();
        }
        p.strokeWeight(6);
        p.stroke(...ctx.fg);
        p.beginShape(p.POINTS);
        for (const h of heads) p.vertex(h[0], -(h[2] - 25), h[1]);
        p.endShape();

        let spread = 0;
        for (const h of heads) {
          spread = Math.max(spread, Math.hypot(h[0] - heads[0][0], h[1] - heads[0][1], h[2] - heads[0][2]));
        }
        ctx.stats([
          { label: 'simulated time', value: (steps * dt).toFixed(2) },
          { label: 'swarm spread', value: spread < 0.01 ? spread.toExponential(2) : spread.toFixed(2) },
          { label: 'tracers', value: String(heads.length) },
          { label: 'integrator', value: `RK4, dt ${dt}` },
        ]);
      },
    };
  },
};
