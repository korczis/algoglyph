import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { gaussian, mulberry32 } from '../../core/random';
import {
  bodies, directAccel, QuadTree, SlicedStep, treeAccel, type Bodies,
} from './quadtree';

const G = 1;
const EPS = 0.02;
const SAMPLE = 16;
const BUCKETS = 24;
/**
 * Force interactions per frame (bodies plus accepted cells). At θ = 0 and the largest disc a
 * single step is n² of them, so a step's force pass is spread over frames (SlicedStep) and the
 * steps per frame are what this budget allows, at least one pass slice per frame.
 */
export const INTERACTIONS_PER_FRAME = 140_000;

/**
 * A disc of `n` bodies (one heavy core, the rest light) in near-circular orbits. Circular speed
 * uses the mass enclosed by each radius, so the disc's own weight is counted.
 */
function disc(b: Bodies, from: number, n: number, rnd: () => number, cx: number, cy: number,
  vx: number, vy: number, radius: number, coreMass: number, discMass: number, spin: number,
  born: Float64Array, tint: number): void {
  b.m[from] = coreMass;
  b.x[from] = cx;
  b.y[from] = cy;
  b.vx[from] = vx;
  b.vy[from] = vy;
  born[from] = tint;
  const r = new Float64Array(n);
  for (let k = 1; k < n; k++) r[k] = radius * (0.08 + 0.92 * Math.pow(rnd(), 0.8));
  const order = Array.from({ length: n - 1 }, (_, k) => k + 1).sort((a, c) => r[a] - r[c]);
  const mk = discMass / Math.max(1, n - 1);
  let enclosed = coreMass;
  for (const k of order) {
    const i = from + k;
    const a = rnd() * Math.PI * 2;
    const rr = r[k];
    const vc = Math.sqrt((G * enclosed * rr * rr) / Math.pow(rr * rr + EPS * EPS, 1.5));
    const jitter = 0.04 * vc;
    b.m[i] = mk;
    b.x[i] = cx + Math.cos(a) * rr;
    b.y[i] = cy + Math.sin(a) * rr;
    b.vx[i] = vx - spin * Math.sin(a) * vc + gaussian(rnd) * jitter;
    b.vy[i] = vy + spin * Math.cos(a) * vc + gaussian(rnd) * jitter;
    born[i] = tint + (rr / radius) * 0.5;
    enclosed += mk;
  }
}

/** Shift to the centre-of-mass frame so the camera can stay still. */
function centre(b: Bodies): void {
  let M = 0;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < b.n; i++) {
    M += b.m[i];
    x += b.m[i] * b.x[i];
    y += b.m[i] * b.y[i];
    vx += b.m[i] * b.vx[i];
    vy += b.m[i] * b.vy[i];
  }
  for (let i = 0; i < b.n; i++) {
    b.x[i] -= x / M;
    b.y[i] -= y / M;
    b.vx[i] -= vx / M;
    b.vy[i] -= vy / M;
  }
}

export interface Scene {
  b: Bodies;
  /** Colour coordinate in [0, 1]: which disc a body belongs to and the radius it started at. */
  born: Float64Array;
  /** Half the visible height or width in simulation units. */
  view: number;
}

export function populate(scene: string, n: number, rnd: () => number): Scene {
  const b = bodies(n);
  const born = new Float64Array(n);
  let view: number;
  if (scene === 'pair') {
    // both discs spin clockwise, the same sense as their mutual orbit: a prograde encounter
    const h = Math.floor(n * 0.55);
    disc(b, 0, h, rnd, -1.1, -0.45, 0.16, 0.2, 0.9, 0.6, 0.18, -1, born, 0);
    disc(b, h, n - h, rnd, 1.2, 0.5, -0.2, -0.24, 0.7, 0.45, 0.14, -1, born, 0.5);
    view = 2.1;
  } else {
    disc(b, 0, n, rnd, 0, 0, 0, 0, 1.3, 1, 0.35, 1, born, 0);
    for (let i = 0; i < n; i++) born[i] *= 2;
    view = 1.45;
  }
  centre(b);
  return { b, born, view };
}

export const barnesHut: PlateCode = {
  id: 'barnes-hut',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 150,
  params: [
    {
      kind: 'select', key: 'scene', label: 'Initial condition', value: 'disc', rebuild: true,
      options: [
        { value: 'disc', label: 'Rotating disc' },
        { value: 'pair', label: 'Two discs' },
      ],
    },
    { kind: 'range', key: 'count', label: 'Bodies', min: 200, max: 4000, step: 100, value: 1500,
      rebuild: true },
    { kind: 'range', key: 'theta', label: 'Opening angle θ', min: 0, max: 1.5, step: 0.05,
      value: 0.7, hint: 'θ = 0 is direct summation: slow for many bodies' },
    { kind: 'range', key: 'dt', label: 'Time step', min: 0.0005, max: 0.008, step: 0.0005,
      value: 0.003 },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 4, step: 1, value: 1 },
    { kind: 'toggle', key: 'tree', label: 'Show tree', value: true },
    paletteParam('abyss'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    const tree = new QuadTree();
    const probe = mulberry32(ctx.seed ^ 0x5bd1e995);
    const a = new Float64Array(2);
    const ref = new Float64Array(2);
    let b: Bodies;
    let born: Float64Array;
    let view: number;
    let t = 0;
    let interactions = 0;
    let lastTheta = 0.7;
    let pass: SlicedStep;
    let primed = false;
    let framesThisStep = 0;
    let framesLastStep = 1;

    /** Advance by up to `steps` steps within `budget` interactions; returns the steps taken. */
    const advance = (theta: number, dt: number, steps: number, budget: number): number => {
      let spent = 0;
      let done = 0;
      framesThisStep++;
      while (done < steps && spent < budget) {
        if (!pass.open) {
          if (primed) pass.begin(dt);
          else pass.prime();
        }
        const r = pass.force(theta, G, EPS, budget - spent);
        spent += r.spent;
        if (!r.done) break;
        if (pass.stepping) {
          pass.end();
          t += dt;
          done++;
          interactions = pass.total;
          framesLastStep = framesThisStep;
          framesThisStep = 0;
        } else {
          pass.open = false;
          primed = true;
          interactions = pass.total;
        }
        if (spent >= budget) break;
      }
      return done;
    };

    return {
      setup() {
        ({ b, born, view } = populate(str(params, 'scene'), num(params, 'count'), ctx.rnd));
        pass = new SlicedStep(tree, b);
        lastTheta = num(params, 'theta');
        primed = false;
        interactions = 0;
        t = 0;
        p.background(...ctx.bg);
      },
      draw() {
        const theta = num(params, 'theta');
        const dt = num(params, 'dt');
        // the stored accelerations must come from the θ in force
        if (theta !== lastTheta) {
          lastTheta = theta;
          if (pass.open) pass.restart();
          else primed = false;
        }
        if (ctx.thumbnail) advance(theta, dt, 3, Infinity);
        else advance(theta, dt, num(params, 'speed'), INTERACTIONS_PER_FRAME);

        const W = ctx.width;
        const H = ctx.height;
        const k = Math.min(W, H) / (2 * view);
        const ox = W / 2;
        const oy = H / 2;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const dark = ctx.theme === 'dark';

        p.noStroke();
        p.fill(ctx.bg[0], ctx.bg[1], ctx.bg[2], ctx.thumbnail ? 70 : 90);
        p.rect(0, 0, W, H);

        g.save();
        if (bool(params, 'tree') && tree.nodes > 0) {
          // each internal cell draws the cross that splits it, so every edge is stroked once
          const maxD = Math.max(1, tree.depthReached);
          const paths: Path2D[] = Array.from({ length: maxD + 1 }, () => new Path2D());
          for (let q = 0; q < tree.nodes; q++) {
            if (tree.child[q] < 0) continue;
            const x = ox + tree.cx[q] * k;
            const y = oy + tree.cy[q] * k;
            const h = tree.half[q] * k;
            if (h < 0.6) continue;
            const path = paths[tree.depth[q] + 1] ?? paths[maxD];
            path.moveTo(x - h, y);
            path.lineTo(x + h, y);
            path.moveTo(x, y - h);
            path.lineTo(x, y + h);
          }
          const r = tree.half[0] * k;
          paths[0].rect(ox + tree.cx[0] * k - r, oy + tree.cy[0] * k - r, 2 * r, 2 * r);
          g.lineWidth = 0.6;
          for (let d = 0; d <= maxD; d++) {
            const c = mix(ctx.fg, ramp(pal, 0.25 + 0.6 * (d / maxD)), 0.55);
            const alpha = Math.max(0.05, 0.5 * Math.pow(0.8, d));
            g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
            g.stroke(paths[d]);
          }
        }

        // bodies: one path per colour bucket, a soft halo then a bright core
        if (dark) g.globalCompositeOperation = 'lighter';
        const halos: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
        const cores: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
        const light = b.m[1] ?? b.m[0];
        for (let i = 0; i < b.n; i++) {
          const x = ox + b.x[i] * k;
          const y = oy + b.y[i] * k;
          if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
          const u = Math.min(BUCKETS - 1, Math.floor(Math.min(1, born[i]) * BUCKETS));
          const big = b.m[i] > 10 * light ? 2.2 : 1;
          halos[u].moveTo(x + 2.6 * big, y);
          halos[u].arc(x, y, 2.6 * big, 0, Math.PI * 2);
          cores[u].rect(x - 0.7 * big, y - 0.7 * big, 1.4 * big, 1.4 * big);
        }
        for (let u = 0; u < BUCKETS; u++) {
          const c = ramp(pal, (u + 0.5) / BUCKETS);
          const rgb = `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
          g.fillStyle = `rgba(${rgb},${dark ? 0.16 : 0.22})`;
          g.fill(halos[u]);
          g.fillStyle = `rgba(${rgb},0.95)`;
          g.fill(cores[u]);
        }
        g.restore();

        if (ctx.thumbnail || tree.nodes === 0) return;
        let err = 0;
        for (let s = 0; s < SAMPLE; s++) {
          const i = Math.floor(probe() * b.n);
          treeAccel(tree, b, i, theta, G, EPS, a);
          directAccel(b, i, G, EPS, ref);
          err += Math.hypot(a[0] - ref[0], a[1] - ref[1]) / Math.hypot(ref[0], ref[1]);
        }
        err /= SAMPLE;
        ctx.stats([
          { label: 'tree', value: `${tree.nodes.toLocaleString('en')} nodes, depth `
            + `${tree.depthReached}` },
          { label: 'interactions per body', value: `${(interactions / b.n).toFixed(1)} `
            + `(direct: ${(b.n - 1).toLocaleString('en')})` },
          { label: `force error (${SAMPLE} bodies)`, value: `${(err * 100).toFixed(3)} %` },
          { label: 'simulated time', value: t.toFixed(2) },
          { label: 'frames per step', value: pass.open && framesThisStep > framesLastStep
            ? `${framesThisStep} so far (${Math.round((100 * pass.next) / b.n)} % of the force pass)`
            : String(framesLastStep) },
        ]);
      },
    };
  },
};

export default barnesHut;
