import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import {
  fSum, index, kramersKronig, LockIn, localField, logSlope, lorentz, measuredChi, type Complex, type Medium,
} from '../_shared/lumped/medium';

type Mode = 'one' | 'glass' | 'plasma';

/** The sweep: GRID frequencies kΔ up to TOP ω₀ (a power of two, for the Kramers–Kronig transform). */
export const GRID = 512;
export const TOP = 8;
const STEP = TOP / GRID;
/** Far below the resonance, where Rayleigh's ω⁴ is read; each lock-in costs in proportion to ω₀/ω. */
export const RAYLEIGH = [0.05, 0.06, 0.07, 0.08, 0.1];
/** RK4 steps a frame gives the lock-ins: a slow frequency (high ω, light damping) takes several frames. */
export const STEPS_PER_FRAME = 60_000;
const when = (...values: Mode[]) => ({ key: 'mode', values });
const fx = (x: number, d = 6) => (Number.isFinite(x) ? x.toFixed(d) : 'not measured');

export function mediumOf(mode: Mode, gamma: number, wp2: number, dense: boolean): Medium {
  if (mode === 'glass') {
    // an infrared resonance of the ions' lattice and an ultraviolet one of the electrons, a window between
    return { wp2, dense, resonances: [{ w0: 0.25, f: 0.3, gamma: gamma / 2 }, { w0: 2, f: 0.7, gamma }] };
  }
  if (mode === 'plasma') return { wp2, dense: false, resonances: [{ w0: 0, f: 1, gamma }] };
  return { wp2, dense, resonances: [{ w0: 1, f: 1, gamma }] };
}

export const boundElectronMedium: PlateCode = {
  id: 'bound-electron-medium',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Medium', value: 'one', rebuild: true,
      options: [
        { value: 'one', label: 'One kind of bound electron: a resonance' },
        { value: 'glass', label: 'Glass: an infrared and an ultraviolet resonance' },
        { value: 'plasma', label: 'Free electrons: a plasma or a metal' },
      ],
    },
    // below 0.02 the peak is narrower than two steps of the sweep (Δ = 8/512 ω₀) and the transforms no longer resolve it
    { kind: 'range', key: 'gamma', label: 'Damping γ over ω₀', min: 0.02, max: 0.5, step: 0.01, value: 0.1, rebuild: true },
    { kind: 'range', key: 'wp2', label: 'Plasma frequency squared ω_p²/ω₀² (density)', min: 0.05, max: 3, step: 0.05,
      value: 0.5, rebuild: true },
    { kind: 'toggle', key: 'dense', label: 'Dense: correct for the neighbours’ field (Clausius–Mossotti)', value: false,
      rebuild: true, when: when('one', 'glass') },
    { kind: 'range', key: 'probe', label: 'Light’s frequency ω over ω₀', min: 0.05, max: 4, step: 0.01, value: 0.8, rebuild: true },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'frequencies' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'frequencies', 1);
    let mode: Mode = 'one';
    let medium: Medium = mediumOf('one', 0.1, 0.5, false);
    /** Measured χ on the grid, filled one frequency a frame; then the Rayleigh points. */
    const re = new Float64Array(GRID);
    const im = new Float64Array(GRID);
    let filled = 0;
    let rayleigh: number[] = [];
    let probe = 0.8;
    let atProbe: Complex = { re: 0, im: 0 };
    let rows: Stat[] = [];
    let phase = 0;
    /** The measurement in progress: its frequency, one lock-in per resonance, and where it goes. */
    let current: { w: number; locks: LockIn[]; rayleigh: boolean } | null = null;
    let credit = 0;
    const total = () => GRID + RAYLEIGH.length;

    function setup() {
      mode = str(params, 'mode') as Mode;
      medium = mediumOf(mode, num(params, 'gamma'), num(params, 'wp2'), mode !== 'plasma' && bool(params, 'dense'));
      probe = num(params, 'probe');
      re.fill(0);
      im.fill(0);
      // Im χ is odd in ω, so it is zero at ω = 0, where nothing is driven; the grid is measured from kΔ = Δ on
      filled = 1;
      rayleigh = [];
      current = null;
      credit = 0;
      atProbe = measuredChi(medium, probe);
      pacer.start(total());
      rows = summary();
    }

    /** The next frequency to measure, or null when all are. */
    function next(): { w: number; locks: LockIn[]; rayleigh: boolean } | null {
      if (filled < GRID) {
        const w = filled * STEP;
        return { w, locks: medium.resonances.map((r) => new LockIn(r, w)), rayleigh: false };
      }
      if (rayleigh.length < RAYLEIGH.length) {
        // the power a dipole radiates is ∝ ω⁴|x|², for the main resonance of the medium
        const r = medium.resonances[medium.resonances.length - 1];
        const w = RAYLEIGH[rayleigh.length] * Math.max(r.w0, 1);
        return { w, locks: [new LockIn(r, w)], rayleigh: true };
      }
      return null;
    }

    /** Spend up to `steps` on the measurements the pace allows; true if any frequency completed. */
    function measure(steps: number): boolean {
      let budget = steps;
      let any = false;
      while (budget > 0 && credit > 0) {
        current ??= next();
        if (!current) break;
        for (const l of current.locks) {
          if (l.result) continue;
          const spend = Math.min(budget, l.left);
          l.advance(spend);
          budget -= spend;
          if (budget <= 0) break;
        }
        if (!current.locks.every((l) => l.result)) break;
        if (current.rayleigh) {
          const x = current.locks[0].result!;
          rayleigh.push(current.w ** 4 * (x.re * x.re + x.im * x.im));
        } else {
          let re0 = 0;
          let im0 = 0;
          current.locks.forEach((l, j) => {
            re0 += medium.resonances[j].f * medium.wp2 * l.result!.re;
            im0 += medium.resonances[j].f * medium.wp2 * l.result!.im;
          });
          const c = medium.dense ? localField({ re: re0, im: im0 }) : { re: re0, im: im0 };
          re[filled] = c.re;
          im[filled] = c.im;
          filled++;
        }
        current = null;
        credit--;
        any = true;
      }
      return any;
    }

    /** Linear interpolation of the measured grid at ω. */
    const onGrid = (arr: Float64Array, w: number) => {
      const k = Math.min(GRID - 2, Math.floor(w / STEP));
      const u = w / STEP - k;
      return arr[k] + u * (arr[k + 1] - arr[k]);
    };

    function summary(): Stat[] {
      const done = filled >= GRID;
      const closed = lorentz(medium, probe);
      const n = index(atProbe);
      const out: Stat[] = [
        { label: 'frequencies measured', value: `${Math.min(filled, GRID)} of ${GRID}, up to ${TOP} ω₀; ${rayleigh.length} of ${RAYLEIGH.length} far below` },
        { label: 'Re χ at the probe, the electrons driven and locked in', value: fx(atProbe.re, 7) },
        { label: 'Re χ at the probe, the Lorentz sum Σfω_p²/(ω_j² − ω² − iγω)', value: fx(closed.re, 7) },
        { label: 'Im χ at the probe (absorption), locked in', value: fx(atProbe.im, 7) },
        { label: 'Im χ at the probe, the Lorentz sum', value: fx(closed.im, 7) },
        { label: 'index n at the probe, √(1 + χ) measured', value: fx(n.re, 6) },
        { label: 'extinction κ at the probe: the wave decays as e^(−κωx/c)', value: fx(n.im, 6) },
      ];
      if (!done) return out;
      const ws = Array.from({ length: GRID }, (_, k) => k * STEP);
      const want = (Math.PI / 2) * medium.wp2 * medium.resonances.reduce((s, r) => s + r.f, 0);
      if (mode === 'plasma') {
        // Re ε = 1 + Re χ crosses zero at the plasma edge: interpolated between grid points
        let edge = Number.NaN;
        for (let k = 1; k + 1 < GRID; k++) {
          const a = 1 + re[k];
          const b = 1 + re[k + 1];
          if (a < 0 && b >= 0) { edge = (k + a / (a - b)) * STEP; break; }
        }
        const g = medium.resonances[0].gamma;
        const n2 = index({ re: onGrid(re, 0.5 * edge), im: onGrid(im, 0.5 * edge) });
        const r = Math.hypot(n2.re - 1, n2.im) ** 2 / Math.hypot(n2.re + 1, n2.im) ** 2;
        out.push(
          { label: 'plasma edge: where Re ε = 1 + Re χ crosses zero, measured', value: fx(edge, 6) },
          { label: 'plasma edge √(ω_p² − γ²), closed form', value: fx(Math.sqrt(medium.wp2 - g * g), 6) },
          { label: 'reflectance |(n − 1)/(n + 1)|² at half the edge, measured n', value: fx(r, 6) },
          { label: 'Kramers–Kronig', value: 'not applied: a conductor’s Im χ grows as 1/ω towards ω = 0' },
        );
      } else {
        const kk = kramersKronig(im);
        out.push(
          { label: 'Re χ at the probe by Kramers–Kronig from the measured Im χ', value: fx(onGrid(kk, probe), 6) },
          { label: 'Re χ at the probe, measured on the grid', value: fx(onGrid(re, probe), 6) },
          { label: 'f-sum ∫ω Im χ dω, measured, with the 1/ω³ tail', value: fx(fSum(ws, im), 6) },
          { label: 'f-sum (π/2) ω_p² Σf, closed form', value: fx(want, 6) },
        );
        // the absorption peak of the main resonance, by a parabola through the largest grid value
        const main = medium.resonances[medium.resonances.length - 1];
        let kmax = 1;
        for (let k = 1; k + 1 < GRID; k++) if (k * STEP > main.w0 / 2 && im[k] > im[kmax]) kmax = k;
        const [a, b, c] = [im[kmax - 1], im[kmax], im[kmax + 1]];
        const peak = (kmax + (0.5 * (a - c)) / (a - 2 * b + c)) * STEP;
        out.push({ label: 'absorption peak of the main resonance, measured (ω over ω₀)', value: fx(peak, 6) });
        if (medium.dense) {
          out.push({ label: 'peak moved by the neighbours’ field, √(ω₀² − fω_p²/3)', value: fx(Math.sqrt(main.w0 ** 2 - (main.f * medium.wp2) / 3), 6) });
        } else {
          out.push({ label: 'natural frequency ω₀ of the main resonance', value: fx(main.w0, 6) });
        }
        if (mode === 'glass') {
          const n1 = index({ re: onGrid(re, 0.8), im: onGrid(im, 0.8) }).re;
          const n2 = index({ re: onGrid(re, 1.4), im: onGrid(im, 1.4) }).re;
          out.push({ label: 'n at 1.4 ω₀ less n at 0.8 ω₀, in the transparent window', value: fx(n2 - n1, 6) });
        }
      }
      if (rayleigh.length === RAYLEIGH.length) {
        const r = medium.resonances[medium.resonances.length - 1];
        const xs = RAYLEIGH.map((x) => x * Math.max(r.w0, 1));
        out.push({ label: 'Rayleigh: slope of ln(ω⁴|x|²) against ln ω, far below the resonance', value: fx(logSlope(xs, rayleigh), 4) });
      }
      return out;
    }

    return {
      setup,
      pace: () => pacer.report(filled >= GRID && rayleigh.length >= RAYLEIGH.length, params),
      draw() {
        credit += ctx.thumbnail ? 1 : pacer.take(params);
        if (measure(ctx.thumbnail ? STEPS_PER_FRAME / 4 : STEPS_PER_FRAME)) rows = summary();
        phase += 0.05;
        render();
        ctx.stats([pacer.row(params), ...rows]);
      },
    };

    function render() {
      const W = ctx.width;
      const H = ctx.height;
      const g = p.drawingContext as CanvasRenderingContext2D;
      const pal = ctx.palette();
      const fg = ctx.fg;
      p.background(...ctx.bg);
      g.save();
      g.font = '11px monospace';
      const x0 = W * 0.06;
      const w = W * 0.5;
      const y0 = H * 0.1;
      const h = H * 0.8;
      g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
      g.strokeRect(x0, y0, w, h);
      g.fillStyle = rgba(fg, 0.75);
      g.fillText('n (solid) and κ (dashed) against ω, measured; the Lorentz sum faint', x0, y0 - 6);
      // the curves: index from the measured χ, and the closed form underneath
      const nAt = (k: number) => index({ re: re[k], im: im[k] });
      let top = 1.5;
      for (let k = 1; k < filled; k++) { const n = nAt(k); top = Math.max(top, n.re, n.im); }
      top = Math.min(top, 6);
      const X = (om: number) => x0 + (om / TOP) * w;
      const Y = (v: number) => y0 + h - (Math.min(v, top) / top) * h;
      g.lineWidth = 1;
      g.strokeStyle = rgba(fg, 0.25);
      for (const part of ['re', 'im'] as const) {
        g.beginPath();
        for (let k = 1; k < GRID; k += 2) {
          const n = index(lorentz(medium, k * STEP))[part];
          if (k === 1) g.moveTo(X(k * STEP), Y(n)); else g.lineTo(X(k * STEP), Y(n));
        }
        g.stroke();
      }
      g.lineWidth = 1.6;
      for (const [part, colour, dash] of [['re', ramp(pal, 0.8), []], ['im', ramp(pal, 0.25), [4, 3]]] as const) {
        g.strokeStyle = rgba(colour, 1);
        g.setLineDash([...dash]);
        g.beginPath();
        for (let k = 1; k < filled; k++) {
          const n = nAt(k)[part];
          if (k === 1) g.moveTo(X(k * STEP), Y(n)); else g.lineTo(X(k * STEP), Y(n));
        }
        g.stroke();
      }
      g.setLineDash([]);
      g.strokeStyle = rgba(fg, 0.5);
      g.beginPath();
      g.moveTo(X(probe), y0);
      g.lineTo(X(probe), y0 + h);
      g.moveTo(x0, Y(1));
      g.lineTo(x0 + w, Y(1));
      g.stroke();
      // the wave at the probe frequency: vacuum on the left, the medium on the right
      const bx = W * 0.62;
      const bw = W * 0.34;
      const by = y0 + h * 0.25;
      const bh = h * 0.5;
      g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
      g.strokeRect(bx, by, bw, bh);
      g.fillStyle = rgba(ramp(pal, 0.5), 0.12);
      g.fillRect(bx + bw / 2, by, bw / 2, bh);
      g.fillStyle = rgba(fg, 0.75);
      g.fillText('the wave at the probe: vacuum | medium', bx, by - 6);
      const n = index(atProbe);
      const k0 = (2 * Math.PI * 3) / bw;
      g.strokeStyle = rgba(ramp(pal, 0.85), 1);
      g.lineWidth = 1.4;
      g.beginPath();
      for (let i = 0; i <= bw; i++) {
        const inside = i > bw / 2;
        const s = inside ? i - bw / 2 : 0;
        const arg = inside ? k0 * (bw / 2) + k0 * n.re * s - phase : k0 * i - phase;
        const amp = inside ? Math.exp(-k0 * n.im * s) : 1;
        const yy = by + bh / 2 - amp * Math.cos(arg) * bh * 0.4;
        if (i === 0) g.moveTo(bx + i, yy); else g.lineTo(bx + i, yy);
      }
      g.stroke();
      g.restore();
    }
  },
};

export default boundElectronMedium;
