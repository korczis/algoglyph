import { bounded, cellWithin, stepsWithin } from '../../core/budget';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { Raster } from '../../core/raster';
import { runsParam, StreamStop } from '../_shared/settle/settle';
import {
  arcOf, DRUM_H, DRUM_PICKUP, DRUM_STRIKE, DRUM_W, drumModeClosed, drumModeScheme, drumRecordSteps, farFieldLobe,
  machAngle, measuredLobe, measuredMach, peakNear, predictedLobe,
} from './measure';
import { advance, C2, drop, tank, type Experiment, type Tank } from './wave';

/** Steps in one run of the stop: a block of 100 steps. */
const BLOCK = 100;
/**
 * The phased array's and the moving source's own tank: 67,200 cells, three quarters of MAX_CELLS,
 * with a sponge of WIDE_SPONGE cells. The default 18 reflected enough that the lobe read on its arc
 * moved by up to 8° as the tank's size changed; at 40 it stays within about 1° on every size tried.
 */
const WIDE_W = 320;
const WIDE_H = 210;
const WIDE_SPONGE = 40;
/**
 * Cell updates a frame on that tank: four steps of it. At eight a frame the phased array read
 * 21.9 of 24 ms at 390 px in the full budget suite, as dear on a phone as on a desktop, because
 * its tank does not shrink with the canvas; 'steps this frame' shows the bound.
 */
const WIDE_CELL_STEPS = 4 * WIDE_W * WIDE_H;
/** Where the moving source's cone is read: once the source is this many cells from the far edge. */
const MACH_FROM_EDGE = 50;

/**
 * Cells in the tank at most, and cell updates (cells × steps) per frame (src/core/budget.ts):
 * shading every cell costs as much as stepping it, so a desktop canvas at the finest cell size
 * would otherwise spend the whole frame budget on the intensity view.
 */
export const MAX_CELLS = 90_000;
export const CELL_STEPS_PER_FRAME = 1_200_000;

export const rippleTank: PlateCode = {
  id: 'ripple-tank',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 260,
  params: [
    {
      kind: 'select', key: 'experiment', label: 'Experiment', value: 'double', rebuild: true,
      options: [
        { value: 'double', label: 'Double slit (Young)' },
        { value: 'single', label: 'Single slit' },
        { value: 'two', label: 'Two point sources' },
        { value: 'free', label: 'Free surface' },
        { value: 'array', label: 'Phased array' },
        { value: 'moving', label: 'Moving source (Mach cone)' },
        { value: 'drum', label: 'Drum (a membrane fixed at its rim)' },
      ],
    },
    {
      kind: 'select', key: 'view', label: 'View', value: 'wave',
      options: [
        { value: 'wave', label: 'Surface height' },
        { value: 'intensity', label: 'Time-averaged intensity' },
      ],
    },
    { kind: 'range', key: 'lambda', label: 'Wavelength (cells)', min: 6, max: 40, step: 1, value: 14 },
    { kind: 'range', key: 'gap', label: 'Slit / source spacing (cells)', min: 6, max: 80, step: 1,
      value: 34, rebuild: true },
    { kind: 'range', key: 'res', label: 'Cell size (px)', min: 2, max: 6, step: 1, value: 3,
      rebuild: true },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 8, step: 1, value: 3 },
    { kind: 'range', key: 'phase', label: 'Phase step between array elements (degrees)', min: -90, max: 90, step: 5,
      value: 0, rebuild: true },
    { kind: 'range', key: 'mach', label: 'Moving source speed (Mach number v / c)', min: 0.5, max: 4, step: 0.1,
      value: 2, rebuild: true },
    runsParam({ unit: 'blocks of 100 steps', max: 1000 }),
    paletteParam('abyss'),
  ],
  pace: { kind: 'stream', emergent: 'a wave-equation integrator: its steps per frame set simulated time per frame' },
  create(p, ctx) {
    const params = ctx.params;
    let res = 3;
    let t: Tank;
    let raster: Raster;
    const stop = new StreamStop(params, BLOCK);
    // the drum's pickup record, and what each experiment has measured (frozen once it is read)
    let record = new Float64Array(0);
    let recorded = 0;
    let pickup = 0;
    let drumModes: { f11: number; f21: number } | null = null;
    let mach = NaN;
    let lobe: { lambda: number; predicted: number; far: number } | null = null;

    /** The cell under a canvas point: a tank of its own size fills the canvas; the others are `res` px a cell. */
    const cellAt = (x: number, y: number): [number, number] => (t.experiment === 'drum' || t.experiment === 'array' || t.experiment === 'moving'
      ? [Math.floor((x * t.w) / ctx.width), Math.floor((y * t.h) / ctx.height)]
      : [Math.floor(x / res), Math.floor(y / res)]);

    /** The current experiment's readouts: measured from the field, beside their closed forms. */
    function measure(lambda: number): Stat[] {
      const deg = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : 'waiting for the field');
      switch (t.experiment) {
        case 'array': {
          // the oracle depends on λ (a live control), so it is recomputed only when λ changes
          if (!lobe || lobe.lambda !== lambda) {
            const phaseStep = (num(params, 'phase') * Math.PI) / 180;
            lobe = { lambda, predicted: predictedLobe(t, lambda), far: farFieldLobe(t, lambda, phaseStep) };
          }
          return [
            { label: 'main lobe, measured from the intensity (degrees)', value: deg(measuredLobe(t)) },
            { label: 'main lobe, array factor at the same radius (degrees)', value: deg(lobe.predicted) },
            { label: 'main lobe, far field asin(Δφ / kd) (degrees)', value: deg(lobe.far) },
            { label: 'arc radius (cells)', value: String(arcOf(t).r) },
          ];
        }
        case 'moving': {
          const m = t.mover!;
          if (!Number.isFinite(mach) && m.x0 + m.v * t.step > t.w - MACH_FROM_EDGE) mach = measuredMach(t);
          return [
            { label: 'Mach cone half-angle, measured (degrees)', value: deg(mach) },
            { label: 'Mach angle asin(c / v) (degrees)', value: deg(machAngle(Math.sqrt(t.c2), m.v)) },
          ];
        }
        case 'drum': {
          if (!drumModes && recorded >= record.length) {
            drumModes = {
              f11: peakNear(record, record.length, drumModeScheme(1, 1, t.c2)),
              f21: peakNear(record, record.length, drumModeScheme(2, 1, t.c2)),
            };
          }
          const a = DRUM_W - 1; const b = DRUM_H - 1;
          const f = (v: number | undefined) => (v === undefined ? 'recording' : v.toExponential(6));
          return [
            { label: 'drum f₁₁, measured (cycles per step)', value: f(drumModes?.f11) },
            { label: 'drum f₁₁ on the grid, sin²(ω/2) = C²(sin²(π/2a) + sin²(π/2b))', value: drumModeScheme(1, 1, t.c2).toExponential(6) },
            { label: 'drum f₁₁, membrane (c/2)√(1/a² + 1/b²)', value: drumModeClosed(1, 1, t.c2).toExponential(6) },
            { label: 'drum f₂₁ / f₁₁, measured', value: drumModes ? (drumModes.f21 / drumModes.f11).toFixed(5) : 'recording' },
            { label: 'drum f₂₁ / f₁₁, membrane √((4/a² + 1/b²) / (1/a² + 1/b²))', value: Math.sqrt((4 / a ** 2 + 1 / b ** 2) / (1 / a ** 2 + 1 / b ** 2)).toFixed(5) },
            { label: 'drum, recorded steps', value: `${recorded} of ${record.length}` },
          ];
        }
        default:
          return [];
      }
    }

    return {
      setup() {
        res = cellWithin(ctx.width, ctx.height, num(params, 'res'), MAX_CELLS);
        const experiment = str(params, 'experiment') as Experiment;
        stop.reset();
        drumModes = null; mach = NaN; lobe = null; recorded = 0;
        if (experiment === 'drum') {
          // a small membrane of its own size, drawn across the canvas, struck once off-centre
          t = tank(DRUM_W, DRUM_H, 'drum', num(params, 'gap'));
          drop(t, Math.round(DRUM_STRIKE[0] * (DRUM_W - 1)), Math.round(DRUM_STRIKE[1] * (DRUM_H - 1)));
          record = new Float64Array(drumRecordSteps(t.c2));
          pickup = Math.round(DRUM_PICKUP[1] * (DRUM_H - 1)) * DRUM_W + Math.round(DRUM_PICKUP[0] * (DRUM_W - 1));
          raster = new Raster(DRUM_W, DRUM_H);
          return;
        }
        // the array and the moving source get a tank of their own size, drawn across the canvas:
        // the lobe must be read beyond the array's near field and the cone needs room to form,
        // whatever the canvas (at 800 × 500 and 3 px a cell the arc would sit inside it)
        const fixed = experiment === 'array' || experiment === 'moving';
        const w = fixed ? WIDE_W : Math.floor(ctx.width / res);
        const h = fixed ? WIDE_H : Math.floor(ctx.height / res);
        t = tank(w, h, experiment, num(params, 'gap'), {
          phaseStep: (num(params, 'phase') * Math.PI) / 180, moverSpeed: num(params, 'mach') * Math.sqrt(C2),
          ...(fixed ? { sponge: WIDE_SPONGE } : {}),
        });
        raster = new Raster(w, h);
      },
      pressed(x, y) {
        drop(t, ...cellAt(x, y));
      },
      dragged(x, y) {
        drop(t, ...cellAt(x, y), 0.9);
      },
      draw() {
        const lambda = num(params, 'lambda');
        const asked = num(params, 'speed');
        // clamped to the stop: the frame that reaches it steps only the steps left
        const steps = stop.allow(stepsWithin(asked, t.w * t.h, t.w === WIDE_W && t.h === WIDE_H ? WIDE_CELL_STEPS : CELL_STEPS_PER_FRAME));
        stop.advance(steps);
        for (let s = 0; s < steps; s++) {
          if (recorded < record.length) record[recorded++] = t.u[pickup];
          advance(t, lambda);
        }
        const extra = measure(lambda);
        const { w, h, u, intensity, wall, barrierX, step } = t;

        const pal = ctx.palette();
        const view = str(params, 'view');
        const wallC = mix(ctx.bg, ctx.fg, 0.75);
        let peak = 1e-6;
        if (view === 'intensity') for (let i = 0; i < intensity.length; i++) {
          if (intensity[i] > peak && (i % w) > barrierX + 4) peak = intensity[i];
        }
        for (let i = 0; i < u.length; i++) {
          if (wall[i]) {
            raster.data.set([wallC[0], wallC[1], wallC[2], 255], i * 4);
            continue;
          }
          const c = view === 'intensity'
            ? mix(ctx.bg, ramp(pal, Math.min(1, intensity[i] / peak)), Math.min(1, Math.sqrt(intensity[i] / peak) * 1.4))
            : ramp(pal, 0.5 + Math.max(-0.5, Math.min(0.5, u[i] * 0.55)));
          raster.data[i * 4] = c[0];
          raster.data[i * 4 + 1] = c[1];
          raster.data[i * 4 + 2] = c[2];
          raster.data[i * 4 + 3] = 255;
        }
        raster.blit(p, true);

        ctx.stats([
          { label: 'grid', value: `${w}×${h} cells of ${bounded(res, num(params, 'res'), ' px')}` },
          { label: 'time steps', value: step.toLocaleString('en') },
          { label: 'steps this frame', value: bounded(steps, asked) },
          { label: 'wave speed', value: `${Math.sqrt(C2).toFixed(3)} cells / step` },
          { label: 'period', value: `${(num(params, 'lambda') / Math.sqrt(C2)).toFixed(1)} steps` },
          ...extra,
          ...stop.rows(),
        ]);
      },
    };
  },
};

export default rippleTank;
