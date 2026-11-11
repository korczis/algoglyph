import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type Plate } from '../../core/plate';
import { Raster } from '../../core/raster';

/** Courant number squared, (c·dt/dx)², kept under the 2D stability limit of 1/2. */
const C2 = 0.24;
const SPONGE = 18;

export const rippleTank: Plate = {
  id: 'ripple-tank',
  title: 'Ripple Tank',
  category: 'physics',
  mode: '2d',
  aspect: 16 / 10,
  summary: 'The wave equation on a grid: two sources, a double slit, a single slit. Switch to '
    + 'intensity and Young\'s interference fringes develop out of the noise.',
  notes: [
    'The water surface is the 2D wave equation solved by explicit finite differences (leapfrog '
      + 'in time, five-point Laplacian in space) with a Courant number of √0.24, inside the '
      + 'stability limit. An absorbing sponge at the edges keeps reflections down.',
    'Double slit: a plane wave hits a wall with two openings; each opening becomes a new source '
      + '(Huygens) and the two circular waves interfere. The intensity view averages the squared '
      + 'height over time, so bright fringes are where crests meet crests and dark ones where '
      + 'crests meet troughs.',
    'Click or drag in the tank to drop pebbles. Shorter wavelengths give more, narrower fringes.',
  ],
  complexity: 'O(cells) per step, explicit FD',
  tags: ['waves', 'interference', 'finite differences'],
  interaction: 'Click or drag to drop pebbles.',
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
    let w = 0;
    let h = 0;
    let res = 3;
    let u: Float32Array;
    let prev: Float32Array;
    let nxt: Float32Array;
    let intensity: Float32Array;
    let damp: Float32Array;
    let wall: Uint8Array;
    let raster: Raster;
    let step = 0;
    let experiment = 'double';
    let barrierX = 0;
    let sources: [number, number][] = [];

    const drop = (x: number, y: number, amp = 2.2) => {
      const cx = Math.floor(x / res);
      const cy = Math.floor(y / res);
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const xx = cx + dx;
          const yy = cy + dy;
          if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
          const i = yy * w + xx;
          if (!wall[i]) u[i] += amp * Math.exp(-(dx * dx + dy * dy) / 5);
        }
      }
    };

    return {
      setup() {
        res = num(params, 'res');
        w = Math.floor(ctx.width / res);
        h = Math.floor(ctx.height / res);
        u = new Float32Array(w * h);
        prev = new Float32Array(w * h);
        nxt = new Float32Array(w * h);
        intensity = new Float32Array(w * h);
        damp = new Float32Array(w * h);
        wall = new Uint8Array(w * h);
        raster = new Raster(w, h);
        experiment = str(params, 'experiment');
        const plane = experiment === 'double' || experiment === 'single';
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const edge = Math.min(plane ? SPONGE : x, w - 1 - x, y, h - 1 - y);
            const s = Math.max(0, (SPONGE - edge) / SPONGE);
            damp[y * w + x] = 1 - 0.12 * s * s;
          }
        }
        const gap = num(params, 'gap');
        barrierX = Math.floor(w * 0.28);
        if (plane) {
          const mid = Math.floor(h / 2);
          const open = (y: number) => experiment === 'double'
            ? Math.abs(Math.abs(y - mid) - gap / 2) <= 2
            : Math.abs(y - mid) <= Math.max(3, gap / 4);
          for (let y = 0; y < h; y++) {
            if (open(y)) continue;
            for (let x = barrierX; x < barrierX + 3; x++) wall[y * w + x] = 1;
          }
        }
        sources = experiment === 'two'
          ? [[Math.floor(w * 0.3), Math.floor(h / 2 - gap / 2)],
            [Math.floor(w * 0.3), Math.floor(h / 2 + gap / 2)]]
          : [];
        step = 0;
      },
      pressed(x, y) {
        drop(x, y);
      },
      dragged(x, y) {
        drop(x, y, 0.9);
      },
      draw() {
        const omega = (2 * Math.PI * Math.sqrt(C2)) / num(params, 'lambda');
        const steps = num(params, 'speed');
        for (let s = 0; s < steps; s++) {
          const drive = Math.sin(omega * step);
          if (experiment === 'double' || experiment === 'single') {
            for (let y = 1; y < h - 1; y++) u[y * w + 2] = drive;
          }
          for (const [sx, sy] of sources) u[sy * w + sx] = 1.4 * drive;
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = y * w + x;
              if (wall[i]) {
                nxt[i] = 0;
                continue;
              }
              const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 4 * u[i];
              nxt[i] = (2 * u[i] - prev[i] + C2 * lap) * damp[i];
            }
          }
          const t = prev;
          prev = u;
          u = nxt;
          nxt = t;
          for (let i = 0; i < u.length; i++) intensity[i] = intensity[i] * 0.992 + u[i] * u[i] * 0.008;
          step++;
        }

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
