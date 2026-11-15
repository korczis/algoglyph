// The fields of a moving charge, from its retarded position (src/plates/_shared/em/lienard-wiechert.ts):
// a charge in uniform motion against Heaviside's field, an oscillating one radiating Larmor's power
// in a sin²θ pattern and Doppler-shifted when carried along, a circling one radiating Liénard's
// power, and a kicked one sending out Purcell's kink. Units c = 1, q/4πε₀ = 1.
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  circular, fields, heaviside, kick, oscillating, retardedTime, sphereFlux, uniform, type V3, type Worldline,
} from '../_shared/em/lienard-wiechert';
import { rgba } from '../_shared/two-slit/draw';

/** Time steps of a run; the map is drawn at the run's time, from its start to its end. */
export const STEPS = 600;
export const MAX_PER_FRAME = 20;
/** The oscillator's angular frequency in its own frame: one period per unit of proper time. */
const OMEGA0 = 2 * Math.PI;
/** Half the height of the view. */
const VIEW = 4;
const MAP_Y = 36;
const ARROWS_Y = 12;

type Motion = 'uniform' | 'oscillating' | 'circular' | 'kick';
const sci = (v: number) => v.toExponential(2);
const f9 = (v: number) => v.toFixed(9);

/** The worldline a motion's controls describe, and the run's span of time. */
export function worldlineOf(motion: Motion, beta: number, drift: number): { w: Worldline; t0: number; t1: number } {
  if (motion === 'uniform') return { w: uniform(beta), t0: -4, t1: 4 };
  if (motion === 'circular') return { w: circular(1, beta), t0: 0, t1: (2 * 2 * Math.PI) / beta };
  if (motion === 'kick') return { w: kick(beta / 0.5, 0.5), t0: -0.5, t1: 6 };
  const gamma = 1 / Math.sqrt(1 - drift * drift);
  // the oscillator keeps its own frequency ω₀ and peak speed β; carried at V, a lab clock sees it
  // slowed to ω₀/γ and its transverse speed to β/γ, so the amplitude β/ω₀ is the same in both frames
  const omega = OMEGA0 / gamma;
  return { w: oscillating(beta / OMEGA0, omega, drift), t0: -2, t1: 4 };
}

/**
 * The power through a sphere of radius Rs averaged over k equally spaced times of one period, one
 * time a frame (each is n × n field points); `finish` turns the mean power and the mean pattern
 * dP/dΩ on each ring of cos θ into readouts once the last time is in.
 */
export function powerJob(w: Worldline, Rs: number, period: number, k: number, n: number,
  finish: (power: number, pattern: { mu: number; dP: number }[]) => Stat[]): { step(): void; rows(): Stat[]; done(): boolean } {
  let i = 0;
  let power = 0;
  const pattern = new Map<number, number>();
  let out: Stat[] | null = null;
  return {
    step() {
      if (out) return;
      const f = sphereFlux(w, Rs, Rs + (period * i) / k, n, n);
      power += f.power / k;
      for (const r of f.rings) pattern.set(r.mu, (pattern.get(r.mu) ?? 0) + r.dP / k);
      i++;
      if (i === k) out = finish(power, [...pattern].map(([mu, dP]) => ({ mu, dP })));
    },
    rows: () => out ?? [{ label: 'power through a sphere, being measured', value: `${i} of ${k} times of a period` }],
    done: () => out !== null,
  };
}

/** Liénard's power (2/3)γ⁶(a² − (v × a)²), averaged over one period of emission time by the trapezoid. */
export function lienardMean(w: Worldline, period: number, k = 256): number {
  let s = 0;
  for (let i = 0; i < k; i++) {
    const { v, a } = w.at((period * i) / k);
    const v2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
    const a2 = a[0] ** 2 + a[1] ** 2 + a[2] ** 2;
    const c: V3 = [v[1] * a[2] - v[2] * a[1], v[2] * a[0] - v[0] * a[2], v[0] * a[1] - v[1] * a[0]];
    const g6 = (1 / (1 - v2)) ** 3;
    s += (2 / 3) * g6 * (a2 - (c[0] ** 2 + c[1] ** 2 + c[2] ** 2));
  }
  return s / k;
}

/** The mean period of E_y at x between its upward zero crossings, over `count` periods from t. */
export function observedPeriod(w: Worldline, x: V3, t: number, guess: number, count = 6): number {
  const ey = (s: number) => fields(w, x, s).E[1];
  const crossings: number[] = [];
  const h = guess / 40;
  let s = t;
  let prev = ey(s);
  while (crossings.length < count + 1 && s < t + guess * (count + 3)) {
    const next = ey(s + h);
    if (prev < 0 && next >= 0) {
      let lo = s; let hi = s + h;
      for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (ey(mid) < 0) lo = mid; else hi = mid; }
      crossings.push((lo + hi) / 2);
    }
    s += h;
    prev = next;
  }
  return (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
}

export const retardedFields: PlateCode = {
  id: 'retarded-fields',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'motion', label: 'Motion', value: 'oscillating', rebuild: true,
      options: [
        { value: 'oscillating', label: 'Oscillating (an antenna), perhaps carried along' },
        { value: 'uniform', label: 'Uniform motion' },
        { value: 'circular', label: 'On a circle (a synchrotron)' },
        { value: 'kick', label: 'At rest, then kicked' },
      ],
    },
    // the speed stops short of light, where the retarded time is no longer unique and the fields diverge
    { kind: 'range', key: 'beta', label: 'Speed v/c (peak, steady or final)', min: 0.05, max: 0.9, step: 0.05, value: 0.3, rebuild: true },
    { kind: 'range', key: 'drift', label: 'Carried along x at V/c', min: 0, max: 0.6, step: 0.05, value: 0, rebuild: true,
      when: { key: 'motion', values: ['oscillating'] } },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'time steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'time steps', MAX_PER_FRAME);
    let motion: Motion = 'oscillating';
    let w: Worldline;
    let t0 = 0;
    let t1 = 1;
    let steps = 0;
    let fixed: Stat[] = [];
    let rows: Stat[] = [];
    /** The radiated power's measurement, one time of the period a frame. */
    let job: ReturnType<typeof powerJob> | null = null;

    function analyse(): Stat[] {
      const beta = num(params, 'beta');
      const out: Stat[] = [];
      // the retarded time's own equation, at a spread of points and times (numerics)
      let residual = 0;
      for (let i = 0; i < 40; i++) {
        const x: V3 = [((i % 8) - 3.5) * 0.9, (Math.floor(i / 8) - 2) * 1.1, 0.3];
        const t = t0 + ((t1 - t0) * i) / 40;
        const tr = retardedTime(w, x, t);
        const r = w.at(tr).r;
        residual = Math.max(residual, Math.abs(t - tr - Math.hypot(x[0] - r[0], x[1] - r[1], x[2] - r[2])));
      }
      out.push({ label: 'largest |t − t_r − |r − r_s(t_r)|| (numerics)', value: sci(residual) });
      if (motion === 'uniform') {
        let worst = 0;
        for (let i = 0; i < 60; i++) {
          const x: V3 = [((i % 10) - 4.5) * 0.7, (Math.floor(i / 10) - 2.5) * 0.9, 0.2];
          const a = fields(w, x, 0.7).E;
          const b = heaviside(beta, x, 0.7);
          worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.hypot(...b));
        }
        const ahead = fields(w, [2, 0, 0], 0).E[0];
        const beside = fields(w, [0, 2, 0], 0).E[1];
        out.push(
          { label: 'largest |E − E_Heaviside|/|E| over sixty points', value: sci(worst) },
          { label: 'field ahead over field beside, at equal present distance', value: f9(ahead / beside) },
          { label: 'Heaviside’s flattening (1 − β²)^(3/2)', value: f9((1 - beta * beta) ** 1.5) },
        );
      } else if (motion === 'oscillating') {
        const V = num(params, 'drift');
        const gamma = 1 / Math.sqrt(1 - V * V);
        const period = (2 * Math.PI) / (OMEGA0 / gamma);
        if (V === 0) {
          const Rs = 12;
          const larmor = lienardMean(w, period);
          job = powerJob(w, Rs, period, 16, 24, (power, pattern) => {
            // dP/dΩ against sin²θ (θ from the oscillation's axis), each scaled to its peak ring
            const peak = Math.max(...pattern.map((r) => r.dP));
            const top = Math.max(...pattern.map((r) => 1 - r.mu * r.mu));
            const departure = Math.max(...pattern.map((r) => Math.abs(r.dP / peak - (1 - r.mu * r.mu) / top)));
            return [
              { label: `power through a sphere of radius ${Rs}, averaged over a period`, value: f9(power) },
              { label: 'Liénard’s (2/3)⟨γ⁶a²⟩, Larmor’s (2/3)⟨a²⟩ at low speed', value: f9(larmor) },
              { label: 'largest departure of dP/dΩ from sin²θ, of its peak', value: departure.toFixed(5) },
            ];
          });
        } else {
          const D = 40;
          const ahead = observedPeriod(w, [D, 0, 0], D + 2, period * (1 - V));
          const behind = observedPeriod(w, [-D, 0, 0], D + 2, period * (1 + V));
          out.push(
            { label: 'frequency ahead over the source’s own, measured', value: f9(1 / ahead) },
            { label: 'relativistic Doppler 1/(γ(1 − β)), ahead', value: f9(1 / (gamma * (1 - V))) },
            { label: 'frequency ahead over behind, measured', value: f9(behind / ahead) },
            { label: '(1 + β)/(1 − β)', value: f9((1 + V) / (1 - V)) },
          );
        }
      } else if (motion === 'circular') {
        const period = (2 * Math.PI) / beta;
        const g = 1 / (1 - beta * beta);
        const lienard = lienardMean(w, period);
        // the beamed pattern of a circling charge wants a finer sphere than the antenna's
        job = powerJob(w, 12, period, 16, 48, (power) => [
          { label: 'power through a sphere of radius 12, averaged over a turn', value: f9(power) },
          { label: 'Liénard’s (2/3)⟨γ⁶(a² − (v × a)²)⟩', value: f9(lienard) },
          { label: 'synchrotron (2/3)γ⁴a², a = β²/ρ', value: f9((2 / 3) * g * g * beta ** 4) },
        ]);
      } else {
        out.push({ label: 'the kink: between the light fronts from the kick’s start and end', value: 'radii t and t − 0.5' });
      }
      return out;
    }

    function measure(): Stat[] {
      const t = t0 + ((t1 - t0) * steps) / STEPS;
      return [pacer.row(params), { label: 'time steps', value: `${steps} of ${STEPS}, t = ${t.toFixed(3)}` }, ...fixed, ...(job ? job.rows() : [])];
    }

    return {
      setup() {
        motion = str(params, 'motion') as Motion;
        ({ w, t0, t1 } = worldlineOf(motion, num(params, 'beta'), num(params, 'drift')));
        steps = 0;
        pacer.start(STEPS);
        job = null;
        fixed = analyse();
        rows = measure();
      },
      pace: () => pacer.report(steps >= STEPS, params),
      draw() {
        const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
        steps = Math.min(STEPS, steps + take);
        job?.step();
        rows = measure();
        const t = t0 + ((t1 - t0) * steps) / STEPS;
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        const scale = H / (2 * VIEW);
        const X = (x: number) => W / 2 + x * scale;
        const Y = (y: number) => H / 2 - y * scale;
        // |E| on the plane z = 0, on a log scale: the radiation stands out against the Coulomb field
        const cols = Math.round(MAP_Y * (W / H));
        const cw = W / cols;
        const ch = H / MAP_Y;
        for (let j = 0; j < MAP_Y; j++) {
          for (let i = 0; i < cols; i++) {
            const x: V3 = [((i + 0.5) / cols - 0.5) * 2 * VIEW * (W / H), (0.5 - (j + 0.5) / MAP_Y) * 2 * VIEW, 0];
            const E = fields(w, x, t).E;
            const m = Math.log10(Math.max(1e-6, Math.hypot(E[0], E[1], E[2])));
            const v = Math.min(1, Math.max(0, (m + 3) / 3.5));
            g.fillStyle = rgba(mix(ctx.bg, ramp(pal, v), 0.15 + 0.6 * v), 1);
            g.fillRect(i * cw, j * ch, cw + 1, ch + 1);
          }
        }
        // the direction of E
        const step = (2 * VIEW) / ARROWS_Y;
        g.strokeStyle = rgba(fg, 0.55);
        g.lineWidth = 1;
        for (let y = -VIEW + step / 2; y < VIEW; y += step) {
          for (let x = -VIEW * (W / H) + step / 2; x < VIEW * (W / H); x += step) {
            const E = fields(w, [x, y, 0], t).E;
            const a = Math.atan2(E[1], E[0]);
            const len = step * scale * 0.4;
            g.beginPath();
            g.moveTo(X(x) - Math.cos(a) * len, Y(y) + Math.sin(a) * len);
            g.lineTo(X(x) + Math.cos(a) * len, Y(y) - Math.sin(a) * len);
            g.stroke();
          }
        }
        // the charge now, and where it was a light-time ago from the view's corner
        const now = w.at(t).r;
        g.fillStyle = rgba(fg, 1);
        g.beginPath(); g.arc(X(now[0]), Y(now[1]), 5, 0, 2 * Math.PI); g.fill();
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText('|E| on a log scale, and its direction; the charge now (dot)', 10, 16);
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default retardedFields;
