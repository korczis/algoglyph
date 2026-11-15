import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { DiskGas, type DiskInit } from '../_shared/ensemble/hard-disks';
import { rgba } from '../_shared/two-slit/draw';

type Experiment = 'pair' | 'pi' | 'cradle' | 'oblique';

/** States of a recorded run shown at most per frame, and the samples of a run recorded in time. */
export const MAX_PER_FRAME = 200;
export const SAMPLES = 400;
/** The speed scale in box units: every velocity is reported in units of V. */
const V = 0.25;
const Y = 0.5;
const when = (...values: Experiment[]) => ({ key: 'experiment', values });

export interface Recorded {
  /** Positions and velocities of every disk, one row per recorded state. */
  x: Float64Array[];
  y: Float64Array[];
  vx: Float64Array[];
  vy: Float64Array[];
  d: number;
  m: Float64Array;
  gas: DiskGas;
  start: DiskInit;
}

const disks = (rows: number[][]): DiskInit => ({
  x: Float64Array.from(rows.map((r) => r[0])), y: Float64Array.from(rows.map((r) => r[1])),
  vx: Float64Array.from(rows.map((r) => r[2])), vy: Float64Array.from(rows.map((r) => r[3])),
  m: Float64Array.from(rows.map((r) => r[4])),
});

const snap = (r: Recorded) => {
  r.x.push(Float64Array.from(r.gas.x));
  r.y.push(Float64Array.from(r.gas.y));
  r.vx.push(Float64Array.from(r.gas.vx));
  r.vy.push(Float64Array.from(r.gas.vy));
};

/** The time until the first disk would reach a wall on its present line. */
function toWall(g: DiskGas): number {
  let t = Infinity;
  const lo = g.d / 2;
  const hi = 1 - g.d / 2;
  for (let i = 0; i < g.n; i++) {
    if (g.vx[i] > 0) t = Math.min(t, (hi - g.x[i]) / g.vx[i]); else if (g.vx[i] < 0) t = Math.min(t, (lo - g.x[i]) / g.vx[i]);
    if (g.vy[i] > 0) t = Math.min(t, (hi - g.y[i]) / g.vy[i]); else if (g.vy[i] < 0) t = Math.min(t, (lo - g.y[i]) / g.vy[i]);
  }
  return t;
}

/**
 * A run recorded in time: the disks fly until `collisions` disk–disk collisions have happened,
 * then on for 0.9 of the time before the first would reach a wall, sampled evenly.
 */
export function recordInTime(start: DiskInit, d: number, collisions: number, e = 1): Recorded {
  // a dry run finds when the last collision happens and when a wall would come next
  const dry = new DiskGas(start, d, e);
  let guard = 0;
  while (dry.collisions < collisions && guard++ < 100000) {
    const before = dry.collisions + dry.bounces;
    dry.advance(Infinity, 1);
    if (dry.collisions + dry.bounces === before && !Number.isFinite(dry.t)) break;
  }
  const end = dry.t + 0.9 * toWall(dry);
  const r: Recorded = { x: [], y: [], vx: [], vy: [], d, m: start.m, gas: new DiskGas(start, d, e), start };
  snap(r);
  for (let k = 1; k <= SAMPLES; k++) {
    r.gas.advance((k * end) / SAMPLES, Infinity);
    snap(r);
  }
  return r;
}

/**
 * Galperin's billiard: a light disk at rest between the left wall and a heavy one coming in.
 * Every collision (disk–disk or the light one on the wall) is one recorded state, until neither
 * can meet anything again: both move right with the heavy one at least as fast.
 */
export function recordGalperin(ratio: number, d: number): Recorded & { count: number; pending: number } {
  const start = disks([[0.3, Y, 0, 0, 1], [0.8, Y, -V, 0, ratio]]);
  const r: Recorded = { x: [], y: [], vx: [], vy: [], d, m: start.m, gas: new DiskGas(start, d), start };
  snap(r);
  const g = r.gas;
  // the heavy disk moves right at least as fast as the light one will after any bounce still due
  const over = () => g.vx[1] >= 0 && g.vx[1] >= Math.abs(g.vx[0]);
  for (let guard = 0; !over() && guard < 2e6; guard++) {
    const before = g.collisions + g.bounces;
    g.advance(Infinity, 1);
    if (g.collisions + g.bounces > before) snap(r);
  }
  // a light disk still moving left has one bounce on the wall to come, after which it can never
  // catch the heavy one; it is counted, and the run stops before the heavy disk meets the far wall
  const pending = g.vx[0] < 0 ? 1 : 0;
  return { ...r, count: g.collisions + g.bounces + pending, pending };
}

/** The closed form of a head-on collision with restitution e: the velocities after. */
export function headOn(m1: number, m2: number, u1: number, u2: number, e: number): [number, number] {
  const p = m1 * u1 + m2 * u2;
  return [(p + m2 * e * (u2 - u1)) / (m1 + m2), (p + m1 * e * (u1 - u2)) / (m1 + m2)];
}

const angle = (ax: number, ay: number, bx: number, by: number) =>
  (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))))) * 180) / Math.PI;

export const collisions: PlateCode = {
  id: 'collisions',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'experiment', label: 'Experiment', value: 'pair', rebuild: true,
      options: [
        { value: 'pair', label: 'Two bodies head on' },
        { value: 'pi', label: 'Counting collisions (Galperin’s billiard)' },
        { value: 'cradle', label: 'A row of equal balls (Newton’s cradle)' },
        { value: 'oblique', label: 'A glancing collision in the plane' },
      ],
    },
    { kind: 'range', key: 'ratio', label: 'Mass of the second body m₂/m₁', min: 0.1, max: 10, step: 0.1, value: 3,
      rebuild: true, when: when('pair', 'oblique') },
    { kind: 'range', key: 'u2', label: 'Velocity of the second body u₂ (in units of u₁)', min: -1, max: 1, step: 0.05,
      value: 0, rebuild: true, when: when('pair') },
    { kind: 'range', key: 'e', label: 'Coefficient of restitution e', min: 0, max: 1, step: 0.05, value: 1,
      rebuild: true, when: when('pair') },
    { kind: 'range', key: 'digits', label: 'Mass ratio M/m = 100^k, k', min: 0, max: 4, step: 1, value: 2,
      rebuild: true, when: when('pi'), hint: 'The collisions count the first k + 1 digits of π. Each k multiplies the run by ten; k = 4 builds in about 20 ms, and k = 5 would pass the rebuild budget.' },
    { kind: 'range', key: 'balls', label: 'Balls in the row', min: 2, max: 8, step: 1, value: 5, rebuild: true,
      when: when('cradle'), hint: 'A row of eight fills the box at this ball size.' },
    { kind: 'range', key: 'incoming', label: 'Balls swung in', min: 1, max: 4, step: 1, value: 2, rebuild: true,
      when: when('cradle') },
    { kind: 'range', key: 'impact', label: 'Impact parameter b, in diameters', min: 0, max: 0.95, step: 0.05,
      value: 0.5, rebuild: true, when: when('oblique'), hint: 'At b = d the disks only graze; 0.95 keeps a measurable turn.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'states' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'states', MAX_PER_FRAME);
    let experiment: Experiment = 'pair';
    let rec: Recorded;
    let count = 0;
    let shown = 0;
    let rows: Stat[] = [];

    function setup() {
      experiment = str(params, 'experiment') as Experiment;
      const ratio = num(params, 'ratio');
      rows = [];
      if (experiment === 'pair') {
        const e = num(params, 'e');
        const u2 = num(params, 'u2');
        const start = disks([[0.3, Y, V, 0, 1], [0.7, Y, u2 * V, 0, ratio]]);
        rec = recordInTime(start, 0.08, 1, e);
        const g = rec.gas;
        const [c1, c2] = headOn(1, ratio, 1, u2, e);
        const p0 = 1 + ratio * u2;
        const p1 = (g.vx[0] + ratio * g.vx[1]) / V;
        const e0 = 0.5 * (1 + ratio * u2 * u2);
        const e1 = (0.5 * (g.vx[0] ** 2 + ratio * g.vx[1] ** 2)) / (V * V);
        const mu = ratio / (1 + ratio);
        rows.push(
          { label: 'collisions between the bodies', value: String(g.collisions) },
          { label: 'velocity of body 1 after, measured (units of u₁)', value: (g.vx[0] / V).toFixed(12) },
          { label: 'body 1 after, closed form (m₁u₁ + m₂u₂ + m₂e(u₂ − u₁))/(m₁ + m₂)', value: c1.toFixed(12) },
          { label: 'velocity of body 2 after, measured (units of u₁)', value: (g.vx[1] / V).toFixed(12) },
          { label: 'body 2 after, closed form (m₁u₁ + m₂u₂ + m₁e(u₁ − u₂))/(m₁ + m₂)', value: c2.toFixed(12) },
          { label: 'momentum change |Δp|/|p|, numerics', value: (Math.abs(p1 - p0) / Math.max(1e-300, Math.abs(p0))).toExponential(2) },
          { label: 'kinetic energy lost, measured (share of the start)', value: ((e0 - e1) / e0).toFixed(12) },
          { label: 'energy lost, closed form ½μ(1 − e²)(u₁ − u₂)² over the start', value: ((0.5 * mu * (1 - e * e) * (1 - u2) ** 2) / e0).toFixed(12) },
        );
      } else if (experiment === 'pi') {
        const ratio100 = 100 ** Math.round(num(params, 'digits'));
        const run = recordGalperin(ratio100, 0.02);
        rec = run;
        count = run.count;
        // each collision reflects the state (√m v₁, √M v₂) on a circle by 2θ, θ = atan √(m/M)
        const theta = Math.atan(Math.sqrt(1 / ratio100));
        let worst = 0;
        const r0 = Math.hypot(rec.vx[0][0], Math.sqrt(ratio100) * rec.vx[0][1]);
        rec.vx.forEach((v) => { worst = Math.max(worst, Math.abs(Math.hypot(v[0], Math.sqrt(ratio100) * v[1]) - r0) / r0); });
        rows.push(
          { label: 'collisions counted, disks and wall', value: String(count) },
          { label: 'of them, a last bounce on the wall still to come', value: run.pending ? 'yes, counted' : 'none' },
          { label: 'closed form ⌈π/θ⌉ − 1, θ = atan √(m/M)', value: String(Math.ceil(Math.PI / theta) - 1) },
          { label: 'π × 10^k, for comparison', value: (Math.PI * Math.sqrt(ratio100)).toFixed(3) },
          { label: 'largest departure from the energy circle |r − r₀|/r₀, numerics', value: worst.toExponential(2) },
        );
      } else if (experiment === 'cradle') {
        const n = Math.round(num(params, 'balls'));
        const k = Math.min(Math.round(num(params, 'incoming')), n - 1);
        const d = 0.07;
        // the row rests with gaps of a millionth of a diameter; the swung balls come in touching each other
        const rest = Array.from({ length: n - k }, (_, i) => [0.45 + i * d * (1 + 1e-6), Y, 0, 0, 1]);
        const swung = Array.from({ length: k }, (_, i) => [0.45 - 0.12 - (k - 1 - i) * d * (1 + 1e-6), Y, V, 0, 1]);
        rec = recordInTime(disks([...swung, ...rest]), d, k * (n - k));
        const g = rec.gas;
        const movers = Array.from(g.vx).filter((v) => Math.abs(v) > 1e-9 * V);
        const out = movers.length ? Math.max(...movers.map((v) => Math.abs(v / V - 1))) : Number.NaN;
        const still = Math.max(0, ...Array.from(g.vx).filter((v) => Math.abs(v) <= 1e-9 * V).map((v) => Math.abs(v / V)));
        rows.push(
          { label: 'balls leaving the row', value: String(movers.length) },
          { label: 'balls swung in', value: String(k) },
          { label: 'largest |v/u − 1| of a leaving ball', value: Number.isFinite(out) ? out.toExponential(2) : 'none' },
          { label: 'largest speed of a ball left behind (units of u)', value: still.toExponential(2) },
          { label: 'collisions between balls', value: String(g.collisions) },
        );
      } else {
        const b = num(params, 'impact');
        const d = 0.1;
        const start = disks([[0.2, Y - b * d, V, 0, 1], [0.5, Y, 0, 0, ratio]]);
        rec = recordInTime(start, d, 1);
        const g = rec.gas;
        // a head-on hit of equal masses stops the first disk: it has no direction left to measure
        const stopped = Math.hypot(g.vx[0], g.vy[0]) < 1e-12 * V;
        const between = g.collisions && !stopped ? angle(g.vx[0], g.vy[0], g.vx[1], g.vy[1]) : Number.NaN;
        const deflection = stopped ? Number.NaN : angle(V, 0, g.vx[0], g.vy[0]);
        // hard disks turn the relative velocity by χ = π − 2 asin(b/d) in the centre-of-mass frame
        const chi = Math.PI - 2 * Math.asin(b);
        const lab = (Math.atan2(Math.sin(chi), 1 / ratio + Math.cos(chi)) * 180) / Math.PI;
        rows.push(
          { label: 'collisions between the disks', value: String(g.collisions) },
          { label: 'angle between the velocities after (°)', value: Number.isFinite(between) ? between.toFixed(9) : g.collisions ? 'the first disk stops' : 'no collision' },
          { label: 'deflection of the first disk, measured (°)', value: Number.isFinite(deflection) ? deflection.toFixed(9) : 'the first disk stops' },
          { label: 'deflection, closed form atan(sin χ/(m₁/m₂ + cos χ)), χ = π − 2 asin(b/d) (°)', value: lab.toFixed(9) },
          { label: 'kinetic energy change |ΔE|/E, numerics', value: (Math.abs(g.energy() - 0.5 * V * V) / (0.5 * V * V)).toExponential(2) },
        );
      }
      shown = 0;
      pacer.start(rec.x.length);
    }

    return {
      setup,
      pace: () => pacer.report(shown >= rec.x.length, params),
      draw() {
        const total = rec.x.length;
        const take = ctx.thumbnail ? total : pacer.take(params);
        shown = Math.min(total, Math.max(1, shown + take));
        const at = shown - 1;
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // the box seen from above, on the left
        const side = Math.min(W * 0.5, H * 0.8);
        const bx = W * 0.04;
        const by = (H - side) / 2;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.4), 1);
        g.lineWidth = 1;
        g.strokeRect(bx, by, side, side);
        const n = rec.m.length;
        const colour = (i: number) => rgba(ramp(pal, n > 1 ? 0.1 + (0.8 * i) / (n - 1) : 0.5), 1);
        for (let i = 0; i < n; i++) {
          // the track of each disk so far, then the disk
          g.strokeStyle = colour(i);
          g.globalAlpha = 0.45;
          g.beginPath();
          for (let k = 0; k <= at; k += Math.max(1, Math.floor(at / 400))) {
            const X = bx + rec.x[k][i] * side;
            const Yy = by + (1 - rec.y[k][i]) * side;
            if (k === 0) g.moveTo(X, Yy); else g.lineTo(X, Yy);
          }
          g.stroke();
          g.globalAlpha = 1;
          g.fillStyle = colour(i);
          g.beginPath();
          g.arc(bx + rec.x[at][i] * side, by + (1 - rec.y[at][i]) * side, Math.max(2, (rec.d / 2) * side), 0, 2 * Math.PI);
          g.fill();
        }
        // on the right: the energy circle for the billiard, velocities against time otherwise
        const x0 = W * 0.6;
        const w = W * 0.36;
        const y0 = H * 0.15;
        const h = H * 0.7;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(x0, y0, w, h);
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        if (experiment === 'pi') {
          const M = rec.m[1];
          const r0 = Math.hypot(rec.vx[0][0], Math.sqrt(M) * rec.vx[0][1]);
          const c = [x0 + w / 2, y0 + h / 2];
          const rad = Math.min(w, h) * 0.45;
          g.beginPath();
          g.arc(c[0], c[1], rad, 0, 2 * Math.PI);
          g.stroke();
          g.strokeStyle = rgba(ramp(pal, 0.85), 1);
          g.beginPath();
          const from = Math.max(0, at - 2000);
          for (let k = from; k <= at; k++) {
            const X = c[0] + (Math.sqrt(M) * rec.vx[k][1] / r0) * rad;
            const Yy = c[1] - (rec.vx[k][0] / r0) * rad;
            if (k === from) g.moveTo(X, Yy); else g.lineTo(X, Yy);
          }
          g.stroke();
          g.fillText(`(√M v₂, √m v₁) on the energy circle: ${at} of ${count} collisions`, x0, y0 - 8);
        } else {
          let peak = 1e-12;
          for (const v of rec.vx) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(v[i]));
          const Yv = (v: number) => y0 + h / 2 - (v / peak) * (h / 2) * 0.9;
          g.beginPath();
          g.moveTo(x0, Yv(0));
          g.lineTo(x0 + w, Yv(0));
          g.stroke();
          for (let i = 0; i < n; i++) {
            g.strokeStyle = colour(i);
            g.lineWidth = 1.5;
            g.beginPath();
            for (let k = 0; k <= at; k++) {
              const X = x0 + (k / (total - 1)) * w;
              if (k === 0) g.moveTo(X, Yv(rec.vx[k][i])); else g.lineTo(X, Yv(rec.vx[k][i]));
            }
            g.stroke();
          }
          g.fillText('velocity along x of each body against time', x0, y0 - 8);
        }
        g.restore();
        ctx.stats([pacer.row(params), { label: 'states shown', value: `${shown} of ${total}` }, ...rows]);
      },
    };
  },
};

export default collisions;
