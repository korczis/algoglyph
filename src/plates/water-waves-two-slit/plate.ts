import { count } from '../../core/format';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { Raster } from '../../core/raster';
import { rgba } from '../_shared/two-slit/draw';
import { fringePeriod } from '../_shared/two-slit/screen';
import { extrema, phaseCycles, predictedIntensityMaxima, type Prediction } from '../_shared/wave2d/fringes';
import {
  CourantError, energy, MAX_COURANT, numericalWavenumber, stepField, waveField, type Source, type WaveField,
} from '../_shared/wave2d/wave';

type Scenario = 'sources' | 'slits' | 'pulse';

/** The tank in cells, whatever the canvas: the physics does not change with the screen. */
export const GRID_W = 240;
export const GRID_H = 200;
/** The absorbing border, in cells, and its damping per step at the outer edge: the strength that
 * left the least ripple on the detector line among those tried (0.05 to 1; weaker lets waves
 * through to the fixed edge, stronger reflects off the sponge's own gradient). */
export const SPONGE = 24;
export const SPONGE_STRENGTH = 0.5;
/** The axis row, the column of the point sources, the plane-wave line and the slit wall. */
const CENTRE = 100;
const SOURCE_X = 44;
const LINE_X = 32;
const WALL_X = 60;
const WALL_T = 2;
/** The rows of the detector line that are read (inside the sponge by a margin). */
const DET_FROM = 30;
const DET_TO = 170;
/** Fringes are judged within this many cells of the axis, where the line is far from the border. */
const JUDGE = 55;
/** Measurement resolution of a fringe position read between cells (stated, not fitted). */
export const RESOLUTION = 0.25;
/** Drive periods the source is ramped up over, and averaged over once steady. */
const RAMP_PERIODS = 4;
const AVERAGE_PERIODS = 16;
/** Steps of the closed-box energy run. */
const PULSE_STEPS = 2000;
/** Cell updates a frame may cost (three fields a step in the two wave modes). */
export const CELL_STEPS_PER_FRAME = 1_000_000;
export const MAX_STEPS = Math.max(1, Math.floor(CELL_STEPS_PER_FRAME / (3 * GRID_W * GRID_H)));
const THUMB_STEPS = 24;

const when = (...values: Scenario[]) => ({ key: 'scenario', values });
const cells = (x: number, digits = 2) => `${x.toFixed(digits)} cells`;

interface Lock { re: Float64Array; im: Float64Array }
const lock = (n: number): Lock => ({ re: new Float64Array(n), im: new Float64Array(n) });
/** Time-averaged u² from a lock-in at the drive frequency over m steps: A²/2 with A = 2|Σ|/m. */
const intensity = (l: Lock, i: number, m: number) => (2 * (l.re[i] ** 2 + l.im[i] ** 2)) / (m * m);

interface Result {
  i12: Float64Array;
  i1: Float64Array;
  i2: Float64Array;
  measuredMaxima: number[];
  predicted: number[];
  spacing: number;
  spacingPredicted: number;
  spacingFar: number;
  largestGap: number;
  centre: number;
  centrePredicted: number;
  visibility: number;
  visibilityPredicted: number;
  centreRatio: number;
  lambdaAxis: number | null;
  ripple: number;
}

export const waterWavesTwoSlit: PlateCode = {
  id: 'water-waves-two-slit',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 60,
  params: [
    {
      kind: 'select', key: 'scenario', label: 'Tank', value: 'sources', rebuild: true,
      options: [
        { value: 'sources', label: 'Two point sources' },
        { value: 'slits', label: 'A plane wave through two slits' },
        { value: 'pulse', label: 'A pulse in a closed box (energy)' },
      ],
    },
    { kind: 'range', key: 'lambda', label: 'Wavelength λ₀ = 2πc/ω (cells)', min: 6, max: 24, step: 1,
      value: 10, rebuild: true, when: when('sources', 'slits') },
    { kind: 'range', key: 'd', label: 'Separation d (cells)', min: 10, max: 60, step: 2, value: 30,
      rebuild: true, when: when('sources', 'slits') },
    { kind: 'range', key: 'L', label: 'Distance to the detector line L (cells)', min: 60, max: 140,
      step: 5, value: 140, rebuild: true, when: when('sources', 'slits') },
    { kind: 'range', key: 'phase', label: 'Phase of source 2 (°)', min: -180, max: 180, step: 5,
      value: 0, rebuild: true, when: when('sources') },
    { kind: 'range', key: 'ratio', label: 'Amplitude of source 2 over source 1', min: 0, max: 1,
      step: 0.05, value: 1, rebuild: true, when: when('sources') },
    { kind: 'range', key: 'slit', label: 'Slit width (cells)', min: 2, max: 12, step: 1, value: 4,
      rebuild: true, when: when('slits') },
    { kind: 'range', key: 'damping', label: 'Damping γ (per 1000 steps)', min: 0, max: 10, step: 0.5,
      value: 0, rebuild: true },
    { kind: 'range', key: 'courant', label: 'Courant number C = cΔt/Δx', min: 0.1, max: 0.9,
      step: 0.05, value: 0.5, rebuild: true,
      hint: 'The scheme is stable only up to 1/√2 ≈ 0.707; above it the tank refuses to step.' },
    paceParam(),
    {
      kind: 'select', key: 'view', label: 'Show', value: 'field', cosmetic: true,
      options: [
        { value: 'field', label: 'The surface' },
        { value: 'intensity', label: 'Its running intensity' },
      ],
    },
    paletteParam('abyss'),
  ],
  // the integrator's time steps are the counted changes; the stream runs at the ceiling, and the
  // pace control multiplies it up to the steps a frame's budget allows
  pace: { kind: 'stream', unit: 'time steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('stream', 'time steps', MAX_STEPS);
    let scenario: Scenario = 'sources';
    let refused: string | null = null;
    let fields: WaveField[] = [];
    let drives: Source[][] = [];
    let omega = 0;
    let courant = 0.5;
    let lambda0 = 10;
    let d = 30;
    let L = 140;
    let detX = 0;
    let warm = 0;
    let span = 0;
    let rampSteps = 1;
    let det: Lock[] = [];
    let axis: Lock = lock(1);
    let axisFrom = 0;
    let axisTo = 0;
    let axisRow = 0;
    let result: Result | null = null;
    let e0 = 0;
    let eNow = 0;
    let shown: Float64Array = new Float64Array(0);
    let raster: Raster;
    let prediction: Prediction | null = null;

    const ramp1 = (t: number) => (t >= rampSteps ? 1 : 0.5 * (1 - Math.cos((Math.PI * t) / rampSteps)));

    function setupWaves(slits: boolean) {
      lambda0 = num(params, 'lambda');
      d = num(params, 'd');
      L = num(params, 'L');
      omega = (2 * Math.PI * courant) / lambda0;
      const period = (2 * Math.PI) / omega;
      rampSteps = Math.round(RAMP_PERIODS * period);
      warm = rampSteps + Math.ceil((GRID_W + GRID_H) / courant);
      span = Math.round(AVERAGE_PERIODS * period);
      const damping = num(params, 'damping') / 1000;
      const y1 = Math.round(CENTRE - d / 2);
      const y2 = Math.round(CENTRE + d / 2);
      if (!slits) {
        // three tanks: both sources, source 1 alone, source 2 alone (linear, so the sum is exact)
        const phase = (num(params, 'phase') * Math.PI) / 180;
        const r = num(params, 'ratio');
        const s1: Source = { index: y1 * GRID_W + SOURCE_X, amplitude: 1, phase: 0 };
        const s2: Source = { index: y2 * GRID_W + SOURCE_X, amplitude: r, phase };
        fields = [0, 1, 2].map(() => waveField({ w: GRID_W, h: GRID_H, courant, damping, sponge: SPONGE, spongeStrength: SPONGE_STRENGTH }));
        drives = [[s1, s2], [s1], [s2]];
        detX = SOURCE_X + L;
        prediction = {
          sources: [{ x: SOURCE_X, y: y1, phase: 0 }, { x: SOURCE_X, y: y2, phase, amplitude: r }],
          detectorX: detX, from: DET_FROM, to: DET_TO, omega, courant,
        };
        // the wavelength along the axis of source 1, read from tank 2 (source 1 alone)
        axisRow = y1;
        axisFrom = SOURCE_X + Math.ceil(3 * lambda0);
        axisTo = Math.min(detX, GRID_W - SPONGE - 4);
      } else {
        // three tanks: both slits open, slit 2 shut, slit 1 shut
        const a = num(params, 'slit');
        const wall = (open: number[]) => {
          const m = new Uint8Array(GRID_W * GRID_H);
          for (let y = 0; y < GRID_H; y++) {
            const inSlit = open.some((c) => Math.abs(y - c) <= (a - 1) / 2);
            if (inSlit) continue;
            for (let x = WALL_X; x < WALL_X + WALL_T; x++) m[y * GRID_W + x] = 1;
          }
          return m;
        };
        const line: Source[] = [];
        for (let y = 1; y < GRID_H - 1; y++) line.push({ index: y * GRID_W + LINE_X, amplitude: 1, phase: 0 });
        fields = [[y1, y2], [y1], [y2]].map((open) => waveField({
          w: GRID_W, h: GRID_H, courant, damping, sponge: SPONGE, spongeStrength: SPONGE_STRENGTH, walls: wall(open),
        }));
        drives = [line, line, line];
        detX = WALL_X + WALL_T + L;
        // each opening radiates from its exit, in phase: the prediction's two point sources
        prediction = {
          sources: [{ x: WALL_X + WALL_T - 0.5, y: y1, phase: 0 }, { x: WALL_X + WALL_T - 0.5, y: y2, phase: 0 }],
          detectorX: detX, from: DET_FROM, to: DET_TO, omega, courant,
        };
        axisRow = -1;
      }
      det = fields.map(() => lock(GRID_H));
      axis = lock(GRID_W);
    }

    function setupPulse() {
      const damping = num(params, 'damping') / 1000;
      const f = waveField({ w: GRID_W, h: GRID_H, courant, damping, sponge: 0 });
      for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
          const v = Math.exp(-((x - 80) ** 2 + (y - CENTRE) ** 2) / 8);
          f.u[y * GRID_W + x] = v;
          f.prev[y * GRID_W + x] = v;
        }
      }
      stepField(f);
      fields = [f];
      drives = [[]];
      e0 = energy(f);
      eNow = e0;
    }

    function measure() {
      const m = span;
      const n = GRID_H;
      const [i12, i1, i2] = det.map((l) => Float64Array.from({ length: n }, (_, i) => intensity(l, i, m)));
      const ext = extrema(i12, DET_FROM, DET_TO);
      const rel = (y: number) => y - CENTRE;
      const maxima = ext.maxima.map((e) => e.at).filter((y) => Math.abs(rel(y)) <= JUDGE);
      const predictedAll = predictedIntensityMaxima(prediction!);
      const predicted = predictedAll.filter((y) => Math.abs(rel(y)) <= JUDGE);
      const meanSpacing = (ys: number[]) => (ys.length > 1 ? (ys[ys.length - 1] - ys[0]) / (ys.length - 1) : Number.NaN);
      const nearest = (ys: number[], y: number) => ys.reduce((b, x) => (Math.abs(x - y) < Math.abs(b - y) ? x : b), Number.POSITIVE_INFINITY);
      let largestGap = 0;
      for (const y of predicted) largestGap = Math.max(largestGap, Math.abs(nearest(maxima, y) - y));
      // the zeroth order: the predicted maximum where the arrivals differ by no whole cycle
      const centrePredicted = predictedAll.reduce((b, y) =>
        (Math.abs(phaseCycles(prediction!, y)) < Math.abs(phaseCycles(prediction!, b)) ? y : b), predictedAll[0] ?? CENTRE);
      const centre = nearest(ext.maxima.map((e) => e.at), centrePredicted);
      const at = (arr: Float64Array, y: number) => {
        const i = Math.floor(y);
        const t = y - i;
        return arr[i] * (1 - t) + arr[Math.min(n - 1, i + 1)] * t;
      };
      const below = ext.minima.filter((e) => e.at < centre).pop();
      const above = ext.minima.find((e) => e.at > centre);
      const iMax = at(i12, centre);
      const iMin = below && above ? (below.value + above.value) / 2 : Number.NaN;
      const visibility = (iMax - iMin) / (iMax + iMin);
      const a1 = at(i1, centre);
      const a2 = at(i2, centre);
      // how much the border's residual reflections ripple one source's amplitude along the line:
      // √I₁ · √r should be flat for a point source; its spread bounds how far maxima can be pulled
      let ripple = Number.NaN;
      if (scenario === 'sources') {
        const s1 = prediction!.sources[0];
        const vals: number[] = [];
        for (let y = CENTRE - JUDGE; y <= CENTRE + JUDGE; y++) vals.push(Math.sqrt(i1[y]) * Math.sqrt(Math.hypot(detX - s1.x, y - s1.y)));
        const mean = vals.reduce((t, v) => t + v, 0) / vals.length;
        ripple = Math.max(...vals.map((v) => Math.abs(v / mean - 1)));
      }
      let lambdaAxis: number | null = null;
      if (axisRow >= 0) {
        // the phase along the axis of source 1 alone, unwrapped and fitted by a line: k, then λ
        const xs: number[] = [];
        const ph: number[] = [];
        let prev = 0;
        let un = 0;
        for (let x = axisFrom; x < axisTo; x++) {
          const q = Math.atan2(axis.im[x], axis.re[x]);
          if (xs.length === 0) un = q;
          else {
            let dq = q - prev;
            while (dq > Math.PI) dq -= 2 * Math.PI;
            while (dq < -Math.PI) dq += 2 * Math.PI;
            un += dq;
          }
          prev = q;
          xs.push(x);
          ph.push(un);
        }
        const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
        const my = ph.reduce((s, x) => s + x, 0) / ph.length;
        let sxy = 0;
        let sxx = 0;
        for (let i = 0; i < xs.length; i++) {
          sxy += (xs[i] - mx) * (ph[i] - my);
          sxx += (xs[i] - mx) ** 2;
        }
        lambdaAxis = (2 * Math.PI) / Math.abs(sxy / sxx);
      }
      result = {
        i12, i1, i2, measuredMaxima: maxima, predicted,
        spacing: meanSpacing(maxima), spacingPredicted: meanSpacing(predicted),
        spacingFar: fringePeriod({ lambda: lambda0, d, a: 0, L: detX - prediction!.sources[0].x }),
        largestGap, centre: rel(centre), centrePredicted: rel(centrePredicted),
        visibility, visibilityPredicted: (2 * Math.sqrt(a1 * a2)) / (a1 + a2), centreRatio: iMax / (a1 + a2),
        lambdaAxis, ripple,
      };
    }

    function advance() {
      const f0 = fields[0];
      const t = f0.step;
      const g = ramp1(t);
      for (let k = 0; k < fields.length; k++) stepField(fields[k], drives[k], omega, g);
      if (scenario === 'pulse') {
        eNow = energy(fields[0]);
        return;
      }
      const tt = fields[0].step;
      if (tt > warm && tt <= warm + span) {
        const c = Math.cos(omega * tt);
        const s = Math.sin(omega * tt);
        for (let k = 0; k < fields.length; k++) {
          const u = fields[k].u;
          const l = det[k];
          for (let y = DET_FROM; y < DET_TO; y++) {
            const v = u[y * GRID_W + detX];
            l.re[y] += v * c;
            l.im[y] += v * s;
          }
        }
        if (axisRow >= 0) {
          const u = fields[1].u;
          for (let x = axisFrom; x < axisTo; x++) {
            const v = u[axisRow * GRID_W + x];
            axis.re[x] += v * c;
            axis.im[x] += v * s;
          }
        }
        if (tt === warm + span) measure();
      }
      // the running intensity shown in the intensity view (display only)
      const u = fields[0].u;
      for (let i = 0; i < u.length; i++) shown[i] = shown[i] * 0.985 + u[i] * u[i] * 0.015;
    }

    const finished = () => (scenario === 'pulse' ? (fields[0]?.step ?? 0) > PULSE_STEPS : result !== null);

    function stats(): Stat[] {
      const rows: Stat[] = [pacer.row(params)];
      if (refused) {
        rows.push(
          { label: 'Courant number C = cΔt/Δx', value: `${courant.toFixed(2)}, refused: above the 2-D limit 1/√2 = ${MAX_COURANT.toFixed(4)}` },
          { label: 'time steps taken', value: '0' },
        );
        return rows;
      }
      rows.push({ label: 'Courant number C = cΔt/Δx', value: `${courant.toFixed(2)} (limit 1/√2 = ${MAX_COURANT.toFixed(4)})` });
      const steps = fields[0].step;
      if (scenario === 'pulse') {
        const done = steps > PULSE_STEPS;
        const ratio = eNow / e0;
        const gamma = num(params, 'damping');
        rows.push(
          { label: 'time steps taken', value: done ? `${count(PULSE_STEPS)}, done` : count(steps) },
          { label: 'energy now over energy at the start', value: ratio.toFixed(9) },
          { label: 'energy drift from the start, numerics', value: Math.abs(ratio - 1).toExponential(2) },
          { label: 'energy decay rate, measured (per 1000 steps)', value: steps > 1 ? ((-1000 * Math.log(ratio)) / (steps - 1)).toFixed(4) : 'after a step' },
          { label: 'damping γ (per 1000 steps)', value: gamma.toFixed(4) },
        );
        return rows;
      }
      const lambdaAxisGrid = (2 * Math.PI) / numericalWavenumber(omega, courant, 0);
      rows.push(
        { label: 'measurement', value: result ? `done at step ${count(warm + span)}` : steps <= warm
          ? `warming up, ${count(warm - steps)} steps to go` : `averaging, ${count(warm + span - steps)} steps to go` },
        { label: 'wavelength λ₀, continuum', value: cells(lambda0, 3) },
        { label: 'wavelength along the axis, from the scheme’s dispersion', value: cells(lambdaAxisGrid, 3) },
      );
      if (scenario === 'sources') {
        rows.push({ label: 'wavelength along the axis, measured from the phase',
          value: result?.lambdaAxis ? cells(result.lambdaAxis, 3) : 'after the average' });
      }
      if (!result) return rows;
      const r = result;
      const dispersion = Math.abs(r.spacingPredicted - r.spacingFar);
      rows.push(
        { label: 'fringe spacing, measured', value: cells(r.spacing) },
        { label: 'fringe spacing, far field λ₀L/d', value: cells(r.spacingFar) },
        { label: 'fringe spacing, the grid’s dispersion and the exact paths', value: cells(r.spacingPredicted) },
        { label: 'spacing gap from λ₀L/d, in its derived error', value: (( r.spacing - r.spacingFar) / (dispersion + RESOLUTION)).toFixed(3) },
        { label: 'maxima on the detector line, cells from the axis', value: r.measuredMaxima.map((y) => (y - CENTRE).toFixed(1)).join(', ') },
        { label: 'largest gap, measured maxima against predicted', value: cells(r.largestGap) },
        ...(scenario === 'sources' ? [{ label: 'amplitude ripple on the line, one source alone', value: `${(100 * r.ripple).toFixed(2)} %` }] : []),
        { label: 'central maximum, measured', value: cells(r.centre) },
        { label: 'central maximum, predicted', value: cells(r.centrePredicted) },
        { label: 'visibility at the central fringe, measured', value: r.visibility.toFixed(4) },
        { label: 'visibility from I₁ and I₂ measured alone, 2√(I₁I₂)/(I₁ + I₂)', value: r.visibilityPredicted.toFixed(4) },
        { label: 'centre, both open over I₁ + I₂', value: r.centreRatio.toFixed(4) },
      );
      return rows;
    }

    return {
      setup() {
        scenario = str(params, 'scenario') as Scenario;
        courant = num(params, 'courant');
        result = null;
        refused = null;
        try {
          if (scenario === 'pulse') setupPulse();
          else setupWaves(scenario === 'slits');
        } catch (e) {
          if (!(e instanceof CourantError)) throw e;
          refused = e.message;
          fields = [];
        }
        shown = new Float64Array(GRID_W * GRID_H);
        raster = new Raster(GRID_W, GRID_H);
        pacer.start();
      },
      pace: () => pacer.report(finished(), params),
      draw() {
        if (!refused) {
          const steps = ctx.thumbnail ? THUMB_STEPS : pacer.take(params);
          for (let s = 0; s < steps; s++) {
            if (scenario === 'pulse' && fields[0].step > PULSE_STEPS) break;
            advance();
          }
        }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        if (refused) {
          g.fillStyle = rgba(fg, 0.85);
          g.font = '14px monospace';
          g.textBaseline = 'middle';
          g.fillText(`Refused: C = ${courant.toFixed(2)} is above 1/√2 ≈ 0.707.`, W * 0.06, H * 0.45);
          g.fillText('The leapfrog scheme would blow up; lower the Courant number.', W * 0.06, H * 0.45 + 22);
          g.restore();
          ctx.stats(stats());
          return;
        }
        // the tank: the surface (or its running intensity), walls and sources marked
        const f = fields[0];
        const intensityView = str(params, 'view') === 'intensity';
        let peak = 1e-9;
        if (intensityView) for (let i = 0; i < shown.length; i++) peak = Math.max(peak, shown[i]);
        const wallC = mix(ctx.bg, fg, 0.75);
        const data = raster.data;
        for (let i = 0; i < f.u.length; i++) {
          let c;
          if (f.fixed[i] && i % GRID_W !== 0 && i % GRID_W !== GRID_W - 1 && i >= GRID_W && i < f.u.length - GRID_W) c = wallC;
          else if (intensityView) c = mix(ctx.bg, ramp(pal, Math.min(1, shown[i] / peak)), Math.min(1, Math.sqrt(shown[i] / peak) * 1.4));
          else c = ramp(pal, 0.5 + Math.max(-0.5, Math.min(0.5, f.u[i] * 0.6)));
          data[i * 4] = c[0];
          data[i * 4 + 1] = c[1];
          data[i * 4 + 2] = c[2];
          data[i * 4 + 3] = 255;
        }
        const tankH = H;
        const tankW = Math.min(W * 0.62, (H * GRID_W) / GRID_H);
        raster.blit(p, true, 0, 0, tankW, tankH);
        const sx = tankW / GRID_W;
        const sy = tankH / GRID_H;
        if (scenario !== 'pulse') {
          g.strokeStyle = rgba(fg, 0.8);
          g.setLineDash([4, 3]);
          g.beginPath();
          g.moveTo((detX + 0.5) * sx, DET_FROM * sy);
          g.lineTo((detX + 0.5) * sx, DET_TO * sy);
          g.stroke();
          g.setLineDash([]);
          // the intensity along the detector line, sideways, beside the tank
          const panelX = tankW + 12;
          const panelW = W - panelX - 10;
          const curves: [Float64Array | null, string, number[]][] = result
            ? [[result.i12, rgba(ramp(pal, 0.8), 1), []], [result.i1.map((v, i) => v + result!.i2[i]), rgba(fg, 0.7), [4, 3]]]
            : [[null, '', []]];
          let top = 1e-12;
          if (result) for (let y = DET_FROM; y < DET_TO; y++) top = Math.max(top, result.i12[y]);
          for (const [arr, colour, dash] of curves) {
            if (!arr) continue;
            g.strokeStyle = colour;
            g.lineWidth = 1.4;
            g.setLineDash(dash);
            g.beginPath();
            for (let y = DET_FROM; y < DET_TO; y++) {
              const xx = panelX + (arr[y] / top) * panelW * 0.95;
              const yy = (y + 0.5) * sy;
              if (y === DET_FROM) g.moveTo(xx, yy);
              else g.lineTo(xx, yy);
            }
            g.stroke();
          }
          g.setLineDash([]);
          g.fillStyle = rgba(fg, 0.75);
          g.font = '11px monospace';
          g.textBaseline = 'top';
          g.fillText(result ? 'intensity on the line: both (solid), I₁ + I₂ (dashed)' : 'measuring the line…', panelX, 6);
        }
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default waterWavesTwoSlit;
