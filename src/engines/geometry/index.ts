// The geometry engine: point, segment and polygon kernels replayed from their recorded frames.
// A plate runs one kernel on a seeded input and shows the counts each frame carries; a lab runs
// several kernels of one input kind on the same input with the same work budget per frame, and
// measures how each one's work grows with n (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type Chart, type ParamDef, type Params, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { drawMarks, fit, type View } from './draw';
import { DEFAULT_SHAPES, makeInput, SHAPE_LABELS } from './input';
import { buildNow, Scaling, SLICE_MS, startBuild, type Build, type Request } from './build';
import { record, type Box, type GeometryKernel } from './trace';
import type { Track } from './track';

const HOLD_FRAMES = 120;
const fmt = (x: number) => (Number.isInteger(x) ? x.toLocaleString('en-US') : x.toFixed(2));

/** Least-squares slope of log(work) against log(n): the measured growth exponent. */
export function exponent(points: [number, number][]): number {
  const pts = points.filter(([n, w]) => n > 0 && w > 0).map(([n, w]) => [Math.log(n), Math.log(w)]);
  if (pts.length < 2) return NaN;
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let sxy = 0; let sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}

const shapesOf = (k: GeometryKernel) => k.shapes ?? DEFAULT_SHAPES[k.input];

/** The work one run does: its first counter. */
export function work(kernel: GeometryKernel, shape: string, n: number, seed: number, params: Params): number {
  const t = record(kernel, makeInput(kernel.input, shape, n, seed + n, params), params, seed + n, false);
  return t.counts[kernel.counters[0][0]] ?? 0;
}

function controls(kernel: GeometryKernel, shapes: string[]): ParamDef[] {
  const n = kernel.n ?? { min: 3, max: 1000, value: 120, step: 1 };
  const out: ParamDef[] = [];
  if (shapes.length > 1) {
    out.push({
      kind: 'select', key: 'shape', label: 'Input', value: shapes[0], rebuild: true,
      options: shapes.map((s) => ({ value: s, label: SHAPE_LABELS[s] ?? s })),
    });
  }
  if (kernel.input !== 'none') {
    out.push({ kind: 'range', key: 'n', label: n.label ?? 'Points', min: n.min, max: n.max, step: n.step ?? 1, value: n.value, rebuild: true });
  }
  out.push(...(kernel.params ?? []).map((d) => ({ ...d, rebuild: true }) as ParamDef));
  return out;
}

const tail = (): ParamDef[] => [
  { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 40, step: 1, value: 2 },
  { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
  paletteParam('spectral'),
];

function shapeOf(params: Params, shapes: string[]): string {
  const s = params.shape === undefined ? shapes[0] : str(params, 'shape');
  return shapes.includes(s) ? s : shapes[0];
}

function request(info: KernelInfo, kernel: GeometryKernel, params: Params, seed: number, shapes: string[]): Request {
  return { id: info.id, kernel, shape: shapeOf(params, shapes), n: kernel.input === 'none' ? 0 : num(params, 'n'), seed, params };
}

/** Draw a build in progress: its base and the latest frame recorded so far. */
function drawPartial(p: p5, ctx: PlateContext, b: Build, v: (box: Box) => View): number {
  const part = b.partial();
  const view = v(part.view);
  drawMarks(p, ctx, view, part.base);
  drawMarks(p, ctx, view, part.frame);
  return part.steps;
}

function plate(info: KernelInfo, kernel: GeometryKernel): PlateCode {
  const shapes = shapesOf(kernel);
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 10,
    thumbnailFrames: 2,
    params: [...controls(kernel, shapes), ...tail()],
    create(p, ctx) {
      let generation = 0;
      const seedOf = () => ctx.seed + generation * 7919;
      // the first run is sliced like every other (a thumbnail builds it at once)
      let t: Track | null = ctx.thumbnail ? buildNow(request(info, kernel, ctx.params, seedOf(), shapes)) : null;
      let pending: Build | null = t ? null : startBuild(request(info, kernel, ctx.params, seedOf(), shapes), false);
      let at = 0;
      let hold = 0;
      const sizes = kernel.scaling ?? [];
      const scaling = new Scaling(kernel, sizes, shapeOf(ctx.params, shapes), ctx.seed, ctx.params);
      const primary = kernel.counters[0];
      return {
        setup() {
          if (ctx.thumbnail && t) at = Math.floor((t.length - 1) * 0.6);
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.03);
          const fitIn = (box: Box) => fit(box, pad, pad, ctx.width - 2 * pad, ctx.height - 2 * pad);
          if (!ctx.thumbnail) {
            const deadline = performance.now() + SLICE_MS;
            if (pending) {
              pending.pump(deadline);
              if (pending.track) { t = pending.track; pending = null; at = 0; hold = 0; }
            }
            if (t && !pending) {
              const last = t.length - 1;
              if (at < last) at = Math.min(last, at + num(ctx.params, 'speed'));
              else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
                // the next input builds in the background (a worker when there is one, slices
                // otherwise); the held frame stays on screen until it is ready
                generation++;
                pending = startBuild(request(info, kernel, ctx.params, seedOf(), shapes), true);
              }
            }
            scaling.pump(deadline);
          }
          if (!t) {
            const steps = pending ? drawPartial(p, ctx, pending, fitIn) : 0;
            ctx.stats([{ label: 'Building', value: `${fmt(steps)} steps recorded so far` }]);
            return;
          }
          const v = fitIn(t.view);
          drawMarks(p, ctx, v, t.base);
          const shown = Math.max(0, Math.min(at, t.length - 1));
          drawMarks(p, ctx, v, t.marks(shown));
          const counts = t.counts(shown);
          const done = shown >= t.length - 1;
          const rows: Stat[] = kernel.counters.map(([k, label]) => ({ label, value: fmt(counts[k] ?? 0) }));
          const note = t.note(shown);
          if (note) rows.push({ label: 'Step', value: note });
          rows.push({ label: 'Progress', value: `${Math.round((100 * shown) / Math.max(1, t.length - 1))}% of ${fmt(t.length)} recorded steps` });
          if (done) rows.push(...t.rows);
          if (pending) rows.push({ label: 'Next input', value: 'building' });
          ctx.stats(rows);
          let chart: Chart | undefined = t.chart;
          if (!chart && sizes.length) {
            const slope = exponent(scaling.points);
            chart = {
              title: `Measured ${primary[1].toLowerCase()} as n grows${Number.isFinite(slope) ? ` (slope ${slope.toFixed(2)})` : ''}`,
              x: { label: 'n', log: true },
              y: { label: primary[1].toLowerCase(), log: true },
              series: [{ name: 'Measured', points: scaling.points.slice() }],
            };
          }
          if (chart) ctx.chart(chart);
        },
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: GeometryKernel }[]): PlateCode {
  const first = kernels[0].kernel;
  const shapes = shapesOf(first);
  const n = first.n ?? { min: 3, max: 1000, value: 120 };
  const nMax = Math.min(n.max, 800);
  // the lab measures only sizes its own control can reach
  const sizes = (first.scaling ?? [32, 64, 128, 256, 512, 1024]).filter((s) => s <= nMax);
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: [
      ...controls({ ...first, params: [], n: { ...n, max: nMax } }, shapes),
      { kind: 'range', key: 'budget', label: 'Work per frame (× n)', min: 1, max: 20, step: 1, value: 2 },
      { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
      paletteParam('spectral'),
    ],
    create(p, ctx) {
      let generation = 0;
      type Pane = { info: KernelInfo; kernel: GeometryKernel; t: Track; at: number; finished: number };
      let panes: Pane[] = [];
      let builds: Build[] | null = null;
      let spent = 0;
      let finishedCount = 0;
      let hold = 0;
      const shape = shapeOf(ctx.params, shapes);
      const curves = kernels.map((k) => ({ info: k.info, scaling: new Scaling(k.kernel, sizes, shape, ctx.seed, ctx.params) }));
      const req = (k: { info: KernelInfo; kernel: GeometryKernel }) => request(k.info, k.kernel, ctx.params, ctx.seed + generation * 7919, shapes);
      const start = (tracks: Track[]) => {
        panes = kernels.map((k, i) => ({ ...k, t: tracks[i], at: 0, finished: 0 }));
        spent = 0;
        finishedCount = 0;
        hold = 0;
      };
      if (ctx.thumbnail) start(kernels.map((k) => buildNow(req(k))));
      else builds = kernels.map((k) => startBuild(req(k), false));
      const key = (k: GeometryKernel) => k.counters[0][0];
      const advance = () => {
        for (const pane of panes) {
          const tr = pane.t;
          while (pane.at < tr.length - 1 && (tr.counts(pane.at + 1)[key(pane.kernel)] ?? 0) <= spent) pane.at++;
          if (pane.at >= tr.length - 1 && !pane.finished) pane.finished = ++finishedCount;
        }
      };
      const colour = (i: number): RGB => ramp(ctx.palette(), kernels.length < 2 ? 0.5 : i / (kernels.length - 1));
      return {
        setup() {
          if (ctx.thumbnail) {
            spent = 0.4 * Math.max(...panes.map((x) => x.t.final[key(x.kernel)] ?? 0));
            advance();
          }
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            const deadline = performance.now() + SLICE_MS;
            if (builds) {
              for (const b of builds) if (!b.track) { b.pump(deadline); if (!b.track) break; }
              if (builds.every((b) => b.track)) { start(builds.map((b) => b.track as Track)); builds = null; }
            }
            if (panes.length && !builds) {
              spent += num(ctx.params, 'budget') * Math.max(1, num(ctx.params, 'n'));
              advance();
              if (panes.every((x) => x.finished) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
                generation++;
                builds = kernels.map((k) => startBuild(req(k), true));
              }
            }
            curves.find((cv) => !cv.scaling.done)?.scaling.pump(deadline);
          }
          const Wd = ctx.width; const Ht = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(Wd, Ht) * 0.02));
          const m = kernels.length;
          const cols = Math.max(1, Math.round(Math.sqrt((m * Wd) / Math.max(1, Ht) / 1.6)));
          const rows = Math.ceil(m / cols);
          const cw = (Wd - pad * (cols + 1)) / cols;
          const ch = (Ht - pad * (rows + 1)) / rows;
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
          kernels.forEach((k, i) => {
            const pane = panes[i];
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            const c = colour(i);
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.rect(x, y, 4, fs + 2);
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`${k.info.title}${pane?.finished ? `  #${pane.finished}` : ''}`, x + 8, y);
            const fitIn = (box: Box) => fit(box, x, y + fs + 6, cw, ch - fs - 6);
            if (pane) {
              const v = fitIn(pane.t.view);
              drawMarks(p, ctx, v, pane.t.base);
              drawMarks(p, ctx, v, pane.t.marks(pane.at));
            } else if (builds) drawPartial(p, ctx, builds[i], fitIn);
          });
          ctx.chart({
            title: 'Measured work as n grows',
            x: { label: 'n', log: true },
            y: { label: first.counters[0][1].toLowerCase(), log: true },
            series: curves.map((cv) => ({ name: cv.info.title, points: cv.scaling.points.slice() })),
          });
          if (!panes.length) {
            ctx.stats([{ label: 'Building', value: `${builds?.filter((b) => b.track).length ?? 0} of ${kernels.length} runs ready` }]);
            return;
          }
          ctx.stats(panes.map((pane, i) => {
            const slope = exponent(curves[i].scaling.points);
            const w = pane.t.counts(pane.at)[key(pane.kernel)] ?? 0;
            return {
              label: pane.info.title,
              value: `${fmt(w)} ${first.counters[0][1].toLowerCase()} · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'}${pane.finished ? ` · finished #${pane.finished}` : ''}${builds ? ' · next input building' : ''}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<GeometryKernel> = { id: 'geometry', plate, lab };
