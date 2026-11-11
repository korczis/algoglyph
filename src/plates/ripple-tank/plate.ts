import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { advance, C2, drop, tank, type Experiment, type Tank } from './wave';

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
    paletteParam('abyss'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let res = 3;
    let t: Tank;
    let raster: Raster;

    return {
      setup() {
        res = num(params, 'res');
        const w = Math.floor(ctx.width / res);
        const h = Math.floor(ctx.height / res);
        t = tank(w, h, str(params, 'experiment') as Experiment, num(params, 'gap'));
        raster = new Raster(w, h);
      },
      pressed(x, y) {
        drop(t, Math.floor(x / res), Math.floor(y / res));
      },
      dragged(x, y) {
        drop(t, Math.floor(x / res), Math.floor(y / res), 0.9);
      },
      draw() {
        const lambda = num(params, 'lambda');
        const steps = num(params, 'speed');
        for (let s = 0; s < steps; s++) advance(t, lambda);
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
          { label: 'grid', value: `${w}×${h} cells` },
          { label: 'time steps', value: step.toLocaleString('en') },
          { label: 'wave speed', value: `${Math.sqrt(C2).toFixed(3)} cells / step` },
          { label: 'period', value: `${(num(params, 'lambda') / Math.sqrt(C2)).toFixed(1)} steps` },
        ]);
      },
    };
  },
};

export default rippleTank;
