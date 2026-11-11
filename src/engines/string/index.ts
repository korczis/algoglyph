// The string engine: search, parsing, compression, check digits, similarity and diff kernels,
// each drawn as a board of text strips, tables and lists replayed from its recorded trace. A
// plate runs one kernel; a lab runs several on one seeded input with the same budget of counted
// operations per frame and measures how each one's work grows with the input (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam } from '../../core/palette';
import { bool, num, str, type Chart, type ParamDef, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { Board, drawBoard } from './board';
import { input, KINDS, type InputKind } from './inputs';
import { Recording, trace, traceSteps, work, type StringKernel } from './trace';

const HOLD_FRAMES = 120;
/** Milliseconds of recording a plate resumes per frame (a kernel that yields; others run whole). */
export const SLICE_MS = 6;
const fmt = (x: number) => x.toLocaleString('en-US');

/** Least-squares slope of log(work) against log(n): the measured growth exponent. */
export function exponent(points: [number, number][]): number {
  const pts = points.filter(([n, w]) => n > 0 && w > 0).map(([n, w]) => [Math.log(n), Math.log(w)]);
  if (pts.length < 2) return NaN;
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let sxy = 0; let sxx = 0;
  for (const [a, b] of pts) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}

function inputParams(kind: InputKind, k: StringKernel, labMax?: number): ParamDef[] {
  const def = KINDS[kind];
  const out: ParamDef[] = [];
  if (def.shapes.length) {
    out.push({ kind: 'select', key: 'shape', label: 'Input', value: k.shape ?? def.shapes[0].value, rebuild: true, options: def.shapes });
  }
  const s = def.size;
  out.push({ kind: 'range', key: 'n', label: s.label, min: s.min, max: labMax ? Math.min(labMax, s.max) : s.max,
    step: s.step, value: k.size ?? s.value, rebuild: true });
  return out;
}

const tail = (k: StringKernel): ParamDef[] => [
  { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 2000, step: 1, value: k.speed ?? 3 },
  { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
  paletteParam('spectral'),
];

function record(kernel: StringKernel, ctx: PlateContext, generation: number): Recording {
  const x = input(kernel.input, num(ctx.params, 'n'), str(ctx.params, 'shape'), ctx.seed + generation * 7919);
  return new Recording(traceSteps(kernel, x as never, { ...ctx.params }));
}

function counterStats(b: Board): Stat[] {
  return b.t.labels.map((label, i) => ({ label, value: fmt(b.counts[i]) }));
}

function chartOf(kernel: StringKernel, b: Board): Chart {
  if (kernel.chart && b.plots.size) {
    return {
      title: kernel.chart.title,
      x: { label: kernel.chart.x, log: kernel.chart.xlog },
      y: { label: kernel.chart.y, log: kernel.chart.ylog },
      series: [...b.plots].map(([name, points]) => ({ name, points: points.slice() })),
    };
  }
  return {
    title: 'Work so far',
    x: { label: 'events replayed' },
    y: { label: 'count' },
    series: b.t.labels.map((name, i) => ({ name, points: b.history.map((q) => [q[0], q[i + 1]] as [number, number]) })),
  };
}

function plate(info: KernelInfo, kernel: StringKernel): PlateCode {
  return {
    id: info.id,
    mode: '2d',
    aspect: kernel.aspect ?? 4 / 3,
    thumbnailFrames: 2,
    params: [...inputParams(kernel.input, kernel), ...(kernel.params ?? []), ...tail(kernel)],
    create(p: p5, ctx) {
      // the run is recorded across frames (SLICE_MS each), the first one before anything is
      // shown and each new input while the finished board is held on screen
      let generation = 0;
      let b: Board | null = null;
      let next: Recording | null = record(kernel, ctx, generation);
      let hold = 0;
      const take = () => { b = new Board(next!.trace!); next = null; hold = 0; };
      return {
        setup() {
          if (ctx.thumbnail) { next!.pump(Infinity); take(); b!.seek(0.45); }
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            next?.pump(SLICE_MS);
            if (!b) { if (next?.done) take(); }
            else if (!b.done) b.advance(num(ctx.params, 'speed'));
            else if (bool(ctx.params, 'loop')) {
              if (!next && hold === 0) next = record(kernel, ctx, ++generation);
              if (++hold > HOLD_FRAMES && next?.done) take();
            }
          }
          if (!b) { ctx.stats([{ label: 'Progress', value: 'recording the run' }]); return; }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          drawBoard(p, ctx, b, pad, pad, ctx.width - 2 * pad, ctx.height - 2 * pad, true);
          const rows: Stat[] = [...counterStats(b), ...[...b.stats].map(([label, value]) => ({ label, value }))];
          rows.push({ label: 'Progress', value: `${Math.round((100 * b.at) / Math.max(1, b.t.events.length))}% of ${fmt(b.t.events.length)} events` });
          if (b.t.truncated) rows.push({ label: 'Run', value: 'stopped at the event cap' });
          ctx.stats(rows);
          ctx.chart(chartOf(kernel, b));
        },
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: StringKernel }[]): PlateCode {
  const kind = kernels[0]?.kernel.input ?? 'search';
  const same = kernels.filter((k) => k.kernel.input === kind);
  const first = same[0]?.kernel ?? ({ input: kind, counters: {}, run: () => undefined } as StringKernel);
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: [...inputParams(kind, first, 512), ...tail({ ...first, speed: 2 })],
    create(p, ctx) {
      let generation = 0;
      let panes: { info: KernelInfo; kernel: StringKernel; b: Board; finished: number }[] = [];
      const curves = same.map((k) => ({ info: k.info, pts: [] as [number, number][], slope: NaN }));
      const pending = curves.flatMap((_, ci) => KINDS[kind].scale.map((n) => [ci, n] as [number, number]));
      let finishedCount = 0;
      let hold = 0;
      const build = () => {
        const n = num(ctx.params, 'n');
        const x = input(kind, n, str(ctx.params, 'shape'), ctx.seed + generation * 7919);
        finishedCount = 0;
        panes = same.map((k) => ({ ...k, b: new Board(trace(k.kernel, x as never, ctx.params)), finished: 0 }));
      };
      // one measured point per frame, so the lab never blocks a phone's main thread
      const measure = () => {
        const next = pending.shift();
        if (!next) return;
        const [ci, n] = next;
        const t = trace(same[ci].kernel, input(kind, n, str(ctx.params, 'shape'), ctx.seed + n) as never, ctx.params);
        curves[ci].pts.push([n, t.truncated ? NaN : work(t)]);
        curves[ci].slope = exponent(curves[ci].pts);
      };
      build();
      return {
        setup() { if (ctx.thumbnail) for (const pane of panes) pane.b.seek(0.4); },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            measure();
            const steps = num(ctx.params, 'speed');
            for (const pane of panes) {
              if (!pane.b.done) {
                pane.b.advance(steps, true);
                if (pane.b.done) pane.finished = ++finishedCount;
              }
            }
            if (panes.every((x) => x.b.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build();
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
          const m = Math.max(1, panes.length);
          const cols = W > 700 && m > 2 ? 2 : 1;
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (H - pad * (rows + 1)) / rows;
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textFont('sans-serif');
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`${pane.info.title}${pane.finished ? `  #${pane.finished}` : ''}`, x, y);
            drawBoard(p, ctx, pane.b, x, y + fs + 6, cw, ch - fs - 6);
          });
          ctx.chart({
            title: 'Measured work as the input grows',
            x: { label: KINDS[kind].size.label.toLowerCase(), log: true },
            y: { label: 'counted operations', log: true },
            series: curves.map((cv) => ({ name: cv.info.title, points: cv.pts.slice() })),
          });
          ctx.stats(panes.map((pane, i) => {
            const slope = curves[i]?.slope;
            const c = pane.b.t.labels.map((l, k) => `${fmt(pane.b.counts[k])} ${l.toLowerCase()}`).join(' · ');
            return {
              label: pane.info.title,
              value: `${c} · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'}${pane.finished ? ` · finished #${pane.finished}` : ''}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<StringKernel> = { id: 'string', plate, lab };
