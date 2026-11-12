import { paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { gaussian } from '../../core/random';
import { accelerate, bodies, energy, leapfrog, momentum, type Bodies } from './gravity';
import { stepsWithin } from '../../core/budget';

const G = 1;
const EPS = 0.04;

/** A thin disc of n light bodies in near-circular orbits around a heavy core. */
function disc(b: Bodies, from: number, n: number, rnd: () => number, centre: number[],
  drift: number[], tilt: number, coreMass: number): void {
  const core = from;
  b.m[core] = coreMass;
  b.x.set(centre, core * 3);
  b.v.set(drift, core * 3);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  for (let k = 1; k < n; k++) {
    const i = from + k;
    const r = 0.2 + 1.2 * Math.pow(rnd(), 0.7);
    const a = rnd() * Math.PI * 2;
    const h = gaussian(rnd) * 0.02;
    const vc = Math.sqrt((G * coreMass) / Math.sqrt(r * r + EPS * EPS));
    // in-plane position and velocity, then tilt about the x axis
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const vx = -Math.sin(a) * vc;
    const vy = Math.cos(a) * vc;
    b.m[i] = 0.0004;
    b.x[i * 3] = centre[0] + px;
    b.x[i * 3 + 1] = centre[1] + py * ct - h * st;
    b.x[i * 3 + 2] = centre[2] + py * st + h * ct;
    b.v[i * 3] = drift[0] + vx;
    b.v[i * 3 + 1] = drift[1] + vy * ct;
    b.v[i * 3 + 2] = drift[2] + vy * st;
  }
}

/** Pair forces a frame may compute: one step of the largest allowed system fits within it. */
const PAIRS_PER_FRAME = 720_000;

export const nBody: PlateCode = {
  id: 'n-body',
  mode: 'webgl',
  aspect: 16 / 10,
  thumbnailFrames: 140,
  params: [
    {
      kind: 'select', key: 'preset', label: 'Initial condition', value: 'merger', rebuild: true,
      options: [
        { value: 'merger', label: 'Two galaxies' },
        { value: 'disc', label: 'One disc' },
        { value: 'collapse', label: 'Cold collapse' },
      ],
    },
    { kind: 'range', key: 'n', label: 'Bodies', min: 100, max: 600, step: 50, value: 400,
      rebuild: true },
    { kind: 'range', key: 'dt', label: 'Time step', min: 0.0005, max: 0.01, step: 0.0005,
      value: 0.003 },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 6, step: 1, value: 2 },
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate', value: true },
    paletteParam('abyss'),
  ],
  pace: { kind: 'stream', emergent: 'an integrator: its steps per frame set simulated time per frame, not counted events' },
  create(p, ctx) {
    const params = ctx.params;
    let b: Bodies;
    let e0 = 0;
    let t = 0;
    let angle = 0;
    let frames = 0;
    let lastSteps = 0;

    return {
      setup() {
        const n = num(params, 'n');
        b = bodies(n);
        const preset = str(params, 'preset');
        if (preset === 'merger') {
          const half = Math.floor(n / 2);
          disc(b, 0, half, ctx.rnd, [-1.6, -0.6, 0], [0.18, 0.12, 0], 0.5, 1);
          disc(b, half, n - half, ctx.rnd, [1.6, 0.6, 0], [-0.18, -0.12, 0], -0.9, 1);
        } else if (preset === 'disc') {
          disc(b, 0, n, ctx.rnd, [0, 0, 0], [0, 0, 0], 0.35, 1);
        } else {
          for (let i = 0; i < n; i++) {
            b.m[i] = 1 / n;
            for (let d = 0; d < 3; d++) b.x[i * 3 + d] = (ctx.rnd() - 0.5) * 2.4;
          }
        }
        accelerate(b, G, EPS);
        e0 = energy(b, G, EPS);
        t = 0;
        angle = 0;
      },
      draw() {
        const dt = num(params, 'dt');
        // direct summation costs n² pair forces per step: the steps per frame are bounded by a
        // pair budget so a frame never outgrows the main thread (test/budget/)
        const steps = stepsWithin(num(params, 'speed'), b.n * b.n, PAIRS_PER_FRAME);
        lastSteps = steps;
        for (let s = 0; s < steps; s++) {
          leapfrog(b, dt, G, EPS);
          t += dt;
        }

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        if (bool(params, 'spin')) angle += 0.002;
        p.rotateX(-0.6);
        p.rotateY(angle);
        p.scale(Math.min(ctx.width, ctx.height) / 6.5);
        const pal = ctx.palette();
        p.strokeWeight(ctx.thumbnail ? 2 : 2.4);
        p.beginShape(p.POINTS);
        for (let i = 0; i < b.n; i++) {
          const sp = Math.hypot(b.v[i * 3], b.v[i * 3 + 1], b.v[i * 3 + 2]);
          const c = ramp(pal, Math.min(1, sp / 2.2));
          p.stroke(c[0], c[1], c[2], 220);
          p.vertex(b.x[i * 3], b.x[i * 3 + 1], b.x[i * 3 + 2]);
        }
        p.endShape();

        // energy is O(n²): measure it only as often as the readout refreshes
        if (!ctx.thumbnail && frames++ % 10 === 0) {
          const e = energy(b, G, EPS);
          ctx.stats([
            { label: 'bodies', value: String(b.n) },
            { label: 'simulated time', value: t.toFixed(2) },
            { label: 'steps this frame', value: `${lastSteps} of ${num(params, 'speed')} asked` },
            { label: 'energy error', value: `${((100 * (e - e0)) / Math.abs(e0)).toExponential(2)} %` },
            { label: '|total momentum|', value: momentum(b).toExponential(2) },
          ]);
        }
      },
    };
  },
};

export default nBody;
