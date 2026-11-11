import { mix, paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import {
  ABSORB, DT, N, RANGES, Scattering, X_LEFT, X_RIGHT, type Shares,
} from './experiment';
import type { Potential, Preset, Wave } from './schrodinger';

/** Simulated time per frame in the gallery thumbnail. */
const THUMB_STEPS = 40;

const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const pct = (v: number) => `${(100 * v).toFixed(2)} %`;

export const quantumTunnelling: PlateCode = {
  id: 'quantum-tunnelling',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 100,
  params: [
    {
      kind: 'select', key: 'preset', label: 'Potential', value: 'single', rebuild: true,
      options: [
        { value: 'single', label: 'Single barrier' },
        { value: 'double', label: 'Double barrier (resonant)' },
        { value: 'step', label: 'Potential step' },
      ],
    },
    { kind: 'range', key: 'k0', label: 'Momentum k₀ (E ≈ k₀²/2)', ...RANGES.k0, step: 0.05,
      value: 1.5, rebuild: true },
    { kind: 'range', key: 'v0', label: 'Barrier height V₀', ...RANGES.v0, step: 0.05,
      value: 1.2, rebuild: true },
    { kind: 'range', key: 'width', label: 'Barrier width a', ...RANGES.width, step: 0.1,
      value: 2, rebuild: true, hint: 'Each of the two barriers in the double barrier.' },
    { kind: 'range', key: 'sigma', label: 'Packet width σ', ...RANGES.sigma, step: 0.5, value: 5,
      rebuild: true },
    { kind: 'range', key: 'speed', label: `Steps per frame (Δt = ${DT})`, min: 4, max: 64,
      step: 4, value: 24 },
    {
      kind: 'select', key: 'colour', label: 'Colour by', value: 'density',
      options: [
        { value: 'density', label: 'Probability density' },
        { value: 'phase', label: 'Phase arg ψ' },
      ],
    },
    { kind: 'toggle', key: 'parts', label: 'Show Re ψ and Im ψ', value: true },
    paletteParam('abyss'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let run: Scattering;
    let wave: Wave;
    let pot: Potential;
    let raster: Raster;
    let cols = 0;
    let first: Int32Array;
    let rowSteps = 1;
    let runs = 0;
    let last: Shares | null = null;
    /** [t, reflected, inside, transmitted] of the current run, sampled with the ribbon rows. */
    let history: [number, number, number, number][] = [];
    const xL = X_LEFT;
    const xR = X_RIGHT;
    const px = (x: number) => ((x - xL) / (xR - xL)) * ctx.width;
    const top = ctx.height * 0.07;
    const ground = ctx.height * 0.56;
    const ribbonTop = ctx.height * 0.6;


    /** The largest |ψ|² among the grid cells that column c covers, so no peak is skipped. */
    const binPeak = (c: number) => {
      const { re, im } = wave;
      let m = 0;
      for (let i = first[c]; i < first[c + 1]; i++) m = Math.max(m, re[i] * re[i] + im[i] * im[i]);
      return m;
    };

    const pushRow = (separator: boolean) => {
      const d = raster.data;
      const stride = raster.w * 4;
      d.copyWithin(stride, 0, d.length - stride);
      const pal = ctx.palette();
      const phase = str(params, 'colour') === 'phase';
      const { re, im } = wave;
      for (let c = 0; c < cols; c++) {
        let out: RGB;
        if (separator) out = mix(ctx.bg, ctx.fg, 0.28);
        else {
          const t = Math.min(1, Math.sqrt(binPeak(c) / run.peak0) * 1.1);
          const j = first[c];
          const hue = phase
            ? ramp(pal, (Math.atan2(im[j], re[j]) + Math.PI) / (2 * Math.PI), true)
            : ramp(pal, 0.2 + 0.8 * t);
          out = mix(ctx.bg, hue, Math.min(1, 1.6 * t));
        }
        d[c * 4] = out[0];
        d[c * 4 + 1] = out[1];
        d[c * 4 + 2] = out[2];
        d[c * 4 + 3] = 255;
      }
    };

    return {
      setup() {
        run = new Scattering({
          preset: str(params, 'preset') as Preset, k0: num(params, 'k0'), v0: num(params, 'v0'),
          width: num(params, 'width'), sigma: num(params, 'sigma'),
        });
        wave = run.wave;
        pot = run.pot;
        history = [];
        cols = Math.max(64, Math.min(N - 2 * ABSORB, Math.floor(ctx.width)));
        first = new Int32Array(cols + 1);
        for (let c = 0; c <= cols; c++) {
          first[c] = ABSORB + Math.floor((c * (N - 2 * ABSORB)) / cols);
        }
        raster = new Raster(cols, Math.max(24, Math.floor((ctx.height - ribbonTop) / 2)));
        raster.fill(ctx.bg);
        rowSteps = Math.max(1, Math.round(run.tRun / (raster.h * DT)));
        runs = 0;
        last = null;
      },
      draw() {
        // step in chunks that end on ribbon rows, so the potential half steps fuse in between
        let left = ctx.thumbnail ? THUMB_STEPS : Math.max(1, Math.round(num(params, 'speed')));
        while (left > 0) {
          const chunk = Math.min(left, rowSteps - (wave.steps % rowSteps));
          wave.step(chunk);
          left -= chunk;
          if (wave.steps % rowSteps !== 0) continue;
          pushRow(false);
          const sh = run.shares();
          history.push([wave.t, sh.reflected, sh.inside, sh.transmitted]);
          if (run.done()) {
            last = sh;
            runs++;
            pushRow(true);
            run.launch();
            history = [];
          }
        }
        const e0 = run.e0;
        const peak0 = run.peak0;

        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);

        raster.blit(p, true, 0, ribbonTop, W, H - ribbonTop);

        const v0 = pot.values.reduce((a, b) => Math.max(a, b), 0);
        const span = (ground - top) * 0.5 / Math.max(v0, e0, 1e-6);
        const yOf = (v: number) => ground - v * span;
        const yE = yOf(e0);
        g.save();

        // barrier blocks, carried down through the ribbon as faint bands
        const { edges, values } = pot;
        for (let j = 0; j < values.length; j++) {
          if (values[j] <= 0) continue;
          const a = Math.max(0, px(j === 0 ? xL : edges[j - 1]));
          const b = Math.min(W, px(j === edges.length ? xR : edges[j]));
          const yv = yOf(values[j]);
          const grad = g.createLinearGradient(0, yv, 0, ground);
          grad.addColorStop(0, rgba(ramp(pal, 0.85), ctx.theme === 'dark' ? 0.22 : 0.3));
          grad.addColorStop(1, rgba(ramp(pal, 0.4), 0.05));
          g.fillStyle = grad;
          g.fillRect(a, yv, b - a, ground - yv);
          g.fillStyle = rgba(fg, 0.05);
          g.fillRect(a, ribbonTop, b - a, H - ribbonTop);
          g.strokeStyle = rgba(fg, 0.55);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(a, ground);
          g.lineTo(a, yv);
          g.lineTo(b, yv);
          g.lineTo(b, ground);
          g.stroke();
        }

        g.strokeStyle = rgba(fg, 0.25);
        g.beginPath();
        g.moveTo(0, ground + 0.5);
        g.lineTo(W, ground + 0.5);
        g.moveTo(0, ribbonTop - 0.5);
        g.lineTo(W, ribbonTop - 0.5);
        g.stroke();
        g.setLineDash([3, 5]);
        g.strokeStyle = rgba(fg, 0.4);
        g.beginPath();
        g.moveTo(0, yE);
        g.lineTo(W, yE);
        g.stroke();
        g.setLineDash([]);

        const { re, im } = wave;
        const amp = ((ground - top) * 0.42) / peak0;
        const ampPsi = ((ground - top) * 0.26) / Math.sqrt(peak0);
        const xs = new Float64Array(cols);
        const ys = new Float64Array(cols);
        for (let c = 0; c < cols; c++) {
          xs[c] = ((c + 0.5) / cols) * W;
          ys[c] = yE - binPeak(c) * amp;
        }
        const curve = new Path2D();
        curve.moveTo(0, yE);
        for (let c = 0; c < cols; c++) curve.lineTo(xs[c], ys[c]);
        curve.lineTo(W, yE);

        if (str(params, 'colour') === 'phase') {
          const cw = W / cols + 0.6;
          for (let c = 0; c < cols; c++) {
            if (yE - ys[c] < 0.3) continue;
            const j = first[c];
            const hue = ramp(pal, (Math.atan2(im[j], re[j]) + Math.PI) / (2 * Math.PI), true);
            g.fillStyle = rgba(hue, 0.8);
            g.fillRect(xs[c] - cw / 2, ys[c], cw, yE - ys[c]);
          }
        } else {
          const grad = g.createLinearGradient(0, yE - peak0 * amp, 0, yE);
          grad.addColorStop(0, rgba(ramp(pal, 1), 0.9));
          grad.addColorStop(0.55, rgba(ramp(pal, 0.6), 0.45));
          grad.addColorStop(1, rgba(ramp(pal, 0.3), 0.08));
          g.fillStyle = grad;
          g.fill(curve);
        }
        g.shadowColor = rgba(ramp(pal, 0.85), 0.9);
        g.shadowBlur = ctx.thumbnail ? 6 : 14;
        g.strokeStyle = rgba(ramp(pal, ctx.theme === 'dark' ? 0.95 : 0.7), 1);
        g.lineWidth = 1.4;
        g.stroke(curve);
        g.shadowBlur = 0;

        if (bool(params, 'parts')) {
          const parts: [Float64Array, number, number][] = [[re, 0.35, 0.75], [im, 0.7, 0.55]];
          for (const [arr, at, alpha] of parts) {
            g.strokeStyle = rgba(ramp(pal, at), alpha);
            g.lineWidth = 0.8;
            g.beginPath();
            for (let c = 0; c < cols; c++) {
              const y = yE - arr[first[c]] * ampPsi;
              if (c === 0) g.moveTo(xs[c], y);
              else g.lineTo(xs[c], y);
            }
            g.stroke();
          }
        }
        g.restore();

        const sh = run.shares();
        const r = sh.reflected;
        const t = sh.transmitted;
        const total = wave.norm() + wave.absorbedLeft + wave.absorbedRight;
        p.noStroke();
        p.fill(fg[0], fg[1], fg[2], 170);
        p.textFont('monospace');
        p.textSize(ctx.thumbnail ? 9 : 11);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(`R ${pct(r)}`, 10, ground - 6);
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text(`T ${pct(t)}`, W - 10, ground - 6);
        p.textAlign(p.RIGHT, p.TOP);
        p.text(`⟨H⟩₀ ${e0.toFixed(3)}`, W - 10, yE + 4);
        p.textAlign(p.LEFT, p.TOP);
        p.text(`V₀ ${v0.toFixed(2)}`, Math.max(10, px(edges[0]) + 4), yOf(v0) - 16);

        ctx.chart({
          title: 'Where the probability went, this run',
          x: { label: 't (ħ = m = 1)' },
          y: { label: 'probability' },
          series: [
            { name: 'Reflected', points: history.map((q) => [q[0], q[1]]) },
            { name: 'Inside the structure', points: history.map((q) => [q[0], q[2]]) },
            { name: 'Transmitted', points: history.map((q) => [q[0], q[3]]) },
          ],
        });
        ctx.stats([
          { label: 'time (ħ = m = 1)', value: `${wave.t.toFixed(2)} · run ${runs + 1}` },
          { label: 'norm, grid + absorbed', value: total.toFixed(10) },
          { label: 'reflected / inside / transmitted',
            value: `${pct(r)} / ${pct(sh.inside)} / ${pct(t)}` },
          { label: '⟨H⟩ of the state on the grid', value: wave.measure().energy.toFixed(4) },
          { label: 'plane-wave T at ⟨H⟩₀', value: pct(run.planeT) },
          { label: 'packet-averaged T', value: pct(run.packetT) },
          { label: 'last run: transmitted / inside',
            value: last ? `${pct(last.transmitted)} / ${pct(last.inside)}` : 'running' },
        ]);
      },
    };
  },
};

export default quantumTunnelling;
