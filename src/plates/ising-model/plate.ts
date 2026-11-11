import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import {
  energy, lattice, magnetisation, sweep, T_CRITICAL, type Lattice, type Start,
} from './ising';
import { bounded, cellWithin, stepsWithin } from '../../core/budget';

/** Spins in the lattice at most, and spin updates (spins × sweeps) per frame (src/core/budget.ts). */
export const MAX_SITES = 90_000;
export const SPIN_UPDATES_PER_FRAME = 900_000;

// How fast the drawn spin follows the real one, and how fast a flip's glow fades, per frame.
const FOLLOW = 0.35;
const FADE = 0.8;

export const isingModel: PlateCode = {
  id: 'ising-model',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 120,
  params: [
    { kind: 'range', key: 'temperature', label: 'Temperature T', min: 0.5, max: 5, step: 0.01,
      value: 2.27, hint: 'Onsager: Tc ≈ 2.269' },
    { kind: 'range', key: 'field', label: 'External field h', min: -1, max: 1, step: 0.01,
      value: 0 },
    { kind: 'range', key: 'cell', label: 'Cell size (px)', min: 2, max: 8, step: 1, value: 3,
      rebuild: true },
    { kind: 'range', key: 'speed', label: 'Sweeps per frame', min: 1, max: 20, step: 1,
      value: 2 },
    {
      kind: 'select', key: 'start', label: 'Start state', value: 'random', rebuild: true,
      options: [
        { value: 'random', label: 'Random (hot)' },
        { value: 'ordered', label: 'All up (cold)' },
      ],
    },
    { kind: 'toggle', key: 'glow', label: 'Light up flips', value: true },
    { kind: 'toggle', key: 'soft', label: 'Soften pixels', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let lat: Lattice;
    let raster: Raster;
    let shown: Float32Array;
    let heat: Float32Array;
    let flipped: Uint8Array;
    let cell = 3;
    let sweeps = 0;
    let acceptance = 0;
    let paint = 1;

    const site = (x: number, y: number) => {
      const ox = (ctx.width - lat.w * cell) / 2;
      const oy = (ctx.height - lat.h * cell) / 2;
      return [Math.floor((x - ox) / cell), Math.floor((y - oy) / cell)];
    };

    const brush = (x: number, y: number) => {
      const [cx, cy] = site(x, y);
      const r = Math.max(2, Math.round(16 / cell));
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const i = ((cy + dy + lat.h * 4) % lat.h) * lat.w + ((cx + dx + lat.w * 4) % lat.w);
          lat.s[i] = paint;
        }
      }
    };

    return {
      setup() {
        cell = cellWithin(ctx.width, ctx.height, num(params, 'cell'), MAX_SITES);
        const w = Math.max(8, Math.floor(ctx.width / cell));
        const h = Math.max(8, Math.floor(ctx.height / cell));
        const start: Start = str(params, 'start') === 'ordered' ? 'ordered' : 'random';
        lat = lattice(w, h, start, ctx.rnd);
        raster = new Raster(w, h);
        shown = Float32Array.from(lat.s);
        heat = new Float32Array(w * h);
        flipped = new Uint8Array(w * h);
        sweeps = 0;
        acceptance = 0;
      },
      pressed(x, y) {
        const [cx, cy] = site(x, y);
        const i = (((cy % lat.h) + lat.h) % lat.h) * lat.w + (((cx % lat.w) + lat.w) % lat.w);
        paint = -lat.s[i];
        brush(x, y);
      },
      dragged: (x, y) => brush(x, y),
      draw() {
        const t = num(params, 'temperature');
        const hField = num(params, 'field');
        const n = ctx.thumbnail ? 2 : stepsWithin(num(params, 'speed'), lat.s.length, SPIN_UPDATES_PER_FRAME);
        flipped.fill(0);
        for (let k = 0; k < n; k++) {
          acceptance = sweep(lat, t, hField, ctx.rnd, flipped) / lat.s.length;
        }
        sweeps += n;

        const pal = ctx.palette();
        const down = mix(ctx.bg, ramp(pal, 0.08), 0.6);
        const up = mix(ctx.bg, ramp(pal, 0.9), 0.95);
        const spark = ramp(pal, 0.5);
        const glow = bool(params, 'glow');
        const { w, s } = lat;
        for (let i = 0; i < s.length; i++) {
          shown[i] += (s[i] - shown[i]) * FOLLOW;
          heat[i] = flipped[i] ? 1 : heat[i] * FADE;
          let c = mix(down, up, (shown[i] + 1) / 2);
          if (glow && heat[i] > 0.02) c = mix(c, spark, heat[i] * 0.7);
          raster.set(i % w, (i - (i % w)) / w, c[0], c[1], c[2]);
        }
        p.background(...ctx.bg);
        const ox = (ctx.width - lat.w * cell) / 2;
        const oy = (ctx.height - lat.h * cell) / 2;
        raster.blit(p, bool(params, 'soft'), ox, oy, lat.w * cell, lat.h * cell);

        const m = magnetisation(lat);
        ctx.stats([
          { label: 'temperature', value: `T ${t.toFixed(2)} = ${(t / T_CRITICAL).toFixed(3)} Tc` },
          { label: 'magnetisation', value: `m ${m.toFixed(3)}, |m| ${Math.abs(m).toFixed(3)}` },
          { label: 'energy per spin', value: (energy(lat, hField) / s.length).toFixed(4) },
          { label: 'acceptance (last sweep)', value: `${(acceptance * 100).toFixed(1)} %` },
          { label: 'sweeps', value: sweeps.toLocaleString('en') },
          { label: 'sweeps this frame', value: bounded(n, ctx.thumbnail ? n : num(params, 'speed')) },
          { label: 'lattice', value: `${lat.w}×${lat.h} (torus), cells ${bounded(cell, num(params, 'cell'), ' px')}` },
        ]);
      },
    };
  },
};

export default isingModel;
