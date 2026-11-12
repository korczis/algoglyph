import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { potentialOf, Walkers, type PotentialKind } from '../_shared/ensemble/langevin';
import { erf, ksBound, ksDistance } from '../_shared/two-slit/math';
import { rgba } from '../_shared/two-slit/draw';

/** Steps of a run (the counted changes: every walker moves once a step). */
export const STEPS = 1200;
/** The most steps a frame takes, at the pace control's top: the frame the budget measures. */
export const MAX_PER_FRAME = 40;
/** Time step per preset: small enough that dt·|U″|/γ stays far below 1. */
const DT: Record<PotentialKind, number> = { flat: 0.01, harmonic: 0.01, gravity: 0.005, tilt: 0.01, ratchet: 0.002 };
const BINS = 48;
const notFlat = { key: 'preset', values: ['harmonic', 'gravity', 'tilt', 'ratchet'] };
const pm = (v: number, se: number, d = 4) => `${v.toFixed(d)} ± ${se.toFixed(d)}`;

export const brownianWalkers: PlateCode = {
  id: 'brownian-walkers',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'preset', label: 'Landscape', value: 'flat', rebuild: true,
      options: [
        { value: 'flat', label: 'Flat, in a plane (diffusion)' },
        { value: 'harmonic', label: 'A harmonic well' },
        { value: 'gravity', label: 'Gravity above a floor' },
        { value: 'tilt', label: 'A uniform tilt (a force)' },
        { value: 'ratchet', label: 'An asymmetric ratchet' },
      ],
    },
    { kind: 'range', key: 'n', label: 'Walkers', min: 50, max: 4000, step: 50, value: 300, rebuild: true },
    { kind: 'range', key: 'kT', label: 'Temperature kT', min: 0.25, max: 4, step: 0.25, value: 1, rebuild: true },
    { kind: 'range', key: 'gamma', label: 'Friction γ', min: 0.5, max: 5, step: 0.5, value: 1, rebuild: true },
    { kind: 'range', key: 'strength', label: 'Stiffness k, weight mg, force F or ratchet height', min: 0.25,
      max: 5, step: 0.25, value: 2, rebuild: true, when: notFlat },
    paceParam(),
    paletteParam('phosphor'),
  ],
  pace: { kind: 'replay', unit: 'steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'steps', MAX_PER_FRAME);
    let preset: PotentialKind = 'flat';
    let w: Walkers;
    let msdHistory: [number, number][] = [];
    let steps = 0;
    let rows: Stat[] = [];

    function measure(): Stat[] {
      const out: Stat[] = [pacer.row(params)];
      const D = w.D;
      const kT = num(params, 'kT');
      const gamma = num(params, 'gamma');
      const s = num(params, 'strength');
      const done = steps >= STEPS;
      out.push(
        { label: 'steps', value: `${steps} of ${STEPS}, dt ${DT[preset]}` },
        { label: 'diffusion constant D = kT/γ (Einstein)', value: D.toFixed(6) },
      );
      if (!done) return out;
      if (preset === 'flat') {
        const ratio = w.msd() / (4 * D * w.t);
        const n = msdHistory.length;
        let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
        for (const [t, m] of msdHistory) { sx += t; sy += m; sxx += t * t; sxy += t * m; }
        const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        out.push(
          { label: 'MSD over 4Dt at the end', value: pm(ratio, 1 / Math.sqrt(w.n)) },
          { label: 'MSD slope over 4D, fitted over the run', value: (slope / (4 * D)).toFixed(4) },
        );
      } else if (preset === 'harmonic') {
        const xs = w.positions();
        const mean = xs.reduce((a, b) => a + b, 0) / w.n;
        const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.n - 1);
        const expected = (kT / s) / (1 - (s * DT[preset]) / (2 * gamma));
        const sd = Math.sqrt(expected);
        out.push(
          { label: 'variance of the positions', value: variance.toFixed(5) },
          { label: 'Boltzmann variance kT/k, with the scheme’s dt correction', value: expected.toFixed(5) },
          { label: 'KS distance from the Boltzmann distribution', value: ksDistance(xs, (x) => 0.5 * (1 + erf(x / (sd * Math.SQRT2)))).toFixed(5) },
          { label: 'KS 95 % bound, 1.36/√N', value: ksBound(w.n).toFixed(5) },
        );
      } else if (preset === 'gravity') {
        const xs = w.positions();
        const mean = xs.reduce((a, b) => a + b, 0) / w.n;
        const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.n - 1));
        out.push(
          { label: 'mean height, measured', value: pm(mean, sd / Math.sqrt(w.n)) },
          { label: 'scale height kT/mg', value: (kT / s).toFixed(4) },
        );
      } else {
        const d = w.drift();
        out.push({ label: 'drift velocity, measured', value: pm(d.mean, d.se) });
        if (preset === 'tilt') out.push({ label: 'drift velocity F/γ = (D/kT)F', value: (s / gamma).toFixed(4) });
        else out.push({ label: 'drift in standard errors', value: (d.mean / d.se).toFixed(3) });
      }
      return out;
    }

    return {
      setup() {
        preset = str(params, 'preset') as PotentialKind;
        const rnd = mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1);
        w = new Walkers({
          n: num(params, 'n'), dims: preset === 'flat' ? 2 : 1, kT: num(params, 'kT'), gamma: num(params, 'gamma'),
          dt: DT[preset], potential: potentialOf(preset, preset === 'flat' ? 0 : num(params, 'strength')),
        }, rnd);
        msdHistory = [];
        steps = 0;
        pacer.start(STEPS);
        rows = measure();
      },
      pace: () => pacer.report(steps >= STEPS, params),
      draw() {
        const take = ctx.thumbnail ? 20 : pacer.take(params);
        for (let k = 0; k < take && steps < STEPS; k++) {
          w.step();
          steps++;
          if (preset === 'flat') msdHistory.push([w.t, w.msd()]);
          if (steps >= STEPS) rows = measure();
        }
        if (steps < STEPS) rows = measure();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        const dot = rgba(ramp(pal, 0.75), 0.75);
        if (preset === 'flat') {
          // walkers in the plane, and the circle of radius √(4Dt) Einstein predicts
          const cx = W * 0.35;
          const cy = H / 2;
          const scale = Math.min(W, H) * 0.42 / Math.sqrt(4 * w.D * DT.flat * STEPS) / 1.6;
          g.fillStyle = dot;
          for (let i = 0; i < w.n; i++) g.fillRect(cx + w.x[2 * i] * scale - 1, cy - w.x[2 * i + 1] * scale - 1, 2, 2);
          g.strokeStyle = rgba(fg, 0.7);
          g.setLineDash([4, 3]);
          g.beginPath();
          g.arc(cx, cy, Math.sqrt(4 * w.D * w.t) * scale, 0, 2 * Math.PI);
          g.stroke();
          g.setLineDash([]);
          // MSD against time, and the line 4Dt
          const x0 = W * 0.68;
          const pw = W * 0.28;
          const y0 = H * 0.15;
          const ph = H * 0.7;
          const tMax = DT.flat * STEPS;
          const mMax = 4 * w.D * tMax * 1.3;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(x0, y0, pw, ph);
          g.strokeStyle = rgba(fg, 0.7);
          g.setLineDash([4, 3]);
          g.beginPath();
          g.moveTo(x0, y0 + ph);
          g.lineTo(x0 + pw, y0 + ph - ((4 * w.D * tMax) / mMax) * ph);
          g.stroke();
          g.setLineDash([]);
          g.strokeStyle = rgba(ramp(pal, 0.9), 1);
          g.beginPath();
          msdHistory.forEach(([t, m], k) => {
            const xx = x0 + (t / tMax) * pw;
            const yy = y0 + ph - (m / mMax) * ph;
            if (k === 0) g.moveTo(xx, yy);
            else g.lineTo(xx, yy);
          });
          g.stroke();
          g.fillStyle = rgba(fg, 0.75);
          g.font = '11px monospace';
          g.fillText('MSD (solid) and 4Dt (dashed)', x0, y0 - 8);
        } else {
          // positions along the axis, a histogram of them, and the Boltzmann curve e^(−U/kT)
          const xs = w.positions();
          const span = preset === 'gravity' ? [0, 5 * (num(params, 'kT') / num(params, 'strength'))]
            : preset === 'harmonic' ? [-4 * Math.sqrt(num(params, 'kT') / num(params, 'strength')), 4 * Math.sqrt(num(params, 'kT') / num(params, 'strength'))]
              : [Math.min(...xs) - 0.5, Math.max(...xs) + 0.5];
          const px = (x: number) => W * 0.06 + ((x - span[0]) / (span[1] - span[0])) * W * 0.88;
          const hist = new Float64Array(BINS);
          for (const x of xs) {
            const b = Math.floor(((x - span[0]) / (span[1] - span[0])) * BINS);
            if (b >= 0 && b < BINS) hist[b]++;
          }
          const peak = Math.max(1, ...hist);
          const base = H * 0.62;
          const hh = H * 0.45;
          g.fillStyle = rgba(ramp(pal, 0.5), 0.5);
          for (let b = 0; b < BINS; b++) {
            const x = px(span[0] + (b / BINS) * (span[1] - span[0]));
            const bw = (W * 0.88) / BINS;
            g.fillRect(x, base - (hist[b] / peak) * hh, Math.max(1, bw - 1), (hist[b] / peak) * hh);
          }
          const pot = potentialOf(preset, num(params, 'strength'));
          const kT = num(params, 'kT');
          if (preset === 'harmonic' || preset === 'gravity') {
            // the Boltzmann density, scaled to the histogram's peak bin
            let zmax = 0;
            const pts: [number, number][] = [];
            for (let k = 0; k <= 200; k++) {
              const x = span[0] + (k / 200) * (span[1] - span[0]);
              const v = Math.exp(-pot.U(x) / kT);
              zmax = Math.max(zmax, v);
              pts.push([x, v]);
            }
            g.strokeStyle = rgba(fg, 0.85);
            g.setLineDash([4, 3]);
            g.beginPath();
            pts.forEach(([x, v], k) => { const yy = base - (v / zmax) * hh; if (k === 0) g.moveTo(px(x), yy); else g.lineTo(px(x), yy); });
            g.stroke();
            g.setLineDash([]);
          }
          // the potential itself, under the axis
          g.strokeStyle = rgba(ramp(pal, 0.9), 0.9);
          g.beginPath();
          let umin = Infinity;
          let umax = -Infinity;
          for (let k = 0; k <= 200; k++) { const u = pot.U(span[0] + (k / 200) * (span[1] - span[0])); umin = Math.min(umin, u); umax = Math.max(umax, u); }
          for (let k = 0; k <= 400; k++) {
            const x = span[0] + (k / 400) * (span[1] - span[0]);
            const yy = H * 0.95 - ((pot.U(x) - umin) / Math.max(1e-9, umax - umin)) * H * 0.22;
            if (k === 0) g.moveTo(px(x), yy);
            else g.lineTo(px(x), yy);
          }
          g.stroke();
          g.fillStyle = dot;
          for (let i = 0; i < Math.min(w.n, 600); i++) g.fillRect(px(xs[i]) - 1, base + 6 + ((i * 37) % 40) * 0.3, 2, 2);
        }
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default brownianWalkers;
