// The geometry engine: point, segment and polygon kernels replayed from their recorded frames.
// A plate runs one kernel on a seeded input and shows the counts each frame carries; a lab runs
// several kernels of one input kind on the same input with the same work budget per frame, and
// measures how each one's work grows with n (ADR 0004 §4-5).
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type Chart, type ParamDef, type Params, type PlateCode, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { drawMarks, fit } from './draw';
import { DEFAULT_SHAPES, makeInput, SHAPE_LABELS } from './input';
import { record, type GeometryKernel, type Trace } from './trace';

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

function run(kernel: GeometryKernel, params: Params, seed: number, shapes: string[]): Trace {
  const n = kernel.input === 'none' ? 0 : num(params, 'n');
  return record(kernel, makeInput(kernel.input, shapeOf(params, shapes), n, seed, params), params, seed);
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
      let t = run(kernel, ctx.params, seedOf(), shapes);
      let at = 0;
      let hold = 0;
      const sizes = kernel.scaling ?? [];
      const pending = sizes.slice();
      const curve: [number, number][] = [];
      const primary = kernel.counters[0];
      return {
        setup() {
          if (ctx.thumbnail) at = Math.floor((t.frames.length - 1) * 0.6);
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          const last = t.frames.length - 1;
          if (!ctx.thumbnail) {
            if (at < last) at = Math.min(last, at + num(ctx.params, 'speed'));
            else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              at = 0;
              t = run(kernel, ctx.params, seedOf(), shapes);
            }
            const next = pending.shift();
            if (next !== undefined) curve.push([next, work(kernel, shapeOf(ctx.params, shapes), next, ctx.seed, ctx.params)]);
          }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.03);
          const v = fit(t.view, pad, pad, ctx.width - 2 * pad, ctx.height - 2 * pad);
          drawMarks(p, ctx, v, t.base);
          const f = t.frames[Math.max(0, at)];
          if (f) drawMarks(p, ctx, v, f.marks);
          const done = at >= last;
          const rows: Stat[] = kernel.counters.map(([k, label]) => ({ label, value: fmt(f?.counts[k] ?? 0) }));
          if (f?.note) rows.push({ label: 'Step', value: f.note });
          rows.push({ label: 'Progress', value: `${Math.round((100 * Math.max(0, at)) / Math.max(1, last))}% of ${fmt(t.frames.length)} recorded steps` });
          if (done) rows.push(...(t.outcome.rows ?? []));
          ctx.stats(rows);
          let chart: Chart | undefined = t.outcome.chart;
          if (!chart && sizes.length) {
            const slope = exponent(curve);
            chart = {
              title: `Measured ${primary[1].toLowerCase()} as n grows${Number.isFinite(slope) ? ` (slope ${slope.toFixed(2)})` : ''}`,
              x: { label: 'n', log: true },
              y: { label: primary[1].toLowerCase(), log: true },
              series: [{ name: 'Measured', points: curve.slice() }],
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
  const sizes = first.scaling ?? [32, 64, 128, 256, 512, 1024];
  const n = first.n ?? { min: 3, max: 1000, value: 120 };
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: [
      ...controls({ ...first, params: [], n: { ...n, max: Math.min(n.max, 800) } }, shapes),
      { kind: 'range', key: 'budget', label: 'Work per frame (× n)', min: 1, max: 20, step: 1, value: 2 },
      { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
      paletteParam('spectral'),
    ],
    create(p, ctx) {
      let generation = 0;
      let panes: { info: KernelInfo; kernel: GeometryKernel; t: Trace; at: number; finished: number }[] = [];
      let spent = 0;
      let finishedCount = 0;
      let hold = 0;
      const curves = kernels.map((k) => ({ info: k.info, pts: [] as [number, number][], slope: NaN }));
      const pending = kernels.flatMap((_, ci) => sizes.map((s) => [ci, s] as [number, number]));
      const build = () => {
        const seed = ctx.seed + generation * 7919;
        const input = makeInput(first.input, shapeOf(ctx.params, shapes), num(ctx.params, 'n'), seed, ctx.params);
        panes = kernels.map((k) => ({ ...k, t: record(k.kernel, input, ctx.params, seed), at: 0, finished: 0 }));
        spent = 0;
        finishedCount = 0;
      };
      build();
      const key = (k: GeometryKernel) => k.counters[0][0];
      const advance = () => {
        for (const pane of panes) {
          const fr = pane.t.frames;
          while (pane.at < fr.length - 1 && (fr[pane.at + 1].counts[key(pane.kernel)] ?? 0) <= spent) pane.at++;
          if (pane.at >= fr.length - 1 && !pane.finished) pane.finished = ++finishedCount;
        }
      };
      const colour = (i: number): RGB => ramp(ctx.palette(), kernels.length < 2 ? 0.5 : i / (kernels.length - 1));
      return {
        setup() {
          if (ctx.thumbnail) {
            const most = Math.max(...panes.map((x) => x.t.counts[key(x.kernel)] ?? 0));
            spent = most * 0.4;
            advance();
          }
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            const next = pending.shift();
            if (next) {
              const [ci, s] = next;
              const c = curves[ci];
              c.pts.push([s, work(kernels[ci].kernel, shapeOf(ctx.params, shapes), s, ctx.seed, ctx.params)]);
              c.slope = exponent(c.pts);
            }
            spent += num(ctx.params, 'budget') * Math.max(1, num(ctx.params, 'n'));
            advance();
            if (panes.every((x) => x.finished) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build();
            }
          }
          const Wd = ctx.width; const Ht = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(Wd, Ht) * 0.02));
          const m = panes.length;
          const cols = Math.max(1, Math.round(Math.sqrt((m * Wd) / Math.max(1, Ht) / 1.6)));
          const rows = Math.ceil(m / cols);
          const cw = (Wd - pad * (cols + 1)) / cols;
          const ch = (Ht - pad * (rows + 1)) / rows;
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            const c = colour(i);
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.rect(x, y, 4, fs + 2);
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`${pane.info.title}${pane.finished ? `  #${pane.finished}` : ''}`, x + 8, y);
            const v = fit(pane.t.view, x, y + fs + 6, cw, ch - fs - 6);
            drawMarks(p, ctx, v, pane.t.base);
            const f = pane.t.frames[pane.at];
            if (f) drawMarks(p, ctx, v, f.marks);
          });
          ctx.chart({
            title: 'Measured work as n grows',
            x: { label: 'n', log: true },
            y: { label: first.counters[0][1].toLowerCase(), log: true },
            series: curves.map((cv) => ({ name: cv.info.title, points: cv.pts.slice() })),
          });
          ctx.stats(panes.map((pane, i) => {
            const f = pane.t.frames[pane.at];
            const slope = curves[i].slope;
            const w = f?.counts[key(pane.kernel)] ?? 0;
            return {
              label: pane.info.title,
              value: `${fmt(w)} ${first.counters[0][1].toLowerCase()} · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'}${pane.finished ? ` · finished #${pane.finished}` : ''}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<GeometryKernel> = { id: 'geometry', plate, lab };
