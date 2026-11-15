import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { agmK } from '../_shared/lumped/oscillator';
import {
  bead, circle, cycloid, energy, incline, leftAt, parabola, rattle, type Bead, type Track,
} from '../_shared/particles/constraint';
import { rgba } from '../_shared/two-slit/draw';

type Experiment = 'incline' | 'release';
type Shape = 'cycloid' | 'circle' | 'parabola';

/** Samples of a run (the counted changes); RATTLE steps between two samples come from `substeps`. */
export const SAMPLES = 600;
export const MAX_PER_FRAME = 20;
/** Units: g = 1 and the cycloid's rolling circle R = 1; the circle and the parabola share the
 * cycloid's radius of curvature at the bottom, 4R, so the three bowls agree for small swings. */
const G = 1;
const R = 1;
const INCLINE_TIME = 3;
const when = (...values: Experiment[]) => ({ key: 'experiment', values });

/** The time at which x(t) crosses 0 upwards between two steps, by the cubic Hermite through their
 * positions and velocities, refined by bisection. */
export function crossing(t0: number, x0: number, v0: number, x1: number, v1: number, h: number): number {
  const at = (s: number) => {
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * x0 + (s3 - 2 * s2 + s) * h * v0 + (-2 * s3 + 3 * s2) * x1 + (s3 - s2) * h * v1;
  };
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (at(mid) < 0) lo = mid; else hi = mid;
  }
  return t0 + 0.5 * (lo + hi) * h;
}

export const constrainedMotion: PlateCode = {
  id: 'constrained-motion',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'experiment', label: 'Experiment', value: 'release', rebuild: true,
      options: [
        { value: 'release', label: 'Beads released down a bowl' },
        { value: 'incline', label: 'A block on an incline, with friction' },
      ],
    },
    {
      kind: 'select', key: 'track', label: 'Bowl', value: 'cycloid', rebuild: true, when: when('release'),
      options: [
        { value: 'cycloid', label: 'Cycloid (the tautochrone)' },
        { value: 'circle', label: 'Circle of radius 4R (a pendulum)' },
        { value: 'parabola', label: 'Parabola of curvature radius 4R' },
      ],
    },
    { kind: 'range', key: 'beads', label: 'Beads', min: 1, max: 8, step: 1, value: 5, rebuild: true,
      when: when('release'), hint: 'At most eight, so that each bead keeps a colour of its own.' },
    { kind: 'range', key: 'top', label: 'Highest release, share of the cusp height 2R', min: 0.1, max: 0.95,
      step: 0.05, value: 0.9, rebuild: true, when: when('release') },
    { kind: 'range', key: 'angle', label: 'Incline angle θ (°)', min: 5, max: 60, step: 1, value: 30,
      rebuild: true, when: when('incline') },
    { kind: 'range', key: 'mu', label: 'Friction coefficient μ', min: 0, max: 1, step: 0.05, value: 0.2,
      rebuild: true, when: when('incline') },
    { kind: 'range', key: 'resolution', label: 'RATTLE steps per sample', min: 4, max: 120, step: 1, value: 40,
      rebuild: true, hint: 'The step is the run time over 600 samples of this many steps; the error is second order in it. The top is what a frame of eight beads affords.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
    let experiment: Experiment = 'release';
    let shape: Shape = 'cycloid';
    let track: Track = cycloid(R);
    let beads: Bead[] = [];
    let e0: number[] = [];
    let start: number[] = [];
    let arrive: number[] = [];
    let drift = 0;
    let T = 1;
    let sub = 40;
    let sample = 0;
    let lost = false;
    let paths: number[][] = [];
    let mu = 0;
    let theta = 0;
    let normalSum = 0;
    let normalCount = 0;
    let work = 0;

    function setup() {
      experiment = str(params, 'experiment') as Experiment;
      shape = str(params, 'track') as Shape;
      sub = Math.round(num(params, 'resolution'));
      sample = 0;
      drift = 0;
      lost = false;
      normalSum = 0;
      normalCount = 0;
      work = 0;
      if (experiment === 'incline') {
        theta = (num(params, 'angle') * Math.PI) / 180;
        mu = num(params, 'mu');
        track = incline(theta, 5);
        beads = [bead(track, 0, G)];
        T = INCLINE_TIME;
      } else {
        mu = 0;
        // each bowl reaches the cusp height 2R: the circle at √(L² − (L − 2R)²), the parabola at 4R
        track = shape === 'cycloid' ? cycloid(R) : shape === 'circle' ? circle(4 * R, Math.sqrt(12) * R)
          : parabola(4 * R, 4 * R);
        const n = Math.round(num(params, 'beads'));
        const top = num(params, 'top') * 2 * R;
        beads = Array.from({ length: n }, (_, k) => bead(track, leftAt(track, (top * (k + 1)) / n), G));
        // a little over one small-swing period of the cycloid, 4π√(R/g): every bead reaches the bottom
        T = 1.1 * 4 * Math.PI * Math.sqrt(R / G);
      }
      e0 = beads.map((b) => energy(b, G));
      start = beads.map((b) => b.x);
      arrive = beads.map(() => Number.NaN);
      paths = beads.map((b) => [b.x]);
      pacer.start(SAMPLES);
    }

    function advance() {
      const h = T / (SAMPLES * sub);
      for (let k = 0; k < sub; k++) {
        const t = (sample * sub + k) * h;
        beads.forEach((b, i) => {
          const x0 = b.x;
          const y0 = b.y;
          const v0 = b.vx;
          if (!rattle(b, track, h, G, mu)) lost = true;
          // the work friction takes, μN along the path, for the energy balance
          if (mu > 0) work += mu * b.normal * Math.hypot(b.x - x0, b.y - y0);
          if (Number.isNaN(arrive[i]) && x0 < 0 && b.x >= 0) arrive[i] = crossing(t, x0, v0, b.x, b.vx, h);
          const e = energy(b, G);
          // on the incline the energy starts at 0 and friction takes some: the balance ΔE + W, per g|Δy|
          drift = experiment === 'incline'
            ? Math.max(drift, Math.abs(e - e0[i] + work) / Math.max(1e-12, G * Math.abs(b.y - track.f(start[i]))))
            : Math.max(drift, Math.abs(e - e0[i]) / Math.max(1e-300, Math.abs(e0[i])));
        });
        if (experiment === 'incline') { normalSum += beads[0].normal; normalCount++; }
      }
      sample++;
      beads.forEach((b, i) => paths[i].push(experiment === 'incline' ? Math.hypot(b.x, b.y) : b.x));
    }

    /** a in s = ½at², by least squares through the sampled distances. */
    function fittedAcceleration(): number {
      const s = paths[0];
      let num2 = 0;
      let den = 0;
      for (let i = 1; i < s.length; i++) {
        const t = (i * T) / SAMPLES;
        num2 += s[i] * t * t;
        den += t ** 4;
      }
      return den > 0 ? (2 * num2) / den : Number.NaN;
    }

    function stats(): Stat[] {
      const done = sample >= SAMPLES;
      const rows: Stat[] = [pacer.row(params),
        { label: 'samples of the run', value: `${sample} of ${SAMPLES}, ${sub} RATTLE steps each` },
      ];
      const after = (v: number, digits: number) => (done && Number.isFinite(v) ? v.toFixed(digits) : 'after the run');
      const gap = Math.max(...beads.map((b) => b.maxGap));
      const vn = Math.max(...beads.map((b) => b.maxNormalSpeed));
      if (experiment === 'incline') {
        const closed = G * (Math.sin(theta) - mu * Math.cos(theta));
        rows.push(
          { label: 'acceleration along the track, fitted to s = ½at²', value: after(fittedAcceleration(), 12) },
          { label: 'closed form g(sin θ − μ cos θ)', value: closed.toFixed(12) },
          { label: 'the block slides: tan θ against μ', value: `${Math.tan(theta).toFixed(4)} against ${mu.toFixed(2)}, ${Math.tan(theta) > mu ? 'slides' : 'holds'}` },
          { label: 'normal force per unit mass, from the multiplier', value: after(normalCount ? normalSum / normalCount : Number.NaN, 12) },
          { label: 'closed form g cos θ', value: (G * Math.cos(theta)).toFixed(12) },
          { label: 'distance slid', value: paths[0][paths[0].length - 1].toFixed(6) },
        );
      } else {
        const times = arrive.filter((t) => Number.isFinite(t));
        const all = done && times.length === beads.length;
        const mean = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
        const spread = all ? (Math.max(...times) - Math.min(...times)) / mean : Number.NaN;
        rows.push(
          { label: 'mean time to the bottom', value: all ? mean.toFixed(9) : 'after the run' },
          { label: 'time to the bottom, each bead, from the lowest', value: arrive.map((t) => (Number.isFinite(t) ? t.toFixed(6) : '–')).join(', ') },
          { label: 'spread of the times to the bottom, (max − min)/mean', value: all ? spread.toExponential(3) : 'after the run' },
        );
        if (shape === 'cycloid') {
          rows.push({ label: 'tautochrone π√(R/g)', value: (Math.PI * Math.sqrt(R / G)).toFixed(9) });
        } else if (shape === 'circle') {
          // a pendulum of length L released at θ₀ reaches the bottom after √(L/g)·K(sin(θ₀/2))
          const L = 4 * R;
          let worst = 0;
          beads.forEach((_, i) => {
            const th0 = Math.acos(1 - track.f(start[i]) / L);
            const t = Math.sqrt(L / G) * agmK(Math.sin(th0 / 2));
            worst = Math.max(worst, Math.abs(arrive[i] - t));
          });
          rows.push({ label: 'largest |t − √(L/g)·K(sin(θ₀/2))| over the beads', value: all ? worst.toExponential(3) : 'after the run' },
            { label: 'small-swing quarter period (π/2)√(L/g)', value: ((Math.PI / 2) * Math.sqrt(L / G)).toFixed(9) });
        }
      }
      rows.push(
        experiment === 'incline'
          ? { label: 'energy balance |ΔE + friction work| / g|Δy|, largest, numerics', value: drift.toExponential(2) }
          : { label: 'largest energy error |ΔE/E₀|, numerics', value: drift.toExponential(2) },
        { label: 'largest distance from the track |y − f(x)|, numerics', value: gap.toExponential(2) },
        { label: 'largest speed off the track |v·n̂|, numerics', value: vn.toExponential(2) },
      );
      if (lost) rows.push({ label: 'a bead left the drawn track', value: 'yes: the run is outside the track' });
      return rows;
    }

    return {
      setup,
      pace: () => pacer.report(sample >= SAMPLES, params),
      draw() {
        const take = ctx.thumbnail ? 40 : pacer.take(params);
        for (let k = 0; k < take && sample < SAMPLES; k++) advance();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // the track and its beads, on the left
        const bx = W * 0.04;
        const bw = W * 0.48;
        const by = H * 0.12;
        const bh = H * 0.76;
        const xs = [track.lo, track.hi];
        const ys: number[] = [];
        for (let k = 0; k <= 200; k++) ys.push(track.f(xs[0] + ((xs[1] - xs[0]) * k) / 200));
        const ylo = Math.min(...ys);
        const yhi = Math.max(...ys);
        const scale = Math.min(bw / (xs[1] - xs[0]), bh / Math.max(1e-9, yhi - ylo));
        const ox = bx + (bw - scale * (xs[1] - xs[0])) / 2;
        const X = (x: number) => ox + (x - xs[0]) * scale;
        const Y = (y: number) => by + bh - (y - ylo) * scale;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.55), 1);
        g.lineWidth = 2;
        g.beginPath();
        for (let k = 0; k <= 200; k++) {
          const x = xs[0] + ((xs[1] - xs[0]) * k) / 200;
          if (k === 0) g.moveTo(X(x), Y(track.f(x))); else g.lineTo(X(x), Y(track.f(x)));
        }
        g.stroke();
        beads.forEach((b, i) => {
          g.fillStyle = rgba(ramp(pal, beads.length > 1 ? i / (beads.length - 1) : 0.7), 1);
          g.beginPath();
          g.arc(X(b.x), Y(b.y), 6, 0, 2 * Math.PI);
          g.fill();
        });
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText(experiment === 'incline' ? `θ = ${num(params, 'angle')}°, μ = ${mu.toFixed(2)}` : `${shape}, g = 1, R = 1`, bx, by - 8);
        // what the plate measures, over time, on the right
        const x0 = W * 0.58;
        const w = W * 0.38;
        const y0 = H * 0.15;
        const h = H * 0.7;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.lineWidth = 1;
        g.strokeRect(x0, y0, w, h);
        let lo = Infinity;
        let hi = -Infinity;
        if (experiment === 'incline') {
          lo = 0;
          hi = Math.max(1e-9, 0.5 * Math.max(0, G * (Math.sin(theta) - mu * Math.cos(theta))) * T * T, ...paths[0]);
        } else {
          start.forEach((s) => { lo = Math.min(lo, s); hi = Math.max(hi, -s); });
        }
        const yOf = (v: number) => y0 + h - ((v - lo) / Math.max(1e-12, hi - lo)) * h;
        if (experiment === 'incline') {
          const a = Math.max(0, G * (Math.sin(theta) - mu * Math.cos(theta)));
          g.setLineDash([4, 3]);
          g.strokeStyle = rgba(fg, 0.7);
          g.beginPath();
          for (let k = 0; k <= 100; k++) {
            const t = (k / 100) * T;
            if (k === 0) g.moveTo(x0, yOf(0)); else g.lineTo(x0 + (k / 100) * w, yOf(0.5 * a * t * t));
          }
          g.stroke();
          g.setLineDash([]);
        } else {
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.4), 1);
          g.beginPath();
          g.moveTo(x0, yOf(0));
          g.lineTo(x0 + w, yOf(0));
          g.stroke();
          if (shape === 'cycloid') {
            g.setLineDash([4, 3]);
            g.strokeStyle = rgba(fg, 0.7);
            for (const q of [1, 3]) {
              const xx = x0 + ((q * Math.PI * Math.sqrt(R / G)) / T) * w;
              g.beginPath();
              g.moveTo(xx, y0);
              g.lineTo(xx, y0 + h);
              g.stroke();
            }
            g.setLineDash([]);
          }
        }
        paths.forEach((path, i) => {
          g.strokeStyle = rgba(ramp(pal, beads.length > 1 ? i / (beads.length - 1) : 0.7), 1);
          g.lineWidth = 1.5;
          g.beginPath();
          path.forEach((v, k) => { const xx = x0 + (k / SAMPLES) * w; if (k === 0) g.moveTo(xx, yOf(v)); else g.lineTo(xx, yOf(v)); });
          g.stroke();
        });
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(experiment === 'incline' ? 'distance slid s(t) (solid), ½at² closed form (dashed)'
          : shape === 'cycloid' ? 'x(t) of each bead; dashed: t = π√(R/g) and 3π√(R/g)' : 'x(t) of each bead', x0, y0 - 8);
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default constrainedMotion;
