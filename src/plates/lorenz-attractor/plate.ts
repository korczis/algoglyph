import { paletteParam } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { Rk4 } from '../_shared/ode/ode';
import { runsParam, StreamStop } from '../_shared/settle/settle';
import { drawTrail, Trail } from './trail';

type V3 = [number, number, number];

/** The step of the flow, in time units. */
const DT = 0.006;
/** Steps in one run of the stop: 100 steps of DT, 0.6 time units, a whole number of steps. */
const BLOCK = 100;

export function lorenz([x, y, z]: V3, sigma: number, rho: number, beta: number): V3 {
  return [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
}

const stepper = new Rk4(3);
const state = new Float64Array(3);

/** One RK4 step of the Lorenz flow, by the shared integrator library (src/plates/_shared/ode). */
export function rk4Lorenz(s: V3, dt: number, sigma: number, rho: number, beta: number): V3 {
  state[0] = s[0];
  state[1] = s[1];
  state[2] = s[2];
  stepper.step((_t, y, out) => {
    const d = lorenz([y[0], y[1], y[2]], sigma, rho, beta);
    out[0] = d[0];
    out[1] = d[1];
    out[2] = d[2];
  }, 0, state, dt);
  return [state[0], state[1], state[2]];
}

export const lorenzAttractor: PlateCode = {
  id: 'lorenz-attractor',
  mode: 'webgl',
  aspect: 16 / 10,
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
    // a stop costs nothing, so its top is not a budget's: past time 600 a reader lets it run on
    runsParam({ unit: 'blocks of 0.6 time', max: 1000,
      note: `A block is ${BLOCK} steps of dt ${DT}: k = 180 stops at time 108.` }),
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate', value: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'stream', emergent: 'an integrator: its steps per frame set simulated time per frame, not counted events' },
  create(p, ctx) {
    const params = ctx.params;
    let trails: Trail[] = [];
    let heads: V3[] = [];
    let angle = 0;
    let steps = 0;
    const dt = DT;
    const stop = new StreamStop(params, BLOCK);

    return {
      setup() {
        const n = num(params, 'tracers');
        heads = Array.from({ length: n }, (): V3 => [
          1 + (ctx.rnd() - 0.5) * 1e-4, 1 + (ctx.rnd() - 0.5) * 1e-4, 20 + (ctx.rnd() - 0.5) * 1e-4,
        ]);
        trails = heads.map(() => new Trail(num(params, 'trail'), dt));
        steps = 0;
        stop.reset();
        angle = ctx.rnd() * Math.PI * 2;
      },
      draw() {
        const sigma = num(params, 'sigma');
        const rho = num(params, 'rho');
        const beta = num(params, 'beta');
        // clamped to the stop: the frame that reaches it steps only the steps left
        const n = stop.allow(num(params, 'speed'));
        stop.advance(n);
        for (let s = 0; s < n; s++) {
          for (let i = 0; i < heads.length; i++) {
            heads[i] = rk4Lorenz(heads[i], dt, sigma, rho, beta);
            trails[i].push(heads[i]);
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
        for (const tr of trails) drawTrail(p, tr, pal);
        p.strokeWeight(6);
        p.stroke(...ctx.fg);
        p.beginShape(p.POINTS);
        for (const h of heads) p.vertex(h[0], -(h[2] - 25), h[1]);
        p.endShape();

        let spread = 0;
        for (const h of heads) {
          spread = Math.max(spread, Math.hypot(h[0] - heads[0][0], h[1] - heads[0][1], h[2] - heads[0][2]));
        }
        // the fixed points C± = (±c, ±c, ρ − 1), c = √(β(ρ − 1)): stable below the Hopf value
        // σ(σ + β + 3)/(σ − β − 1), where each tracer ends on one, whichever the seed picks
        const c = Math.sqrt(beta * (rho - 1));
        let near = 0;
        for (const [x, y, z] of heads) {
          near = Math.max(near, Math.min(Math.hypot(x - c, y - c, z - rho + 1),
            Math.hypot(x + c, y + c, z - rho + 1)));
        }
        ctx.stats([
          { label: 'simulated time', value: (steps * dt).toFixed(2) },
          { label: 'swarm spread', value: spread < 0.01 ? spread.toExponential(2) : spread.toFixed(2) },
          { label: 'largest distance to the nearer of C±',
            value: near < 0.01 ? near.toExponential(2) : near.toFixed(2) },
          { label: 'tracers', value: String(heads.length) },
          { label: 'integrator', value: `RK4, dt ${dt}` },
          ...stop.rows(),
        ]);
      },
    };
  },
};

export default lorenzAttractor;
