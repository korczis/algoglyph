// Rate processes (src/plates/_shared/ensemble/rates.ts), run exactly by Gillespie's method: a
// radioactive chain A → B → C against Bateman's solution; Einstein's two-level atoms and one mode
// of light, whose photon number settles at Planck's occupancy; one level exchanging particles with
// a reservoir, whose mean is the Bose–Einstein, Fermi–Dirac or Boltzmann occupancy by the rule of
// arrival alone. The closed forms are computed beside the runs and never inside them.
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  decayChain, einsteinAtoms, gillespie, levelExchange, stateAt, timeStats, type Run, type Statistics,
} from '../_shared/ensemble/rates';
import { rgba } from '../_shared/two-slit/draw';

type Process = 'chain' | 'einstein' | 'level';

export const SAMPLES = 600;
export const MAX_PER_FRAME = 30;
/** Einstein's and the level's runs: their length in time units of the slowest rate (the level changes
 * some twenty times less often than the atoms and their mode, so it runs ten times longer), and the burn-in. */
export const LONG = { einstein: 4000, level: 40000 };
export const BURN_IN = 50;
/** Changes a run may take: the cap that bounds a rebuild's work. */
export const MAX_EVENTS = 400_000;
/** The histogram's largest count shown. */
const BINS = 24;
const when = (...values: string[]) => ({ key: 'process', values });
const f6 = (v: number) => v.toFixed(6);

/** Bateman's share of B at time t for A → B → C from pure A: λ₁/(λ₂ − λ₁)(e^(−λ₁t) − e^(−λ₂t)). */
export function batemanB(l1: number, l2: number, t: number): number {
  if (Math.abs(l2 - l1) < 1e-12 * l1) return l1 * t * Math.exp(-l1 * t);
  return (l1 / (l2 - l1)) * (Math.exp(-l1 * t) - Math.exp(-l2 * t));
}

/** The time B peaks: ln(λ₂/λ₁)/(λ₂ − λ₁), or 1/λ when the two are equal. */
export function peakTime(l1: number, l2: number): number {
  return Math.abs(l2 - l1) < 1e-12 * l1 ? 1 / l1 : Math.log(l2 / l1) / (l2 - l1);
}

/** The mean occupancy of one level at x = (ε − μ)/kT under each statistics. */
export function occupancy(stats: Statistics, x: number): number {
  return stats === 'bose' ? 1 / Math.expm1(x) : stats === 'fermi' ? 1 / (Math.exp(x) + 1) : Math.exp(-x);
}

export const rateProcesses: PlateCode = {
  id: 'rate-processes',
  mode: '2d',
  aspect: 16 / 9,
  params: [
    {
      kind: 'select', key: 'process', label: 'Process', value: 'chain', rebuild: true,
      options: [
        { value: 'chain', label: 'A decay chain A → B → C' },
        { value: 'einstein', label: 'Einstein’s atoms and one mode of light' },
        { value: 'level', label: 'One level and a reservoir of particles' },
      ],
    },
    { kind: 'range', key: 'atoms', label: 'Atoms of A at the start', min: 100, max: 20000, step: 100, value: 5000, rebuild: true, when: when('chain'),
      hint: 'Up to 20 000, whose 40 000 decays a rebuild affords at once.' },
    { kind: 'range', key: 'halfA', label: 'Half-life of A (s)', min: 0.5, max: 20, step: 0.5, value: 6, rebuild: true, when: when('chain') },
    { kind: 'range', key: 'halfB', label: 'Half-life of B (s)', min: 0.5, max: 20, step: 0.5, value: 2, rebuild: true, when: when('chain') },
    { kind: 'range', key: 'N', label: 'Two-level atoms', min: 1, max: 200, step: 1, value: 20, rebuild: true, when: when('einstein') },
    { kind: 'range', key: 'x', label: 'hν/kT (Einstein) or (ε − μ)/kT (the level)', min: 0.1, max: 5, step: 0.1, value: 1, rebuild: true, when: when('einstein', 'level'),
      hint: 'Above 0, where a boson level has a finite mean; at 5 a level is occupied a few times in a thousand.' },
    {
      kind: 'select', key: 'stats', label: 'Particles', value: 'bose', rebuild: true, when: when('level'),
      options: [
        { value: 'bose', label: 'Bosons: arrivals favoured by n + 1' },
        { value: 'fermi', label: 'Fermions: no second one' },
        { value: 'boltzmann', label: 'Distinguishable: arrivals at a constant rate' },
      ],
    },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
    let proc: Process = 'chain';
    let run: Run = gillespie([0], [], 1, ctx.rnd);
    let shown = 0;
    let fixed: Stat[] = [];
    let measured: Stat[] = [];
    let curves: Float64Array[] = [];
    let expected: Float64Array | null = null;
    let hist = new Float64Array(BINS + 1);
    let predicted = new Float64Array(BINS + 1);
    let scaleY = 1;
    /** Each curve's full height: the counts' scale, the atoms' number for the excited atoms. */
    let scales: number[] = [1];
    const state = new Int32Array(3);

    function setup() {
      proc = str(params, 'process') as Process;
      shown = 0;
      const rnd = ctx.rnd;
      if (proc === 'chain') {
        const N0 = num(params, 'atoms');
        const l1 = Math.LN2 / num(params, 'halfA');
        const l2 = Math.LN2 / num(params, 'halfB');
        const T = 6 * Math.max(num(params, 'halfA'), num(params, 'halfB'));
        run = gillespie([N0, 0, 0], decayChain(l1, l2), T, rnd, { maxEvents: 2 * N0 });
        const ts = peakTime(l1, l2);
        const pB = batemanB(l1, l2, ts);
        const atPeak = stateAt(run, ts);
        const atHalf = stateAt(run, num(params, 'halfA'));
        fixed = [
          { label: 'peak time of B, ln(λ₂/λ₁)/(λ₂ − λ₁) (s)', value: f6(ts) },
          { label: 'share of B at the peak time, measured', value: f6(atPeak[1] / N0) },
          { label: 'Bateman’s share of B there, λ₁/(λ₂ − λ₁)(e^(−λ₁t) − e^(−λ₂t))', value: f6(pB) },
          { label: 'binomial standard deviation of that share, √(p(1 − p)/N₀)', value: f6(Math.sqrt((pB * (1 - pB)) / N0)) },
          { label: 'share of A left after one half-life of A, measured', value: f6(atHalf[0] / N0) },
          { label: 'share of A after one half-life, e^(−ln 2)', value: f6(Math.exp(-Math.LN2)) },
        ];
        expected = Float64Array.from({ length: SAMPLES + 1 }, (_, i) => batemanB(l1, l2, (i / SAMPLES) * T));
        scaleY = N0;
      } else {
        const x = num(params, 'x');
        let reactions;
        let x0: number[];
        let n = 0;
        let stats: Statistics = 'bose';
        if (proc === 'einstein') {
          n = num(params, 'N');
          reactions = einsteinAtoms(n, 1, 1, x);
          x0 = [0, 0];
        } else {
          stats = str(params, 'stats') as Statistics;
          reactions = levelExchange(stats, x);
          x0 = [0];
        }
        // time in units of the slowest rate (1 for the level, the collisions for the atoms)
        run = gillespie(x0, reactions, LONG[proc], rnd, { maxEvents: MAX_EVENTS, from: BURN_IN });
        const s = timeStats(run, 0);
        const nb = proc === 'einstein' ? 1 / Math.expm1(x) : occupancy(stats, x);
        fixed = [{ label: 'changes in the run', value: `${run.events}${run.end < LONG[proc] ? ` (capped at ${MAX_EVENTS}, at t = ${run.end.toFixed(1)})` : ''}` }];
        if (proc === 'einstein') {
          const e = timeStats(run, 1);
          fixed.push(
            { label: 'photons in the mode, time average, measured', value: f6(s.mean) },
            { label: 'Planck’s occupancy 1/(e^(hν/kT) − 1)', value: f6(nb) },
            { label: 'photon variance over n̄(n̄ + 1), measured', value: f6(s.variance / (s.mean * (s.mean + 1))) },
            { label: 'excited share of the atoms, time average, measured', value: f6(e.mean / n) },
            { label: 'excited share by Boltzmann, 1/(e^(hν/kT) + 1)', value: f6(1 / (Math.exp(x) + 1)) },
          );
        } else {
          const name = stats === 'bose' ? 'Bose–Einstein 1/(e^x − 1)' : stats === 'fermi' ? 'Fermi–Dirac 1/(e^x + 1)' : 'Boltzmann e^(−x)';
          const vf = stats === 'bose' ? nb * (1 + nb) : stats === 'fermi' ? nb * (1 - nb) : nb;
          fixed.push(
            { label: 'mean occupancy of the level, time average, measured', value: f6(s.mean) },
            { label: `mean occupancy, ${name}`, value: f6(nb) },
            { label: 'variance of the occupancy, measured', value: f6(s.variance) },
            { label: `variance, ${stats === 'bose' ? 'n̄(1 + n̄)' : stats === 'fermi' ? 'n̄(1 − n̄)' : 'n̄'}`, value: f6(vf) },
          );
        }
        // the predicted distribution of the count, drawn beside the measured one
        predicted = new Float64Array(BINS + 1);
        for (let k = 0; k <= BINS; k++) {
          if (proc === 'einstein' || stats === 'bose') predicted[k] = Math.pow(nb / (1 + nb), k) / (1 + nb);
          else if (stats === 'fermi') predicted[k] = k === 0 ? 1 - nb : k === 1 ? nb : 0;
          else { let f = Math.exp(-nb); for (let j = 1; j <= k; j++) f *= nb / j; predicted[k] = f; }
        }
        expected = null;
        scaleY = Math.max(4, Math.ceil(4 * nb + 2));
      }
      scales = proc === 'einstein' ? [scaleY, num(params, 'N')] : Array.from({ length: run.width }, () => scaleY);
      curves = Array.from({ length: run.width }, () => new Float64Array(SAMPLES + 1));
      record(0);
      hist = new Float64Array(BINS + 1);
      pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
      pacer.start(SAMPLES);
      measured = [];
    }

    function record(i: number) {
      stateAt(run, (i / SAMPLES) * run.end, state);
      for (let c = 0; c < run.width; c++) curves[c][i] = state[c];
    }

    /** The time-weighted histogram of the first count over [0, the sample's time]. */
    function histogram(upTo: number) {
      hist.fill(0);
      const { times, states, width } = run;
      for (let k = 0; k < times.length; k++) {
        const t0 = Math.max(times[k], BURN_IN);
        const t1 = Math.min(k + 1 < times.length ? times[k + 1] : run.end, upTo);
        if (t1 > t0) hist[Math.min(BINS, states[k * width])] += t1 - t0;
      }
      const total = hist.reduce((a, b) => a + b, 0);
      if (total > 0) for (let k = 0; k <= BINS; k++) hist[k] /= total;
    }

    return {
      setup,
      pace: () => pacer.report(shown >= SAMPLES, params),
      draw() {
        const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
        const before = shown;
        for (let k = 0; k < take && shown < SAMPLES; k++) { shown++; record(shown); }
        if (proc !== 'chain' && shown !== before) histogram((shown / SAMPLES) * run.end);
        if (shown >= SAMPLES && measured.length === 0) measured = fixed;
        const W = ctx.width;
        const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        const g = p.drawingContext as CanvasRenderingContext2D;
        g.save();
        g.font = '11px monospace';
        const x0 = W * 0.06;
        const w = W * (proc === 'chain' ? 0.88 : 0.5);
        const y0 = H * 0.12;
        const h = H * 0.76;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(x0, y0, w, h);
        const Y = (v: number, top = scaleY) => y0 + h - Math.min(1, v / top) * h;
        for (let c = 0; c < run.width; c++) {
          g.strokeStyle = rgba(ramp(pal, 0.15 + 0.35 * c), 1);
          g.beginPath();
          for (let i = 0; i <= shown; i++) { const X = x0 + (i / SAMPLES) * w; if (i === 0) g.moveTo(X, Y(curves[c][i], scales[c])); else g.lineTo(X, Y(curves[c][i], scales[c])); }
          g.stroke();
        }
        if (expected) {
          g.strokeStyle = rgba(fg, 0.6);
          g.setLineDash([4, 3]);
          g.beginPath();
          for (let i = 0; i <= SAMPLES; i++) { const X = x0 + (i / SAMPLES) * w; if (i === 0) g.moveTo(X, Y(expected[i] * scaleY)); else g.lineTo(X, Y(expected[i] * scaleY)); }
          g.stroke();
          g.setLineDash([]);
        }
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(proc === 'chain' ? 'atoms of A, B and C against time; dashed: Bateman’s B'
          : proc === 'einstein' ? `photons (0 to ${scaleY}) and excited atoms (0 to ${num(params, 'N')}) against time` : 'particles in the level against time', x0, y0 - 8);
        if (proc !== 'chain') {
          // the time-weighted distribution of the first count, bars, against the prediction, dots
          const hx = x0 + w + W * 0.05;
          const hw = W - hx - W * 0.04;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(hx, y0, hw, h);
          const top = Math.max(1e-9, ...predicted, ...hist);
          const bw = hw / (BINS + 1);
          g.fillStyle = rgba(ramp(pal, 0.8), 0.85);
          for (let k = 0; k <= BINS; k++) g.fillRect(hx + k * bw + 1, y0 + h - (hist[k] / top) * h, Math.max(1, bw - 2), (hist[k] / top) * h);
          g.fillStyle = rgba(fg, 0.85);
          for (let k = 0; k <= BINS; k++) g.fillRect(hx + (k + 0.5) * bw - 2, y0 + h - (predicted[k] / top) * h - 2, 4, 4);
          g.fillStyle = rgba(fg, 0.75);
          g.fillText(`time at 0 … ${BINS}; dots: closed form`, hx, y0 - 8);
        }
        g.restore();
        const t = (shown / SAMPLES) * run.end;
        stateAt(run, t, state);
        ctx.stats([pacer.row(params), { label: 'time shown (s)', value: t.toFixed(2) },
          { label: proc === 'chain' ? 'atoms of A, B, C now' : proc === 'einstein' ? 'photons, excited atoms now' : 'particles in the level now',
            value: Array.from(state.subarray(0, run.width)).join(', ') },
          ...(shown >= SAMPLES ? measured : [{ label: 'measurements', value: 'after the run' }])]);
      },
    };
  },
};

export default rateProcesses;
