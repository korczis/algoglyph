import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { bounded, cellWithin, stepsWithin } from '../../core/budget';
import { field, PRESETS, seed, step, type Field } from './grayscott';

/** Cells in the grid at most, and cell updates (cells × steps) per frame (src/core/budget.ts). */
export const MAX_CELLS = 90_000;
export const CELL_STEPS_PER_FRAME = 500_000;

export const grayScott: PlateCode = {
  id: 'gray-scott',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 160,
  params: [
    {
      kind: 'select', key: 'preset', label: 'Regime', value: 'coral', rebuild: true,
      options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })),
    },
    { kind: 'range', key: 'df', label: 'Feed f offset', min: -0.01, max: 0.01, step: 0.0005,
      value: 0 },
    { kind: 'range', key: 'dk', label: 'Kill k offset', min: -0.005, max: 0.005, step: 0.0002,
      value: 0 },
    { kind: 'range', key: 'res', label: 'Cell size (px)', min: 2, max: 6, step: 1, value: 3,
      rebuild: true },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 40, step: 1, value: 14 },
    paletteParam('abyss'),
  ],
  pace: { kind: 'stream', emergent: 'a reaction-diffusion integrator: its steps per frame set simulated time per frame' },
  create(p, ctx) {
    const params = ctx.params;
    let fl: Field;
    let raster: Raster;
    let res = 3;
    let steps = 0;

    const fk = () => {
      const preset = PRESETS[str(params, 'preset')] ?? PRESETS.coral;
      return [preset.f + num(params, 'df'), preset.k + num(params, 'dk')];
    };

    const paint = (x: number, y: number) => {
      seed(fl, Math.floor(x / res), Math.floor(y / res), 3);
    };

    return {
      setup() {
        res = cellWithin(ctx.width, ctx.height, num(params, 'res'), MAX_CELLS);
        const w = Math.floor(ctx.width / res);
        const h = Math.floor(ctx.height / res);
        fl = field(w, h);
        raster = new Raster(w, h);
        const drops = 6 + Math.floor(ctx.rnd() * 8);
        for (let d = 0; d < drops; d++) {
          seed(fl, Math.floor(ctx.rnd() * w), Math.floor(ctx.rnd() * h), 2 + Math.floor(ctx.rnd() * 5));
        }
        steps = 0;
      },
      pressed: (x, y) => paint(x, y),
      dragged: (x, y) => paint(x, y),
      draw() {
        const [f, k] = fk();
        const n = ctx.thumbnail ? 40 : stepsWithin(num(params, 'speed'), fl.v.length, CELL_STEPS_PER_FRAME);
        for (let s = 0; s < n; s++) step(fl, f, k);
        steps += n;

        const pal = ctx.palette();
        let sum = 0;
        for (let i = 0; i < fl.v.length; i++) {
          const v = fl.v[i];
          sum += v;
          const t = Math.min(1, Math.max(0, v * 2.6));
          const c = mix(ctx.bg, ramp(pal, t), Math.min(1, t * 1.6));
          raster.set(i % fl.w, Math.floor(i / fl.w), c[0], c[1], c[2]);
        }
        raster.blit(p, true);

        ctx.stats([
          { label: 'regime', value: `f ${f.toFixed(4)}, k ${k.toFixed(4)}` },
          { label: 'steps', value: steps.toLocaleString('en') },
          { label: 'mean V', value: (sum / fl.v.length).toFixed(4) },
          { label: 'steps this frame', value: bounded(n, ctx.thumbnail ? n : num(params, 'speed')) },
          { label: 'grid', value: `${fl.w}×${fl.h} (torus), cells ${bounded(res, num(params, 'res'), ' px')}` },
        ]);
      },
    };
  },
};

export default grayScott;
