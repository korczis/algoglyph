// The stochastic engine: sampling, search, inference and uncertainty kernels, each run once on a
// seeded scenario with every draw and evaluation counted, then replayed frame by frame
// (histograms filling, posteriors updating, particles moving). A lab replays several kernels
// side by side on the same seed and compares one measured series of each (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp } from '../../core/palette';
import { bool, num, type ParamDef, type Params, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { drawPanels } from './draw';
import { fmt } from './sample';
import { trace, type Frame, type Run, type StochasticKernel } from './trace';

const HOLD_FRAMES = 150;
const GENERATION = 7919;

const replayParams = (): ParamDef[] => [
  { kind: 'range', key: 'speed', label: 'Recorded frames per frame', min: 0.05, max: 4, step: 0.05, value: 0.5 },
  { kind: 'toggle', key: 'loop', label: 'New seed when done', value: true },
];

function counted(f: Frame): Stat[] {
  const rows: Stat[] = [{ label: 'Random draws', value: fmt(f.draws) }];
  if (f.evals) rows.push({ label: 'Evaluations', value: fmt(f.evals) });
  return rows;
}

function seriesOf(f: Frame) {
  return f.series.map(([name, pts, len]) => ({ name, points: pts.slice(0, len) }));
}

/** A replay of one run: which frame is shown, and when to start a new seed. */
class Replay {
  at = 0;
  hold = 0;
  generation = 0;
  run: Run;
  constructor(private readonly kernel: StochasticKernel, private readonly ctx: PlateContext) {
    this.run = this.build();
  }
  private build(): Run {
    return trace(this.kernel, this.ctx.params as Params, this.ctx.seed + this.generation * GENERATION);
  }
  get last(): number { return this.run.frames.length - 1; }
  get frame(): Frame { return this.run.frames[Math.min(this.last, Math.floor(this.at))]; }
  get done(): boolean { return this.at >= this.last; }
  tick(): void {
    if (!this.done) this.at = Math.min(this.last, this.at + num(this.ctx.params, 'speed'));
    else if (bool(this.ctx.params, 'loop') && ++this.hold > HOLD_FRAMES) {
      this.generation++;
      this.hold = 0;
      this.at = 0;
      this.run = this.build();
    }
  }
}

function plate(info: KernelInfo, kernel: StochasticKernel): PlateCode {
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 9,
    thumbnailFrames: 2,
    params: [...(kernel.params ?? []), ...replayParams(), paletteParam(kernel.palette ?? 'abyss')],
    create(p: p5, ctx: PlateContext) {
      const r = new Replay(kernel, ctx);
      return {
        setup() {
          if (ctx.thumbnail) r.at = r.last;
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) r.tick();
          const f = r.frame;
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          drawPanels(p, ctx, f.panels, { x: pad, y: pad, w: ctx.width - 2 * pad, h: ctx.height - 2 * pad });
          ctx.stats([
            ...f.stats,
            ...counted(f),
            { label: 'Replay', value: `frame ${fmt(Math.floor(r.at) + 1)} of ${fmt(r.last + 1)}` },
          ]);
          ctx.chart({ ...kernel.chart, series: seriesOf(f) });
        },
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: StochasticKernel }[]): PlateCode {
  // the union of the kernels' controls, the first declaration of a key winning
  const params: ParamDef[] = [];
  for (const k of kernels) for (const d of k.kernel.params ?? []) if (!params.some((q) => q.key === d.key)) params.push(d);
  const first = kernels[0]?.kernel;
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: [...params, ...replayParams(), paletteParam(first?.palette ?? 'abyss')],
    create(p, ctx) {
      const panes = kernels.map((k) => ({ ...k, r: new Replay(k.kernel, ctx) }));
      return {
        setup() {
          if (ctx.thumbnail) for (const pane of panes) pane.r.at = pane.r.last;
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) for (const pane of panes) pane.r.tick();
          const W = ctx.width;
          const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.03));
          const m = panes.length;
          const cols = m <= 3 ? 1 : 2;
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (H - pad * (rows + 1)) / rows;
          const fs = Math.max(9, Math.min(14, Math.round(ch * 0.07)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            const c = ramp(ctx.palette(), m < 2 ? 0.5 : i / (m - 1));
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.rect(x, y, 4, fs + 2);
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(pane.info.title, x + 8, y);
            drawPanels(p, ctx, pane.r.frame.panels, { x, y: y + fs + 8, w: cw, h: ch - fs - 8 });
          });
          ctx.stats(panes.map((pane) => {
            const f = pane.r.frame;
            const head = f.stats.slice(0, 2).map((s) => `${s.label} ${s.value}`).join(' · ');
            return { label: pane.info.title, value: `${head} · ${fmt(f.draws)} draws` };
          }));
          if (first) {
            ctx.chart({
              ...first.chart,
              series: panes.flatMap((pane) => {
                const want = pane.kernel.labSeries;
                const s = seriesOf(pane.r.frame).find((q) => q.name === want) ?? seriesOf(pane.r.frame)[0];
                return s ? [{ name: pane.info.title, points: s.points }] : [];
              }),
            });
          }
        },
      };
    },
  };
}

export const engine: Engine<StochasticKernel> = { id: 'stochastic', plate, lab };
