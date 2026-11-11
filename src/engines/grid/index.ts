// The grid engine: dynamic-programming tables, boards and sieves, replayed cell by cell from
// their trace. A plate runs one kernel (cells filling with arrows from the cells each one reads,
// the traceback, pieces placed and taken back, multiples crossed out); a lab runs several on the
// same problem size with the same operation budget per frame and measures how each one's work
// grows with n (ADR 0004 §4-5). Traces are built a bounded number of events per frame, so a
// rebuild, a restart or a chart measurement never blocks one frame.
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, type Chart, type ParamDef, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { OP, seeded, Tally, Tracer, type GridKernel, type Instance, type Trace } from './trace';

const HOLD_FRAMES = 120;
const LAB_N = [4, 6, 8, 12, 16, 24, 32];
const MAX_ARROWS = 48;
/** Trace events recorded per frame, shared by every build and measurement a plate runs. */
export const BUILD_EVENTS_PER_FRAME = 20_000;
/** Events a thumbnail records before it draws (a partial trace replays like a whole one). */
export const THUMBNAIL_EVENTS = 60_000;
/** Frames the board stays framed after a solution is reached. */
export const FLASH_FRAMES = 24;

const fmt = (x: number) => x.toLocaleString('en-US');
const LAB_RANGE = `n = ${LAB_N[0]} to ${LAB_N[LAB_N.length - 1]}`;
const WORK_LABEL = 'counted operations (visits, reads, lookups, writes, comparisons, moves)';

/** Least-squares slope of log(work) against log(n): the measured growth exponent. */
function exponent(points: [number, number][]): number {
  const pts = points.filter(([n, w]) => n > 0 && w > 0).map(([n, w]) => [Math.log(n), Math.log(w)]);
  if (pts.length < 2) return NaN;
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let sxy = 0; let sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}

function emptyTrace(inst: Instance): Trace {
  return { events: new Int32Array(0), length: 0, rows: inst.rows, cols: inst.cols,
    tally: new Tally(inst.rows, inst.cols), truncated: false };
}

/** One replayed run: the grid as replayed so far, its tally, and where it stands. */
export class Replay {
  readonly tally: Tally;
  readonly value: Float64Array;
  readonly has: Uint8Array;
  readonly crossed: Uint8Array;
  readonly piece: Uint8Array;
  readonly marked: Uint8Array;
  readonly visits: Int32Array;
  readonly marks: number[] = [];
  /** Index of the first write at or after each event (length when none follows). */
  private readonly nextWrite: Int32Array;
  readonly maxValue: number;
  readonly minValue: number;
  maxVisits = 0;
  at = 0;
  lastCell = -1;
  lastOp = -1;
  /** Cells read since the last write, and the write they feed. */
  reads: number[] = [];
  lastReads: number[] = [];
  lastTarget = -1;
  /** Frames left to frame the board after a solution; counted down by tick(), once per frame. */
  solutionFlash = 0;
  constructor(readonly inst: Instance, readonly t: Trace) {
    const size = t.rows * t.cols;
    this.tally = new Tally(t.rows, t.cols);
    this.value = new Float64Array(size);
    this.has = new Uint8Array(size);
    this.crossed = new Uint8Array(size);
    this.piece = new Uint8Array(size);
    this.marked = new Uint8Array(size);
    this.visits = new Int32Array(size);
    this.nextWrite = new Int32Array(t.length + 1);
    let next = t.length;
    let hi = -Infinity; let lo = Infinity;
    this.nextWrite[t.length] = next;
    for (let e = t.length - 1; e >= 0; e--) {
      if (t.events[4 * e] === OP.write) {
        next = e;
        const v = t.events[4 * e + 3];
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      }
      this.nextWrite[e] = next;
    }
    this.maxValue = Number.isFinite(hi) ? hi : 1;
    this.minValue = Number.isFinite(lo) ? lo : 0;
  }
  static empty(inst: Instance): Replay { return new Replay(inst, emptyTrace(inst)); }
  get done(): boolean { return this.at >= this.t.length; }
  /** One frame has passed. */
  tick(): void { if (this.solutionFlash > 0) this.solutionFlash--; }
  advance(steps: number): void {
    const ev = this.t.events;
    const cols = this.t.cols;
    const end = Math.min(this.t.length, this.at + steps);
    for (; this.at < end; this.at++) {
      const e = this.at;
      const op = ev[4 * e]; const r = ev[4 * e + 1]; const c = ev[4 * e + 2]; const v = ev[4 * e + 3];
      this.tally.add(op, r, c, v);
      if (r < 0) {
        if (op === OP.solution) this.solutionFlash = FLASH_FRAMES;
        continue;
      }
      const i = r * cols + c;
      this.lastCell = i;
      this.lastOp = op;
      switch (op) {
        case OP.visit:
          if (++this.visits[i] > this.maxVisits) this.maxVisits = this.visits[i];
          break;
        case OP.read: this.reads.push(i); break;
        case OP.write:
          this.value[i] = v; this.has[i] = 1;
          this.lastReads = this.reads; this.reads = []; this.lastTarget = i;
          break;
        case OP.place: this.piece[i] = 1; break;
        case OP.remove: this.piece[i] = 0; break;
        case OP.cross: this.crossed[i] = 1; break;
        case OP.mark: this.marked[i] = 1; this.marks.push(i); break;
      }
    }
  }
  /** The reads in progress and the cell they will be written into, else the last finished set. */
  arrows(): { from: number[]; to: number } {
    const w = this.nextWrite[this.at];
    if (this.reads.length && w < this.t.length) {
      const ev = this.t.events;
      return { from: this.reads, to: ev[4 * w + 1] * this.t.cols + ev[4 * w + 2] };
    }
    if (this.reads.length) return { from: this.reads, to: -1 };
    return { from: this.lastReads, to: this.lastTarget };
  }
}

function contrast(ctx: PlateContext, c: RGB): RGB {
  const l = (x: RGB) => 0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2];
  return Math.abs(l(c) - l(ctx.bg)) > Math.abs(l(c) - l(ctx.fg)) ? ctx.bg : ctx.fg;
}

interface Box { x: number; y: number; w: number; h: number }

function drawGrid(p: p5, ctx: PlateContext, kernel: GridKernel, rp: Replay, box: Box, labels: boolean) {
  const inst = rp.inst;
  const { rows, cols } = inst;
  const pal = ctx.palette();
  const fg = ctx.fg;
  const probe = Math.min(box.w / (cols + 1), box.h / (rows + 1));
  const withLabels = labels && probe >= 12 && Boolean(inst.rowLabels || inst.colLabels);
  const lw = withLabels && inst.rowLabels ? Math.min(box.w * 0.18, Math.max(...inst.rowLabels.map((s) => s.length)) * probe * 0.32 + probe * 0.4) : 0;
  const lh = withLabels && inst.colLabels ? probe * 0.8 : 0;
  const cell = Math.max(1, Math.min((box.w - lw) / cols, (box.h - lh) / rows));
  const gx = box.x + lw + (box.w - lw - cell * cols) / 2;
  const gy = box.y + lh + (box.h - lh - cell * rows) / 2;
  const cx = (i: number) => gx + ((i % cols) + 0.5) * cell;
  const cy = (i: number) => gy + (Math.floor(i / cols) + 0.5) * cell;
  const gap = cell > 6 ? 1 : 0;
  const span = rp.maxValue - rp.minValue || 1;
  const norm = (v: number) => (kernel.colour === 'log'
    ? Math.log1p(Math.max(0, v - rp.minValue)) / Math.log1p(span)
    : (v - rp.minValue) / span);
  const heatMax = Math.log1p(rp.maxVisits);
  const showText = cell >= 16;
  p.textAlign(p.CENTER, p.CENTER);
  p.noStroke();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (inst.inactive?.(r, c)) continue;
      const i = r * cols + c;
      const x = gx + c * cell; const y = gy + r * cell;
      let fill: RGB | null = null;
      if (rp.has[i]) fill = ramp(pal, 0.12 + 0.88 * norm(rp.value[i]));
      else if (rp.marked[i]) fill = ramp(pal, 0.9);
      else if (rp.crossed[i]) fill = ramp(pal, 0.2);
      if (fill && rp.crossed[i] && !rp.has[i]) {
        p.fill(fill[0], fill[1], fill[2], 110);
      } else if (fill) p.fill(fill[0], fill[1], fill[2]);
      else p.fill(fg[0], fg[1], fg[2], (r + c) % 2 ? 14 : 22);
      p.rect(x, y, cell - gap, cell - gap);
      if (rp.maxVisits > 1 && rp.visits[i] > 0) {
        const h = ramp(pal, 0.95);
        p.fill(h[0], h[1], h[2], 200);
        const bw = (cell - gap) * (Math.log1p(rp.visits[i]) / heatMax);
        p.rect(x, y + (cell - gap) * 0.82, bw, (cell - gap) * 0.18);
      }
      if (rp.crossed[i] && cell >= 8) {
        p.stroke(fg[0], fg[1], fg[2], 120);
        p.strokeWeight(1);
        p.line(x + cell * 0.2, y + cell * 0.2, x + cell * 0.75, y + cell * 0.75);
        p.noStroke();
      }
      if (rp.piece[i]) {
        const q = ramp(pal, 0.98);
        p.stroke(fg[0], fg[1], fg[2]);
        p.strokeWeight(Math.max(1, cell * 0.05));
        p.fill(q[0], q[1], q[2]);
        p.circle(x + cell / 2, y + cell / 2, cell * 0.6);
        p.noStroke();
      }
      if (showText && !rp.piece[i]) {
        const text = inst.label ? inst.label(r, c) : rp.has[i] ? String(rp.value[i]) : '';
        if (text) {
          const size = Math.min(cell * 0.38, (cell * 1.7) / text.length, 14);
          if (size >= 7) {
            const ink = fill ? contrast(ctx, fill) : fg;
            p.fill(ink[0], ink[1], ink[2], rp.crossed[i] ? 120 : 230);
            p.textSize(size);
            p.text(text, x + (cell - gap) / 2, y + (cell - gap) / 2);
          }
        }
      }
    }
  }
  // the answer: a traceback joined into a path, or marked cells outlined
  if (rp.marks.length) {
    p.noFill();
    p.stroke(fg[0], fg[1], fg[2], 220);
    p.strokeWeight(Math.max(1.5, cell * 0.08));
    if (kernel.path && rp.marks.length > 1) {
      p.beginShape();
      for (const i of rp.marks) p.vertex(cx(i), cy(i));
      p.endShape();
    }
    if (kernel.path || !inst.label) for (const i of rp.marks) p.rect(cx(i) - cell / 2 + 1, cy(i) - cell / 2 + 1, cell - gap - 2, cell - gap - 2);
  }
  if (!rp.done) {
    // the cells being read and the arrows into the cell they feed
    const { from, to } = rp.arrows();
    p.noFill();
    p.stroke(fg[0], fg[1], fg[2], 200);
    p.strokeWeight(Math.max(1, cell * 0.06));
    const shown = from.slice(-MAX_ARROWS);
    for (const i of shown) p.circle(cx(i), cy(i), cell * 0.55);
    if (to >= 0) {
      for (const i of shown) {
        if (i === to) continue;
        const x0 = cx(i); const y0 = cy(i); const x1 = cx(to); const y1 = cy(to);
        const d = Math.hypot(x1 - x0, y1 - y0);
        if (d < 1) continue;
        const ux = (x1 - x0) / d; const uy = (y1 - y0) / d;
        const ex = x1 - ux * cell * 0.32; const ey = y1 - uy * cell * 0.32;
        p.line(x0 + ux * cell * 0.28, y0 + uy * cell * 0.28, ex, ey);
        const a = Math.max(3, cell * 0.16);
        p.line(ex, ey, ex - ux * a - uy * a * 0.6, ey - uy * a + ux * a * 0.6);
        p.line(ex, ey, ex - ux * a + uy * a * 0.6, ey - uy * a - ux * a * 0.6);
      }
      p.strokeWeight(Math.max(1.5, cell * 0.1));
      p.rect(cx(to) - cell / 2, cy(to) - cell / 2, cell - gap, cell - gap);
    } else if (rp.lastCell >= 0) {
      p.strokeWeight(Math.max(1.5, cell * 0.1));
      p.rect(cx(rp.lastCell) - cell / 2, cy(rp.lastCell) - cell / 2, cell - gap, cell - gap);
    }
  }
  if (rp.solutionFlash > 0) {
    p.noFill();
    p.stroke(fg[0], fg[1], fg[2], 40 + rp.solutionFlash * 8);
    p.strokeWeight(3);
    p.rect(gx - 3, gy - 3, cell * cols + 6, cell * rows + 6);
  }
  p.noStroke();
  if (withLabels) {
    const size = Math.max(8, Math.min(12, probe * 0.45));
    p.textSize(size);
    p.fill(fg[0], fg[1], fg[2], 170);
    if (inst.colLabels) {
      p.textAlign(p.CENTER, p.BOTTOM);
      inst.colLabels.forEach((s, c) => { if (cell >= size * 0.9 * Math.min(3, s.length) * 0.6) p.text(s, gx + (c + 0.5) * cell, gy - 2); });
    }
    if (inst.rowLabels) {
      p.textAlign(p.RIGHT, p.CENTER);
      inst.rowLabels.forEach((s, r) => { if (cell >= size) p.text(s, gx - 4, gy + (r + 0.5) * cell); });
    }
  }
}

const baseParams = (k: GridKernel, varies: boolean): ParamDef[] => [
  { kind: 'range', key: 'n', label: k.size.label, min: k.size.min, max: k.size.max, step: k.size.step,
    value: k.size.value, rebuild: true },
  { kind: 'range', key: 'speed', label: 'Operations per frame', min: 1, max: 2000, step: 1, value: k.speed },
  loopParam(varies),
  paletteParam('abyss'),
];

/** A kernel whose instances ignore the seed would only re-trace the same input: it replays. */
function loopParam(varies: boolean): ParamDef {
  return { kind: 'toggle', key: 'loop', label: varies ? 'New input when done' : 'Replay when done', value: true };
}

/** The x of a per-row chart: the row's own label when it is a number, so chart and board agree. */
export function rowX(inst: Instance, r: number): number {
  const x = Number(inst.rowLabels?.[r]);
  return Number.isFinite(x) ? x : r + 1;
}

/** Measures one size per pending entry, a bounded number of events at a time. */
class Measurer {
  private current: { key: number; n: number; tracer: Tracer } | null = null;
  constructor(private readonly pending: [number, number][],
    private readonly make: (key: number, n: number) => Instance,
    private readonly done: (key: number, n: number, t: Trace) => void) {}
  /** Spend up to `budget` events; returns what is left of it. */
  work(budget: number): number {
    while (budget > 0) {
      if (!this.current) {
        const next = this.pending.shift();
        if (!next) break;
        this.current = { key: next[0], n: next[1], tracer: new Tracer(this.make(next[0], next[1])) };
      }
      budget -= this.current.tracer.step(budget);
      if (this.current.tracer.done) {
        const { key, n, tracer } = this.current;
        this.current = null;
        const t = tracer.result();
        if (!t.truncated) this.done(key, n, t);
      }
    }
    return budget;
  }
}

/** A trace being built for display: an empty grid until it is complete. */
class Build {
  readonly tracer: Tracer;
  constructor(readonly inst: Instance) { this.tracer = new Tracer(inst); }
  work(budget: number): number { return budget - this.tracer.step(budget); }
  get done(): boolean { return this.tracer.done; }
  replay(): Replay { return new Replay(this.inst, this.tracer.result()); }
  /** For a thumbnail: whatever has been traced so far. */
  partial(budget: number): Replay {
    this.tracer.step(budget);
    return new Replay(this.inst, this.tracer.done ? this.tracer.result() : this.tracer.snapshot());
  }
}

function plate(info: KernelInfo, kernel: GridKernel): PlateCode {
  const varies = seeded(kernel);
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 9,
    thumbnailFrames: 2,
    params: baseParams(kernel, varies),
    create(p, ctx) {
      let generation = 0;
      const instance = () => kernel.instance(num(ctx.params, 'n'), ctx.seed + generation * 7919);
      let build: Build | null = new Build(instance());
      let rp = Replay.empty(build.inst);
      let hold = 0;
      const spec = kernel.chart;
      const curves = spec.kind === 'scaling' ? spec.series.map(() => [] as [number, number][]) : [];
      const measurer = new Measurer(spec.kind === 'scaling' ? spec.ns.map((n) => [0, n]) : [],
        (_, n) => kernel.instance(n, ctx.seed + n),
        (_, n, t) => { if (spec.kind === 'scaling') spec.series.forEach((m, i) => curves[i].push([n, m.of(t.tally)])); });
      const work = () => {
        let budget = BUILD_EVENTS_PER_FRAME;
        if (build) {
          budget = build.work(budget);
          if (build.done) { rp = build.replay(); build = null; hold = 0; }
        }
        measurer.work(budget);
      };
      const chart = (): Chart => {
        if (spec.kind === 'scaling') {
          return {
            title: 'Measured work as the problem grows',
            x: { label: spec.x, log: spec.logX },
            y: { label: spec.y, log: spec.logY },
            series: spec.series.map((m, i) => ({ name: m.name, points: curves[i].slice() })),
          };
        }
        return {
          title: spec.title,
          x: { label: spec.x },
          y: { label: spec.y },
          series: spec.series.map((s) => ({
            name: s.name,
            points: Array.from({ length: rp.t.rows }, (_, r) => [rowX(rp.inst, r), rp.tally.inRow(s.op, r)] as [number, number]),
          })),
        };
      };
      return {
        setup() {
          if (ctx.thumbnail && build) {
            rp = build.partial(THUMBNAIL_EVENTS);
            build = null;
            rp.advance(Math.floor(rp.t.length * 0.55));
          }
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            work();
            rp.tick();
            if (!build) {
              if (!rp.done) rp.advance(num(ctx.params, 'speed'));
              else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
                hold = 0;
                if (varies) {
                  generation++;
                  build = new Build(instance());
                } else rp = new Replay(rp.inst, rp.t);
              }
            }
          }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          drawGrid(p, ctx, kernel, rp, { x: pad, y: pad, w: ctx.width - 2 * pad, h: ctx.height - 2 * pad }, true);
          const rows: Stat[] = kernel.readouts.map((m) => ({ label: m.name, value: fmt(m.of(rp.tally)) }));
          rows.push({ label: 'Input', value: (build ?? rp).inst.input });
          if (build) rows.push({ label: 'Tracing', value: `${fmt(build.tracer.recorded)} operations recorded` });
          else rows.push({ label: 'Progress', value: `${Math.round((100 * rp.at) / Math.max(1, rp.t.length))}% of ${fmt(rp.t.length)} operations` });
          if (!build && rp.done) rows.push({ label: 'Result', value: rp.t.outcome?.summary ?? 'stopped at the operation cap' });
          ctx.stats(rows);
          ctx.chart(chart());
        },
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: GridKernel }[]): PlateCode {
  const lo = Math.max(...kernels.map((k) => k.kernel.size.min));
  const hi = Math.max(lo, Math.min(...kernels.map((k) => k.kernel.size.max)));
  const value = Math.min(hi, Math.max(lo, 8));
  const varies = kernels.map((k) => seeded(k.kernel));
  const params: ParamDef[] = [
    { kind: 'range', key: 'n', label: 'Problem size n', min: lo, max: hi, step: 1, value, rebuild: true },
    { kind: 'range', key: 'speed', label: 'Operations per frame', min: 1, max: 2000, step: 1, value: 8 },
    loopParam(varies.some(Boolean)),
    paletteParam('abyss'),
  ];
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params,
    create(p, ctx) {
      let generation = 0;
      let finishedCount = 0;
      let hold = 0;
      const instance = (ki: number) => kernels[ki].kernel.instance(num(ctx.params, 'n'), ctx.seed + generation * 7919);
      const panes = kernels.map((k, ki) => {
        const build = new Build(instance(ki));
        return { ...k, build: build as Build | null, rp: Replay.empty(build.inst), finished: 0 };
      });
      const curves = kernels.map(() => ({ pts: [] as [number, number][], slope: NaN }));
      const measurer = new Measurer(kernels.flatMap((_, ki) => LAB_N.map((n) => [ki, n] as [number, number])),
        (ki, n) => kernels[ki].kernel.instance(n, ctx.seed + n),
        (ki, n, t) => { curves[ki].pts.push([n, t.tally.work]); curves[ki].slope = exponent(curves[ki].pts); });
      const ready = () => panes.every((x) => !x.build);
      const work = () => {
        let budget = BUILD_EVENTS_PER_FRAME;
        for (const pane of panes) {
          if (!pane.build || budget <= 0) continue;
          budget = pane.build.work(budget);
          if (pane.build.done) { pane.rp = pane.build.replay(); pane.build = null; }
        }
        measurer.work(budget);
      };
      return {
        setup() {
          if (!ctx.thumbnail) return;
          for (const pane of panes) {
            if (!pane.build) continue;
            pane.rp = pane.build.partial(THUMBNAIL_EVENTS / panes.length);
            pane.build = null;
            pane.rp.advance(Math.floor(pane.rp.t.length * 0.5));
          }
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            const wasReady = ready();
            work();
            if (!wasReady && ready()) { finishedCount = 0; hold = 0; }
            for (const pane of panes) pane.rp.tick();
            if (ready()) {
              const steps = num(ctx.params, 'speed');
              for (const pane of panes) {
                if (!pane.rp.done) {
                  pane.rp.advance(steps);
                  if (pane.rp.done) pane.finished = ++finishedCount;
                }
              }
              if (panes.every((x) => x.rp.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
                hold = 0;
                finishedCount = 0;
                generation++;
                panes.forEach((pane, ki) => {
                  pane.finished = 0;
                  if (varies[ki]) pane.build = new Build(instance(ki));
                  else pane.rp = new Replay(pane.rp.inst, pane.rp.t);
                });
              }
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.025));
          const m = panes.length;
          const cols = Math.max(1, Math.round(Math.sqrt((m * W) / Math.max(1, H))));
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (H - pad * (rows + 1)) / rows;
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`${pane.info.title}${pane.finished ? `  #${pane.finished}` : ''}`, x, y);
            drawGrid(p, ctx, pane.kernel, pane.rp, { x, y: y + fs + 6, w: cw, h: ch - fs - 6 }, false);
          });
          ctx.chart({
            title: `Measured work, growth exponent fitted over ${LAB_RANGE} (not the asymptote)`,
            x: { label: 'problem size n', log: true },
            y: { label: WORK_LABEL, log: true },
            series: kernels.map((k, i) => ({ name: k.info.title, points: curves[i].pts.slice() })),
          });
          ctx.stats(panes.map((pane, i) => {
            const t = pane.rp.tally;
            const slope = curves[i].slope;
            const state = pane.build ? `tracing, ${fmt(pane.build.tracer.recorded)} operations recorded`
              : `${fmt(t.computed)} cells · ${fmt(t.reused)} reads · ${fmt(t.work)} operations`;
            return {
              label: pane.info.title,
              value: `${state} · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'} over ${LAB_RANGE}${pane.finished ? ` · finished #${pane.finished}` : ''}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<GridKernel> = { id: 'grid', plate, lab };
