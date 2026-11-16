// Stable fluids, solved in WebAssembly (crates/algoglyph-kernels/src/fluids.rs, ADR 0004 §6):
// the solver exists only in Rust; this plate injects sources, steps it, and draws the dye
// field it reads straight out of the module's memory.
import { paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import init from '../../wasm/algoglyph_kernels.wasm?init';
import { runsParam, StreamStop } from '../_shared/settle/settle';
import { centredLoop, stokes } from './stokes';

interface Fluids {
  memory: WebAssembly.Memory;
  ag_fluid_new(n: number): number;
  ag_fluid_free(h: number): void;
  ag_fluid_add(h: number, i: number, j: number, dye: number, du: number, dv: number): void;
  ag_fluid_step(h: number, dt: number, visc: number, diff: number, iters: number): void;
  ag_fluid_density(h: number): number;
  ag_fluid_u(h: number): number;
  ag_fluid_v(h: number): number;
  ag_fluid_stats(h: number): number;
}

const wasm = (await init({})).exports as unknown as Fluids;
// one fluid at a time: a rebuilt plate frees the one before it
let held = 0;

export const stableFluids: PlateCode = {
  id: 'stable-fluids',
  mode: '2d',
  aspect: 1,
  thumbnailFrames: 2,
  params: [
    { kind: 'range', key: 'n', label: 'Grid cells per side', min: 32, max: 128, step: 8, value: 96, rebuild: true },
    { kind: 'range', key: 'iters', label: 'Solver sweeps per step', min: 2, max: 20, step: 1, value: 14,
      hint: 'Fewer sweeps leave more divergence after projection: watch the readout.' },
    { kind: 'range', key: 'visc', label: 'Viscosity (×10⁻⁵)', min: 0, max: 50, step: 1, value: 1 },
    { kind: 'range', key: 'diff', label: 'Dye diffusion (×10⁻⁵)', min: 0, max: 50, step: 1, value: 1 },
    { kind: 'toggle', key: 'emit', label: 'Seeded emitters', value: true },
    { kind: 'range', key: 'loop', label: 'Circulation loop (share of the box)', min: 0.1, max: 0.9,
      step: 0.05, value: 0.5,
      hint: 'The dashed square: the circulation around it, and the vorticity flux through it.' },
    paletteParam('abyss'),
    // a stop costs nothing, so its top is not a budget's: past 20000 steps a reader lets it run on
    runsParam({ unit: 'steps', max: 20000, note: 'One step a frame.' }),
  ],
  pace: { kind: 'stream', emergent: 'a fluid solver: one time step per frame of simulated flow' },
  create(p, ctx) {
    const n = num(ctx.params, 'n');
    if (held) wasm.ag_fluid_free(held);
    const h = wasm.ag_fluid_new(n);
    held = h;
    const img = p.createImage(n, n);
    const emitters = Array.from({ length: 3 }, () => ({
      x: 0.2 + 0.6 * ctx.rnd(), y: 0.2 + 0.6 * ctx.rnd(), a: ctx.rnd() * Math.PI * 2, w: 0.02 + 0.05 * ctx.rnd(),
    }));
    let stepMs = 0;
    const stop = new StreamStop(ctx.params, 1);
    const history: [number, number, number][] = [];
    let t = 0;
    let last: [number, number] | null = null;
    const cell = (x: number, y: number): [number, number] => [
      Math.min(n, Math.max(1, 1 + Math.floor((x / ctx.width) * n))),
      Math.min(n, Math.max(1, 1 + Math.floor((y / ctx.height) * n))),
    ];
    const step = () => {
      if (!stop.allow(1)) return;
      stop.advance(1);
      if (bool(ctx.params, 'emit')) {
        for (const e of emitters) {
          const a = e.a + e.w * t;
          const [i, j] = cell(e.x * ctx.width, e.y * ctx.height);
          wasm.ag_fluid_add(h, i, j, 90, Math.cos(a) * 4, Math.sin(a) * 4);
        }
      }
      const t0 = performance.now();
      wasm.ag_fluid_step(h, 0.1, num(ctx.params, 'visc') * 1e-5, num(ctx.params, 'diff') * 1e-5, num(ctx.params, 'iters'));
      stepMs = 0.9 * stepMs + 0.1 * (performance.now() - t0);
      t++;
    };
    const draw = () => {
      // a fresh view each frame: the module's memory may have grown and moved
      const d = new Float32Array(wasm.memory.buffer, wasm.ag_fluid_density(h), (n + 2) * (n + 2));
      const pal = ctx.palette();
      img.loadPixels();
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const v = d[(i + 1) + (n + 2) * (j + 1)];
          const c = ramp(pal, Math.min(1, Math.log1p(Math.max(0, v)) / 4));
          const k = 4 * (i + n * j);
          img.pixels[k] = c[0]; img.pixels[k + 1] = c[1]; img.pixels[k + 2] = c[2]; img.pixels[k + 3] = 255;
        }
      }
      img.updatePixels();
      p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
      p.image(img, 0, 0, ctx.width, ctx.height);
      // the loop the circulation runs along, on the cells' outer faces
      const q = centredLoop(n, num(ctx.params, 'loop'));
      const sx = ctx.width / n;
      const sy = ctx.height / n;
      p.push();
      p.noFill();
      p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 90);
      p.strokeWeight(1);
      const g = p.drawingContext as CanvasRenderingContext2D;
      g.setLineDash([4, 4]);
      p.rect((q.a - 1) * sx, (q.c - 1) * sy, (q.b - q.a + 1) * sx, (q.d - q.c + 1) * sy);
      g.setLineDash([]);
      p.pop();
    };
    return {
      setup() {
        if (ctx.thumbnail) for (let s = 0; s < 60; s++) step();
        // the thumbnail's warm-up is not the reader's run
        stop.reset();
      },
      draw() {
        if (!ctx.thumbnail) step();
        draw();
        const s = new Float32Array(wasm.memory.buffer, wasm.ag_fluid_stats(h), 4);
        const size = (n + 2) * (n + 2);
        const st = stokes(n, new Float32Array(wasm.memory.buffer, wasm.ag_fluid_u(h), size),
          new Float32Array(wasm.memory.buffer, wasm.ag_fluid_v(h), size),
          centredLoop(n, num(ctx.params, 'loop')));
        if (!ctx.thumbnail && s[1] > 0) {
          history.push([t, s[1], s[2]]);
          if (history.length > 400) history.shift();
          ctx.chart({
            title: 'Divergence left by projection',
            x: { label: 'step' },
            y: { label: 'max |divergence|', log: true },
            series: [
              { name: 'Before projection', points: history.map((q) => [q[0], q[1]]) },
              { name: 'After projection', points: history.map((q) => [q[0], q[2]]) },
            ],
          });
        }
        ctx.stats([
          { label: 'Dye in the box', value: s[0].toFixed(1) },
          { label: 'Max divergence before projection', value: s[1].toExponential(2) },
          { label: 'Max divergence after projection', value: s[2].toExponential(2) },
          { label: 'Kinetic energy', value: s[3].toExponential(2) },
          { label: 'circulation ∮v·dl around the loop', value: st.circulation.toExponential(4) },
          { label: 'vorticity flux ∬ω dA through it', value: st.flux.toExponential(4) },
          { label: 'Stokes gap |∮ − ∬| / Σ|terms|', value: st.gap.toExponential(1) },
          { label: 'Solver step (wasm)', value: `${stepMs.toFixed(2)} ms for ${n}² cells` },
          ...stop.rows(),
        ]);
      },
      dragged(x, y) {
        const [i, j] = cell(x, y);
        const [pi, pj] = last ?? [i, j];
        wasm.ag_fluid_add(h, i, j, 160, (i - pi) * 2, (j - pj) * 2);
        last = [i, j];
      },
      pressed(x, y) {
        last = cell(x, y);
      },
    };
  },
};

export default stableFluids;
