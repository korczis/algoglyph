import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import {
  absorbed, agmK, beatPeriod, criticalMinimum, lockIn, pendulumPeriod, ringDownRate, steadyClosedForm, widthOf,
  type Oscillator,
} from '../_shared/lumped/oscillator';

type Mode = 'driven' | 'resonance' | 'critical' | 'pendulum' | 'coupled';

/** The natural frequency, fixed: every other frequency is given over it. */
export const OMEGA0 = 2;
/** Samples of a replayed trajectory, and frequencies of a resonance sweep. */
export const SAMPLES = 600;
export const SWEEP = 61;
const when = (...values: Mode[]) => ({ key: 'mode', values });

export const drivenOscillator: PlateCode = {
  id: 'driven-oscillator',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Experiment', value: 'driven', rebuild: true,
      options: [
        { value: 'driven', label: 'Driven and damped: the steady state' },
        { value: 'resonance', label: 'A resonance sweep, and the ring-down' },
        { value: 'critical', label: 'Released: under, critically or over damped' },
        { value: 'pendulum', label: 'A pendulum at large amplitude' },
        { value: 'coupled', label: 'Two coupled oscillators' },
      ],
    },
    { kind: 'range', key: 'w', label: 'Drive frequency ω over ω₀', min: 0.2, max: 2, step: 0.05, value: 0.95,
      rebuild: true, when: when('driven') },
    { kind: 'range', key: 'Q', label: 'Quality factor Q = ω₀/γ', min: 1, max: 25, step: 0.5, value: 10,
      rebuild: true, when: when('driven', 'resonance') },
    { kind: 'range', key: 'zeta', label: 'Damping ratio ζ = γ/2ω₀', min: 0.1, max: 2, step: 0.05, value: 1,
      rebuild: true, when: when('critical') },
    { kind: 'range', key: 'theta', label: 'Release angle θ₀ (°)', min: 5, max: 175, step: 5, value: 150,
      rebuild: true, when: when('pendulum') },
    { kind: 'range', key: 'kappa', label: 'Coupling κ over ω₀²', min: 0.02, max: 0.5, step: 0.01, value: 0.1,
      rebuild: true, when: when('coupled') },
    paceParam(),
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    // a replay takes up to SAMPLES samples a frame; a sweep at most one frequency (one lock-in) a frame
    let pacer = new Pacer('replay', 'samples', SAMPLES);
    let mode: Mode = 'driven';
    let osc: Oscillator;
    /** A trajectory recorded once, replayed sample by sample: [t, x, (x₂)]. */
    let traj: [number, number, number][] = [];
    let shown = 0;
    let length = SAMPLES;
    let sweepW: number[] = [];
    let sweepP: number[] = [];
    let rows: Stat[] = [];
    let ring = Number.NaN;

    const decimate = (all: [number, number, number][]) => {
      const out: [number, number, number][] = [];
      for (let i = 0; i < SAMPLES; i++) out.push(all[Math.floor((i * (all.length - 1)) / (SAMPLES - 1))]);
      return out;
    };

    function setup() {
      mode = str(params, 'mode') as Mode;
      pacer = mode === 'resonance' ? new Pacer('replay', 'frequencies', 1) : new Pacer('replay', 'samples', SAMPLES);
      const Q = num(params, 'Q');
      osc = { m: 1, omega0: OMEGA0, gamma: OMEGA0 / Q, F0: 1, pendulum: false };
      traj = [];
      shown = 0;
      sweepW = [];
      sweepP = [];
      ring = Number.NaN;
      const all: [number, number, number][] = [];
      if (mode === 'driven') {
        const w = num(params, 'w') * OMEGA0;
        // the readouts are the lock-in over twenty whole periods of the integrated run; the trace shows
        // ten periods of the steady state it measured, x = A cos(ωt − φ)
        const s = lockIn(osc, w);
        for (let i = 0; i < SAMPLES; i++) {
          const t = (i / SAMPLES) * ((10 * 2 * Math.PI) / w);
          all.push([t, s.amplitude * Math.cos(w * t - s.phase), Math.cos(w * t)]);
        }
        traj = all;
        length = SAMPLES;
        rows = [
          { label: 'drive ω over ω₀', value: num(params, 'w').toFixed(3) },
          { label: 'quality factor Q = ω₀/γ', value: Q.toFixed(2) },
          { label: 'amplitude, lock-in over 20 periods', value: s.amplitude.toFixed(7) },
          { label: 'amplitude, closed form (F₀/m)/√((ω₀² − ω²)² + γ²ω²)', value: steadyClosedForm(osc, w).amplitude.toFixed(7) },
          { label: 'phase lag, lock-in (rad)', value: s.phase.toFixed(7) },
          { label: 'phase lag, closed form atan2(γω, ω₀² − ω²)', value: steadyClosedForm(osc, w).phase.toFixed(7) },
        ];
      } else if (mode === 'resonance') {
        length = SWEEP;
        rows = [];
      } else if (mode === 'critical') {
        const zeta = num(params, 'zeta');
        const least = criticalMinimum({ ...osc, gamma: 2 * zeta * OMEGA0 }, (t, x) => all.push([t, x, 0]));
        traj = decimate(all);
        length = SAMPLES;
        rows = [
          { label: 'damping ratio ζ = γ/2ω₀', value: zeta.toFixed(3) },
          { label: 'least x after release from x = 1, measured', value: least.toExponential(4) },
          { label: 'first undershoot in closed form, −exp(−ζπ/√(1 − ζ²))', value: zeta < 1 ? (-Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta))).toExponential(4) : 'none for ζ ≥ 1' },
          { label: 'regime', value: zeta < 1 ? 'underdamped: it overshoots' : zeta === 1 ? 'critical: the fastest return without overshoot' : 'overdamped: slow, no overshoot' },
        ];
      } else if (mode === 'pendulum') {
        const th = (num(params, 'theta') * Math.PI) / 180;
        const T = pendulumPeriod({ ...osc, pendulum: true }, th, (t, x) => all.push([t, x, 0]));
        traj = decimate(all.filter(([t]) => t <= 2.2 * T));
        length = SAMPLES;
        rows = [
          { label: 'release angle θ₀ (°)', value: num(params, 'theta').toFixed(1) },
          { label: 'period, measured from zero crossings', value: T.toFixed(7) },
          { label: 'period 4K(sin θ₀/2)/ω₀, K by the arithmetic-geometric mean', value: ((4 * agmK(Math.sin(th / 2))) / OMEGA0).toFixed(7) },
          { label: 'small-angle period 2π/ω₀', value: ((2 * Math.PI) / OMEGA0).toFixed(7) },
        ];
      } else {
        const kappa = num(params, 'kappa') * OMEGA0 * OMEGA0;
        const T = beatPeriod(OMEGA0, kappa, (t, a, b) => all.push([t, a, b]));
        const w2 = Math.sqrt(OMEGA0 * OMEGA0 + 2 * kappa);
        traj = decimate(all);
        length = SAMPLES;
        rows = [
          { label: 'normal modes ω₁ = ω₀ and ω₂ = √(ω₀² + 2κ)', value: `${OMEGA0.toFixed(4)}, ${w2.toFixed(4)}` },
          { label: 'beat period, measured from the envelope', value: T.toFixed(5) },
          { label: 'beat period 2π/(ω₂ − ω₁)', value: ((2 * Math.PI) / (w2 - OMEGA0)).toFixed(5) },
        ];
      }
      pacer.start(length);
    }

    function sweepRows(): Stat[] {
      const done = sweepW.length >= SWEEP;
      const out: Stat[] = [
        { label: 'frequencies swept', value: `${sweepW.length} of ${SWEEP}, ω₀ ± 3γ` },
        { label: 'quality factor set, Q = ω₀/γ', value: (OMEGA0 / osc.gamma).toFixed(4) },
      ];
      if (!done) return out;
      const width = widthOf(sweepW, sweepP);
      out.push(
        { label: 'width of the absorbed power at half maximum, measured', value: width.toFixed(6) },
        { label: 'γ, the width in closed form', value: osc.gamma.toFixed(6) },
        { label: 'Q from the width, ω₀/Δω', value: (OMEGA0 / width).toFixed(4) },
        { label: 'Q from the ring-down, ω₀/(2 × decay rate of the peaks)', value: (OMEGA0 / (2 * ring)).toFixed(4) },
      );
      return out;
    }

    return {
      setup,
      pace: () => pacer.report(mode === 'resonance' ? sweepW.length >= SWEEP : shown >= length, params),
      draw() {
        const take = ctx.thumbnail ? 20 : pacer.take(params);
        for (let k = 0; k < take; k++) {
          if (mode === 'resonance') {
            if (sweepW.length >= SWEEP) break;
            const i = sweepW.length;
            const w = osc.omega0 - 3 * osc.gamma + (6 * osc.gamma * i) / (SWEEP - 1);
            sweepW.push(w);
            sweepP.push(absorbed(osc, w, lockIn(osc, w).amplitude));
            if (sweepW.length === SWEEP) {
              const all: [number, number, number][] = [];
              ring = ringDownRate(osc, (t, x) => all.push([t, x, 0]));
              traj = decimate(all);
            }
          } else if (shown < length) shown++;
        }
        if (mode === 'resonance') rows = sweepRows();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        const box = (x0: number, y0: number, w: number, h: number, title: string) => {
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(x0, y0, w, h);
          g.fillStyle = rgba(fg, 0.75);
          g.fillText(title, x0, y0 - 6);
        };
        if (mode === 'resonance') {
          const x0 = W * 0.06;
          const w = W * 0.42;
          const y0 = H * 0.12;
          const h = H * 0.76;
          box(x0, y0, w, h, 'absorbed power against ω (dots) and its half maximum');
          const pmax = Math.max(1e-12, ...sweepP);
          g.fillStyle = rgba(ramp(pal, 0.8), 1);
          sweepW.forEach((ww, i) => {
            const xx = x0 + ((ww - (osc.omega0 - 3 * osc.gamma)) / (6 * osc.gamma)) * w;
            const yy = y0 + h - (sweepP[i] / pmax) * h * 0.95;
            g.fillRect(xx - 2, yy - 2, 4, 4);
          });
          g.strokeStyle = rgba(fg, 0.6);
          g.setLineDash([4, 3]);
          g.beginPath();
          g.moveTo(x0, y0 + h - 0.5 * h * 0.95);
          g.lineTo(x0 + w, y0 + h - 0.5 * h * 0.95);
          g.stroke();
          g.setLineDash([]);
          if (traj.length) {
            const bx = W * 0.54;
            const bw = W * 0.42;
            box(bx, y0, bw, h, 'the ring-down, released from x = 1');
            g.strokeStyle = rgba(ramp(pal, 0.4), 1);
            g.beginPath();
            traj.forEach(([, xv], i) => { const xx = bx + (i / (traj.length - 1)) * bw; const yy = y0 + h / 2 - xv * h * 0.45; if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); });
            g.stroke();
          }
        } else {
          const x0 = W * 0.06;
          const w = W * 0.88;
          const y0 = H * 0.12;
          const h = H * 0.76;
          const title = mode === 'driven' ? 'x(t) in the steady state (solid) and the drive (dashed)'
            : mode === 'coupled' ? 'x₁ (solid) and x₂ (dashed): the energy beats across'
              : mode === 'pendulum' ? 'θ(t) released at θ₀' : 'x(t) released from x = 1';
          box(x0, y0, w, h, title);
          const scale = Math.max(1e-9, ...traj.map(([, a, b]) => Math.max(Math.abs(a), mode === 'pendulum' || mode === 'critical' ? 0 : Math.abs(b))));
          const lines: [number, string, number[]][] = [[1, rgba(ramp(pal, 0.8), 1), []]];
          if (mode === 'driven' || mode === 'coupled') lines.push([2, rgba(fg, 0.6), [4, 3]]);
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.2), 1);
          g.beginPath();
          g.moveTo(x0, y0 + h / 2);
          g.lineTo(x0 + w, y0 + h / 2);
          g.stroke();
          for (const [k, colour, dash] of lines) {
            g.strokeStyle = colour;
            g.setLineDash(dash);
            g.lineWidth = 1.4;
            g.beginPath();
            for (let i = 0; i < Math.min(shown, traj.length); i++) {
              const v = k === 2 && mode === 'driven' ? traj[i][2] * scale * 0.5 : traj[i][k];
              const xx = x0 + (i / (traj.length - 1)) * w;
              const yy = y0 + h / 2 - (v / scale) * h * 0.45;
              if (i === 0) g.moveTo(xx, yy);
              else g.lineTo(xx, yy);
            }
            g.stroke();
          }
          g.setLineDash([]);
        }
        g.restore();
        ctx.stats([pacer.row(params), ...rows]);
      },
    };
  },
};

export default drivenOscillator;
