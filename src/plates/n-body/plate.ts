import { paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { gaussian } from '../../core/random';
import { accelerate, angularMomentum, bodies, energy, leapfrog, momentum, type Bodies } from './gravity';
import { stepsWithin } from '../../core/budget';
import { RunCounter, runsParam } from '../_shared/settle/settle';

/** Simulated time in one measuring run: the energy error's largest excursion is read over it. */
export const RUN_TIME = 2;

const G = 1;
const EPS = 0.04;
/** The binary's separation: 25 softening lengths, so the pair is nearly Kepler's. */
const BINARY_D = 1;

/** The angular rate of a circular pair of total mass M at separation d under the softened force. */
export const softenedRate = (M: number, d: number): number => Math.sqrt((G * M) / (d * d + EPS * EPS) ** 1.5);

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
        { value: 'binary', label: 'A circular binary' },
      ],
    },
    { kind: 'range', key: 'n', label: 'Bodies', min: 100, max: 600, step: 50, value: 400,
      rebuild: true, when: { key: 'preset', values: ['merger', 'disc', 'collapse'] } },
    { kind: 'range', key: 'dt', label: 'Time step', min: 0.0005, max: 0.01, step: 0.0005,
      value: 0.003 },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 6, step: 1, value: 2 },
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate', value: true },
    runsParam(),
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
    let counter = new RunCounter(params);
    let worst = 0;
    let p0 = 0;
    let runStart = 0;
    let L0: Float64Array = new Float64Array(3);
    let lScale = 1;
    let worstL = 0;
    let binary = false;
    let turned = 0;
    let lastAngle = 0;
    let turnedAt = 0;

    return {
      setup() {
        const preset = str(params, 'preset');
        binary = preset === 'binary';
        const n = binary ? 2 : num(params, 'n');
        b = bodies(n);
        if (binary) {
          // two equal bodies on a circle about their centre of mass, in the xy plane
          const v = (softenedRate(1, BINARY_D) * BINARY_D) / 2;
          b.m[0] = 0.5;
          b.m[1] = 0.5;
          b.x.set([-BINARY_D / 2, 0, 0, BINARY_D / 2, 0, 0]);
          b.v.set([0, -v, 0, 0, v, 0]);
        } else if (preset === 'merger') {
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
        p0 = momentum(b);
        L0 = angularMomentum(b);
        // the scale of the angular momentum: Σ m|x||v| at the start, never zero for moving bodies
        lScale = 0;
        for (let i = 0; i < b.n; i++) {
          lScale += b.m[i] * Math.hypot(b.x[i * 3], b.x[i * 3 + 1], b.x[i * 3 + 2]) * Math.hypot(b.v[i * 3], b.v[i * 3 + 1], b.v[i * 3 + 2]);
        }
        lScale = lScale || 1;
        worstL = 0;
        turned = 0;
        turnedAt = 0;
        lastAngle = Math.atan2(b.x[4] - b.x[1], b.x[3] - b.x[0]);
        t = 0;
        angle = 0;
        counter = new RunCounter(params);
        worst = 0;
        runStart = 0;
        frames = 0;
      },
      draw() {
        const dt = num(params, 'dt');
        // direct summation costs n² pair forces per step: the steps per frame are bounded by a
        // pair budget so a frame never outgrows the main thread (test/budget/)
        // held once k measuring runs have completed (the `runs` control), so a claim can read them
        const steps = counter.stopped ? 0 : stepsWithin(num(params, 'speed'), b.n * b.n, PAIRS_PER_FRAME);
        lastSteps = steps;
        for (let s = 0; s < steps; s++) {
          leapfrog(b, dt, G, EPS);
          t += dt;
          if (binary && t <= RUN_TIME + 1e-12) {
            const a = Math.atan2(b.x[4] - b.x[1], b.x[3] - b.x[0]);
            let d = a - lastAngle;
            d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
            turned += d;
            lastAngle = a;
            turnedAt = t;
          }
        }

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        if (bool(params, 'spin')) angle += 0.002;
        p.rotateX(-0.6);
        p.rotateY(angle);
        p.scale(Math.min(ctx.width, ctx.height) / 6.5);
        const pal = ctx.palette();
        p.strokeWeight(binary ? 10 : ctx.thumbnail ? 2 : 2.4);
        p.beginShape(p.POINTS);
        for (let i = 0; i < b.n; i++) {
          const sp = Math.hypot(b.v[i * 3], b.v[i * 3 + 1], b.v[i * 3 + 2]);
          const c = ramp(pal, Math.min(1, sp / 2.2));
          p.stroke(c[0], c[1], c[2], 220);
          p.vertex(b.x[i * 3], b.x[i * 3 + 1], b.x[i * 3 + 2]);
        }
        p.endShape();

        // energy is O(n²): measure it only as often as the readout refreshes
        if (!ctx.thumbnail && (frames++ % 10 === 0 || t - runStart >= RUN_TIME)) {
          const e = energy(b, G, EPS);
          const rel = Math.abs((e - e0) / e0);
          if (steps > 0) worst = Math.max(worst, rel);
          const L = angularMomentum(b);
          if (steps > 0) worstL = Math.max(worstL, Math.hypot(L[0] - L0[0], L[1] - L0[1], L[2] - L0[2]) / lScale);
          if (steps > 0 && t - runStart >= RUN_TIME) {
            counter.complete(`largest energy error ${(100 * worst).toExponential(2)} % over t = ${runStart.toFixed(2)} to ${t.toFixed(2)}`);
            runStart = t;
          }
          ctx.stats([
            { label: 'bodies', value: String(b.n) },
            { label: 'simulated time', value: t.toFixed(2) },
            { label: 'steps this frame', value: `${lastSteps} of ${num(params, 'speed')} asked` },
            { label: 'energy error', value: `${((100 * (e - e0)) / Math.abs(e0)).toExponential(2)} %` },
            { label: '|total momentum|', value: momentum(b).toExponential(2) },
            { label: 'largest energy error since the start, sampled every ten frames', value: `${(100 * worst).toExponential(2)} %` },
            { label: 'change of |total momentum| since the start', value: Math.abs(momentum(b) - p0).toExponential(2) },
            { label: 'largest change of the total angular momentum, over Σm|x||v| at the start, sampled every ten frames', value: worstL.toExponential(2) },
            ...(binary ? [
              { label: 'orbital rate √(GM/(d² + ε²)^(3/2)) of the softened pair', value: softenedRate(1, BINARY_D).toFixed(10) },
              { label: 'orbital rate of the binary, measured from the angle turned in the first run', value: turnedAt > 0 ? (turned / turnedAt).toFixed(10) : 'measuring…' },
            ] : []),
            ...counter.rows(),
          ]);
        }
      },
    };
  },
};

export default nBody;
