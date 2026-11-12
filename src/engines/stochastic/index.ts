// The stochastic engine: sampling, search, inference and uncertainty kernels, each run once on a
// seeded scenario with every draw and evaluation counted, then replayed frame by frame
// (histograms filling, posteriors updating, particles moving). A lab replays several kernels
// side by side on the same seed and compares one measured series of each (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp } from '../../core/palette';
import { bool, type ParamDef, type Params, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { drawPanels } from './draw';
import { fmt } from './sample';
import { Runner, type Frame, type StochasticKernel } from './trace';
import { HOLD_FRAMES, Pacer, paceParam, type PaceReport } from '../../core/pace';

/** The most recorded frames a frame steps, at the pace control's top: the old slider's maximum. */
const MAX_FRAMES_PER_FRAME = 4;
const GENERATION = 7919;
/** Work a replay may do per drawn frame (ms): the run advances in pieces within it. */
export const STEP_MS = 6;
/** Pieces a live frame resumes at most (a counted bound beside the wall-clock slice). */
export const PIECES_PER_FRAME = 2;
/** Work a gallery thumbnail may do before it draws the latest recorded frame (ms). */
export const THUMBNAIL_MS = 25;

const replayParams = (): ParamDef[] => [
  paceParam(),
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

const EMPTY: Frame = { panels: [], stats: [{ label: 'Run', value: 'starting' }], draws: 0, evals: 0, series: [] };

/** The replay of a run that is still being computed: the run advances within a budget per
 * frame, the replay shows what is recorded, and the next seed's run is prepared in pieces
 * while the finished one is held, so starting it never stalls a frame. */
export class Replay {
  at = 0;
  hold = 0;
  generation = 0;
  run: Runner;
  next: Runner | null = null;
  /** Replayed as it is recorded: at the ceiling until the run ends, then from its length. */
  readonly pacer = new Pacer('views', 'recorded frames', MAX_FRAMES_PER_FRAME);
  constructor(private readonly kernel: StochasticKernel, private readonly ctx: PlateContext,
    private readonly budget = STEP_MS) {
    this.run = this.build(0);
  }
  private build(generation: number): Runner {
    return new Runner(this.kernel, this.ctx.params as Params, this.ctx.seed + generation * GENERATION);
  }
  get last(): number { return Math.max(0, this.run.frames.length - 1); }
  get frame(): Frame { return this.run.frames[Math.min(this.last, Math.floor(this.at))] ?? EMPTY; }
  get done(): boolean { return this.run.done && this.at >= this.last; }
  /** Compute up to `ms` of the run and show its latest frame (thumbnails); if nothing is
   * recorded yet, keep going, up to four times the budget, so there is a picture to show. */
  settle(ms: number): void {
    const end = performance.now() + 4 * ms;
    this.run.step(ms);
    while (!this.run.frames.length && !this.run.done && performance.now() < end) this.run.step(STEP_MS);
    this.at = this.last;
  }
  tick(): void {
    if (!this.run.done) this.run.step(this.budget, PIECES_PER_FRAME);
    if (this.pacer.length === null && this.run.done) this.pacer.known(this.last, Math.floor(this.at));
    if (!this.done) {
      this.at = Math.min(this.last, this.at + this.pacer.take(this.ctx.params as Params));
      return;
    }
    if (!bool(this.ctx.params, 'loop')) return;
    this.next ??= this.build(this.generation + 1);
    this.next.step(this.budget, PIECES_PER_FRAME);
    if (++this.hold > HOLD_FRAMES) {
      this.generation++;
      this.hold = 0;
      this.at = 0;
      this.run = this.next;
      this.next = null;
      this.pacer.start();
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
    pace: { kind: 'views', unit: 'recorded frames' },
    create(p: p5, ctx: PlateContext) {
      const r = new Replay(kernel, ctx);
      return {
        setup() {
          if (ctx.thumbnail) r.settle(THUMBNAIL_MS);
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
            { label: 'Replay', value: `frame ${fmt(Math.floor(r.at) + 1)} of ${fmt(r.last + 1)}${r.run.done ? '' : ' recorded so far'}` },
            r.pacer.row(ctx.params),
          ]);
          ctx.chart({ ...kernel.chart, series: seriesOf(f) });
        },
        pace: () => r.pacer.report(r.done, ctx.params),
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
    pace: { kind: 'views', unit: 'recorded frames' },
    create(p, ctx) {
      // the frame's work budget is shared between the panes
      const share = kernels.length ? STEP_MS / kernels.length : STEP_MS;
      const panes = kernels.map((k) => ({ ...k, r: new Replay(k.kernel, ctx, share) }));
      // each pane replays its own run at its own calm pace; the lab lasts as long as the
      // slowest, the one whose length is still unknown or whose run lasts longest
      const slowest = () => panes.map((x) => x.r).reduce((a, b) => {
        const sa = a.pacer.seconds(ctx.params); const sb = b.pacer.seconds(ctx.params);
        return sa === null ? a : sb === null || sb > sa ? b : a;
      });
      return {
        setup() {
          if (ctx.thumbnail) for (const pane of panes) pane.r.settle(THUMBNAIL_MS / panes.length);
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
          }).concat(panes.length ? [slowest().pacer.row(ctx.params)] : []));
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
        pace: (): PaceReport => ({ ...slowest().pacer.report(panes.every((x) => x.r.done), ctx.params) }),
      };
    },
  };
}

export const engine: Engine<StochasticKernel> = { id: 'stochastic', plate, lab };
