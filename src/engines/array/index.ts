// The array engine: sorting and selection kernels drawn as bars, replayed from their trace.
// A plate runs one kernel; a lab runs several on one input with the same operation budget per
// frame, and measures how each one's work grows with n (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type ParamDef, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { apply, input, inversions, OP, SHAPE_LABELS, SHAPES, trace, type ArrayKernel, type Shape,
  type Trace } from './trace';

const SCALING_N = [16, 32, 64, 128, 256, 512];
/**
 * Operations a lab replays per frame across all its panes, at most: a counted bound beside the
 * per-pane speed, so a lab of many kernels at full speed does a phone's frame of work, not one
 * per kernel. Every pane gets the same share, so the race stays fair.
 */
export const LAB_OPS_PER_FRAME = 24000;
/** The sizes a kernel's growth is measured at: none past its own bound (ArrayKernel.maxN). */
const scalingN = (kernel: ArrayKernel) => SCALING_N.filter((n) => n <= (kernel.maxN ?? MAX_N));
const HOLD_FRAMES = 90;

const fmt = (x: number) => x.toLocaleString('en-US');
const total = (t: Trace) => t.counts.compares + t.counts.writes + t.counts.auxWrites;

/** Least-squares slope of log(work) against log(n): the measured growth exponent. */
export function exponent(points: [number, number][]): number {
  const pts = points.filter(([n, w]) => n > 0 && w > 0).map(([n, w]) => [Math.log(n), Math.log(w)]);
  if (pts.length < 2) return NaN;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxy = 0; let sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}

export function scaling(kernel: ArrayKernel, shape: Shape, seed: number): [number, number][] {
  return scalingN(kernel).map((n) => {
    const t = trace(kernel, input(shape, n, seed + n), Math.floor(n / 2));
    return [n, t.truncated ? NaN : total(t)];
  });
}

function shapeParam(): ParamDef {
  return {
    kind: 'select', key: 'shape', label: 'Input', value: 'random', rebuild: true,
    options: SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] })),
  };
}

/** The engine's own largest input; a kernel may play at a smaller one (ArrayKernel.maxN). */
export const MAX_N = 512;

const baseParams = (n: number, max = MAX_N): ParamDef[] => [
  shapeParam(),
  { kind: 'range', key: 'n', label: 'Keys', min: 8, max, step: 8, value: Math.min(n, max), rebuild: true },
  { kind: 'range', key: 'speed', label: 'Operations per frame', min: 1, max: 2000, step: 1, value: 6 },
  { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
  paletteParam('spectral'),
];

/** One replayed run: its trace, the array as replayed so far, and where it stands. */
class Replay {
  a: number[];
  aux: number[];
  at = 0;
  last = -1;
  lo = -1;
  hi = -1;
  usesAux: boolean;
  private c = { compares: 0, writes: 0, aux: 0 };
  /** [operation, comparisons, array writes, auxiliary writes], about 120 points over the run. */
  history: [number, number, number, number][] = [[0, 0, 0, 0]];
  private every: number;
  constructor(readonly t: Trace) {
    this.a = t.input.slice();
    this.aux = new Array(t.auxN ?? t.input.length).fill(0);
    let aux = false;
    for (let e = 0; e < t.length && !aux; e++) aux = t.events[3 * e] === OP.auxWrite;
    this.usesAux = aux;
    this.every = Math.max(1, Math.floor(t.length / 120));
  }
  get done(): boolean { return this.at >= this.t.length; }
  advance(steps: number): void {
    const end = Math.min(this.t.length, this.at + steps);
    for (; this.at < end; this.at++) {
      const op = this.t.events[3 * this.at];
      if (op === OP.range) {
        this.lo = this.t.events[3 * this.at + 1];
        this.hi = this.t.events[3 * this.at + 2];
      } else this.last = this.at;
      if (op === OP.compare) this.c.compares++;
      else if (op === OP.write) this.c.writes++;
      else if (op === OP.swap) this.c.writes += 2;
      else if (op === OP.auxWrite) this.c.aux++;
      apply(this.a, this.aux, this.t.events, this.at);
      if ((this.at + 1) % this.every === 0 || this.at + 1 === this.t.length) {
        this.history.push([this.at + 1, this.c.compares, this.c.writes, this.c.aux]);
      }
    }
  }
  /** The counts up to the replayed position, counted from the events as they were replayed. */
  counts() { return { ...this.c }; }
}

function drawBars(p: p5, ctx: PlateContext, r: Replay, x: number, y: number, w: number, h: number) {
  const n = r.a.length;
  const max = Math.max(1, ...r.t.input);
  const pal = ctx.palette();
  const auxH = r.usesAux ? Math.round(h * 0.22) : 0;
  const mainH = h - auxH - (auxH ? 4 : 0);
  const bw = w / n;
  // the auxiliary row is as wide as the kernel reserved, drawn across the same width
  const abw = w / Math.max(1, r.aux.length);
  if (r.lo >= 0 && !r.done) {
    p.noStroke();
    p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 22);
    p.rect(x + r.lo * bw, y, (r.hi - r.lo + 1) * bw, mainH);
  }
  p.noStroke();
  for (let i = 0; i < n; i++) {
    const v = r.a[i];
    const c: RGB = ramp(pal, (v - 1) / Math.max(1, max - 1));
    p.fill(c[0], c[1], c[2]);
    const bh = Math.max(1, (v / max) * mainH);
    p.rect(x + i * bw, y + mainH - bh, Math.max(1, bw - (bw > 3 ? 1 : 0)), bh);
  }
  if (auxH) {
    const ay = y + h - auxH;
    p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 18);
    p.rect(x, ay, w, auxH);
    for (let i = 0; i < r.aux.length; i++) {
      const v = r.aux[i];
      if (!v) continue;
      const c = ramp(pal, (v - 1) / Math.max(1, max - 1));
      p.fill(c[0], c[1], c[2], 200);
      const bh = Math.max(1, (v / max) * auxH);
      p.rect(x + i * abw, ay + auxH - bh, Math.max(1, abw - (abw > 3 ? 1 : 0)), bh);
    }
  }
  if (r.last >= 0 && !r.done) {
    const e = r.last;
    const op = r.t.events[3 * e];
    const marks = op === OP.swap || op === OP.compare || op === OP.auxClear
      ? [r.t.events[3 * e + 1], r.t.events[3 * e + 2]] : [r.t.events[3 * e + 1]];
    const onAux = op === OP.auxWrite || op === OP.auxRead || op === OP.auxClear;
    const cw = onAux ? abw : bw;
    p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
    for (const i of marks) {
      if (i < 0) continue;
      const my = onAux ? y + h - auxH : y + mainH;
      p.triangle(x + (i + 0.5) * cw, my - 2, x + (i + 0.5) * cw - 4, my + 5, x + (i + 0.5) * cw + 4, my + 5);
    }
  }
}

function sortedOK(r: Replay, goal: ArrayKernel['goal']): boolean {
  const a = r.a;
  if (goal === 'select') {
    const s = r.t.input.slice().sort((x, y) => x - y);
    return a[r.t.k] === s[r.t.k];
  }
  for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false;
  return true;
}

function run(kernel: ArrayKernel, ctx: PlateContext, generation: number): Trace {
  const params = ctx.params;
  const n = num(params, 'n');
  const k = kernel.goal === 'select' ? Math.min(n - 1, Math.floor((num(params, 'k') / 100) * (n - 1))) : 0;
  return trace(kernel, input(str(params, 'shape') as Shape, n, ctx.seed + generation * 7919), k);
}

function plate(info: KernelInfo, kernel: ArrayKernel): PlateCode {
  // a kernel's own bound, on the slider's grid and never below its minimum
  const max = kernel.maxN ? Math.max(8, Math.min(MAX_N, Math.floor(kernel.maxN / 8) * 8)) : MAX_N;
  const params = baseParams(64, max);
  if (kernel.goal === 'select') {
    params.splice(2, 0, { kind: 'range', key: 'k', label: 'Rank k (percent of n)', min: 0, max: 100, step: 1, value: 50, rebuild: true });
  }
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 9,
    thumbnailFrames: 2,
    params,
    create(p, ctx) {
      let generation = 0;
      let r = new Replay(run(kernel, ctx, generation));
      let hold = 0;
      let inv = 0;
      let frame = 0;
      return {
        setup() {
          if (ctx.thumbnail) r.advance(Math.floor(r.t.length * 0.45));
          inv = inversions(r.a);
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            if (!r.done) r.advance(num(ctx.params, 'speed'));
            else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              r = new Replay(run(kernel, ctx, generation));
            }
          }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          drawBars(p, ctx, r, pad, pad, ctx.width - 2 * pad, ctx.height - 2 * pad);
          if (frame++ % 8 === 0) inv = inversions(r.a);
          const c = r.counts();
          const rows: Stat[] = [
            { label: 'Comparisons', value: fmt(c.compares) },
            { label: 'Array writes', value: fmt(c.writes) },
            { label: 'Auxiliary writes', value: fmt(c.aux) },
            { label: 'Inversions left', value: fmt(inv) },
            { label: 'Progress', value: `${Math.round((100 * r.at) / Math.max(1, r.t.length))}% of ${fmt(r.t.length)} operations` },
          ];
          const h = r.history;
          ctx.chart({
            title: 'Work so far',
            x: { label: 'operations replayed' },
            y: { label: 'count' },
            series: [
              { name: 'Comparisons', points: h.map((q) => [q[0], q[1]]) },
              { name: 'Array writes', points: h.map((q) => [q[0], q[2]]) },
              ...(r.usesAux ? [{ name: 'Auxiliary writes', points: h.map((q) => [q[0], q[3]] as [number, number]) }] : []),
            ],
          });
          if (r.done) rows.push({ label: 'Result', value: sortedOK(r, kernel.goal) ? (kernel.goal === 'select' ? `a[${r.t.k}] is the ${r.t.k + 1}-th smallest` : 'ascending, verified') : 'NOT sorted' });
          ctx.stats(rows);
        },
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: ArrayKernel }[]): PlateCode {
  // the largest input the lab races, and the largest it measures: a lab frame traces one kernel
  // beside drawing every pane, so no trace may be larger than the input its slider allows (the
  // scaling run at n 512 of an uncapped kernel took 14 ms of CPU alone, against about 10 at 256)
  const labMax = Math.max(8, Math.floor(Math.min(256, ...kernels.map((k) => k.kernel.maxN ?? MAX_N)) / 8) * 8);
  const labScalingN = (k: ArrayKernel) => scalingN(k).filter((n) => n <= labMax);
  const groups = [...new Set(kernels.map((k) => k.info.group))];
  const params: ParamDef[] = [
    {
      kind: 'select', key: 'group', label: 'Compare', value: groups[0] ?? 'all', rebuild: true,
      options: [...groups.map((g) => ({ value: g, label: g })), { value: 'all', label: 'All kernels' }],
    },
    // the lab races every kernel on one input, so it stops at the smallest kernel bound
    ...baseParams(48, labMax),
  ];
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params,
    create(p, ctx) {
      let generation = 0;
      type Pane = { info: KernelInfo; kernel: ArrayKernel; r: Replay; finished: number };
      let panes: Pane[] = [];
      // the next generation's panes, traced one kernel per frame and shown once all are ready, so
      // a lab of many kernels never traces them all inside one frame (test/budget.test.ts)
      let incoming: { list: ReturnType<typeof chosen>; data: number[]; half: number; built: Pane[] } | null = null;
      let curves: { info: KernelInfo; pts: [number, number][]; slope: number }[] = [];
      let finishedCount = 0;
      let hold = 0;
      const chosen = () => {
        const g = str(ctx.params, 'group');
        return kernels.filter((k) => g === 'all' || k.info.group === g);
      };
      /** Trace the next incoming kernel; true if one was traced. */
      const buildOne = (): boolean => {
        if (!incoming) return false;
        const k = incoming.list[incoming.built.length];
        incoming.built.push({ ...k, r: new Replay(trace(k.kernel, incoming.data, incoming.half)), finished: 0 });
        if (incoming.built.length >= incoming.list.length) {
          panes = incoming.built;
          finishedCount = 0;
          incoming = null;
        }
        return true;
      };
      const build = (atOnce: boolean) => {
        const n = num(ctx.params, 'n');
        const shape = str(ctx.params, 'shape') as Shape;
        const data = input(shape, n, ctx.seed + generation * 7919);
        incoming = { list: chosen(), data, half: Math.floor(n / 2), built: [] };
        if (!incoming.list.length) { panes = []; incoming = null; }
        if (atOnce) while (buildOne());
        if (generation === 0) {
          // measured one point per frame, so building the lab never blocks a phone's main thread
          curves = chosen().map((k) => ({ info: k.info, pts: [], slope: NaN }));
          // a kernel's growth is measured up to its own bound, never past it in one frame
          const list = chosen();
          pending = curves.flatMap((_, ci) => labScalingN(list[ci].kernel).map((n) => [ci, n] as [number, number]));
        }
      };
      let pending: [number, number][] = [];
      /** Measure the next scaling point; true if one was traced. */
      const measure = (): boolean => {
        const next = pending.shift();
        if (!next) return false;
        const [ci, n] = next;
        const k = chosen()[ci];
        if (!k) return false;
        const t = trace(k.kernel, input(str(ctx.params, 'shape') as Shape, n, ctx.seed + n), Math.floor(n / 2));
        curves[ci].pts.push([n, t.truncated ? NaN : total(t)]);
        curves[ci].slope = exponent(curves[ci].pts);
        return true;
      };
      // a thumbnail is one picture: traced at once; a live lab traces one kernel per frame
      build(ctx.thumbnail);
      const color = (i: number): RGB => ramp(ctx.palette(), panes.length < 2 ? 0.5 : i / (panes.length - 1));
      return {
        setup() {
          if (ctx.thumbnail) for (const pane of panes) pane.r.advance(Math.floor(pane.r.t.length * 0.4));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          // at most one trace per frame: an incoming pane, else one scaling point; a frame that
          // traced replays nothing, so the trace is its only heavy work
          const traced = !ctx.thumbnail && (buildOne() || measure());
          const steps = Math.max(1, Math.min(num(ctx.params, 'speed'), Math.floor(LAB_OPS_PER_FRAME / Math.max(1, panes.length))));
          if (!ctx.thumbnail && !incoming && !traced) {
            for (const pane of panes) {
              if (!pane.r.done) {
                pane.r.advance(steps);
                if (pane.r.done) pane.finished = ++finishedCount;
              }
            }
            if (panes.every((x) => x.r.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build(false);
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
          const chartH = Math.round(H * 0.3);
          const gridH = H - chartH - 3 * pad;
          const m = panes.length;
          const cols = Math.max(1, Math.round(Math.sqrt((m * (W / Math.max(1, gridH))) / 1.6)));
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (gridH - pad * (rows - 1)) / Math.max(1, rows);
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.11)));
          p.textSize(fs);
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            const c = color(i);
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.rect(x, y, 4, fs + 2);
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textAlign(p.LEFT, p.TOP);
            const tag = pane.finished ? `  #${pane.finished}` : '';
            p.text(`${pane.info.title}${tag}`, x + 8, y);
            drawBars(p, ctx, pane.r, x, y + fs + 6, cw, ch - fs - 6);
          });
          // the measured scaling curves, log-log
          const cx = pad * 4; const cy = H - chartH - pad; const cwid = W - pad * 5; const chh = chartH;
          const all = curves.flatMap((c) => c.pts.filter((q) => q[1] > 0 && Number.isFinite(q[1])));
          if (all.length) {
            const lx = (n: number) => Math.log(n);
            const xs = SCALING_N.map(lx);
            const ys = all.map((q) => Math.log(q[1]));
            const x0 = Math.min(...xs); const x1 = Math.max(...xs);
            const y0 = Math.min(...ys); const y1 = Math.max(...ys);
            const X = (n: number) => cx + ((lx(n) - x0) / (x1 - x0 || 1)) * cwid;
            const Y = (w: number) => cy + chh - ((Math.log(w) - y0) / (y1 - y0 || 1)) * chh;
            p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 60);
            p.strokeWeight(1);
            p.line(cx, cy + chh, cx + cwid, cy + chh);
            p.line(cx, cy, cx, cy + chh);
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 160);
            p.textSize(Math.max(9, fs - 1));
            p.textAlign(p.CENTER, p.TOP);
            for (const n of SCALING_N) p.text(String(n), X(n), cy + chh + 2);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('operations vs n (log-log, measured)', cx + 4, cy);
            curves.forEach((cv, i) => {
              const c = color(i);
              p.stroke(c[0], c[1], c[2]);
              p.strokeWeight(2);
              p.noFill();
              p.beginShape();
              for (const [n, w] of cv.pts) if (w > 0 && Number.isFinite(w)) p.vertex(X(n), Y(w));
              p.endShape();
            });
          }
          ctx.chart({
            title: 'Measured work as n grows',
            x: { label: 'keys n', log: true },
            y: { label: 'comparisons + writes', log: true },
            series: curves.map((cv) => ({ name: cv.info.title, points: cv.pts.slice() })),
          });
          if (incoming && !panes.length) {
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 160);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`tracing ${incoming.built.length} of ${incoming.list.length} kernels on the same input`, pad, pad);
          }
          ctx.stats(panes.map((pane, i) => {
            const c = pane.r.counts();
            const slope = curves[i]?.slope;
            return {
              label: pane.info.title,
              value: `${fmt(c.compares)} cmp · ${fmt(c.writes + c.aux)} writes · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'}${pane.finished ? ` · finished #${pane.finished}` : ''}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<ArrayKernel> = { id: 'array', plate, lab };
