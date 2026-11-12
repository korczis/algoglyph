// The graph engine: every graph kernel drawn as vertices and edges, replayed from its trace.
// A plate runs one kernel; a lab runs several on one input with the same event budget per
// frame and measures how each one's work grows with the number of vertices (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp, type Palette, type RGB } from '../../core/palette';
import { bool, num, str, type ParamDef, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { makeGraph, SHAPE_LABELS, type Graph, type Shape } from './graph';
import { defaultParams, E, emptyCounts, modularity, OP, start, V, work, type GraphKernel, type Options,
  type ReadoutKey, type Running, type SeriesKey, type Trace } from './trace';
import { count } from '../../core/format';
import { downFrom, fits, fitSize, HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

/** The per-frame maximum the old events slider allowed: the pace never asks more. */
const MAX_EVENTS_PER_FRAME = 2000;
const SCALING_N = [16, 32, 64, 128];
const RECENT = 6;
const W = 5;
/**
 * Work units (recorded events plus the uncounted work kernels declare) a run may compute per
 * frame: counted, not timed, so a frame's share is bounded on every machine.
 */
const FRAME_UNITS = 8_000;
/** Readouts and the chart are rebuilt every few frames; the stage shows them throttled anyway. */
const STATS_EVERY = 6;
const CHART_EVERY = 18;

const fmt = (x: number) => (Number.isInteger(x) ? count(x)
  : Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(2) : x.toPrecision(3));

/** Least-squares slope of log(work) against log(n): the measured growth exponent. */
function exponent(points: [number, number][]): number {
  const pts = points.filter(([n, w]) => n > 0 && w > 0 && Number.isFinite(w)).map(([n, w]) => [Math.log(n), Math.log(w)]);
  if (pts.length < 2) return NaN;
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let sxy = 0; let sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}

/** One replayed run: the visual state as replayed so far, and everything measured from it. */
class Replay {
  readonly g: Graph;
  vs: Int8Array; grp: Int32Array; val: Float64Array; es: Int8Array; fl: Float64Array; par: Int32Array;
  px: Float64Array; py: Float64Array; pz: Float64Array;
  mat: Float64Array | null;
  at = 0;
  c = emptyCounts();
  byState = [0, 0, 0, 0, 0];
  maxFrontier = 0;
  tree = 0;
  treeWeight = 0;
  flowValue = 0;
  cells = 0;
  change = 0;
  private acc = 0;
  recent: number[] = [];
  lastV = -1;
  lastCell: [number, number] = [-1, -1];
  history: number[][] = [];
  constructor(readonly t: Trace, readonly kernel: GraphKernel) {
    const g = t.g;
    this.g = g;
    this.vs = new Int8Array(g.n);
    this.grp = new Int32Array(g.n).fill(-1);
    this.val = new Float64Array(g.n).fill(NaN);
    this.es = new Int8Array(g.m);
    this.fl = new Float64Array(g.m);
    this.par = new Int32Array(g.n).fill(-1);
    this.px = Float64Array.from(g.x);
    this.py = Float64Array.from(g.y);
    this.pz = new Float64Array(g.n);
    this.byState[V.unseen] = g.n;
    const mv = kernel.view?.matrix;
    this.mat = mv ? new Float64Array(g.n * g.n).fill(mv === 'distance' ? Infinity : 0) : null;
    this.sample();
  }
  /** Everything replayed, and nothing left to compute. */
  get done(): boolean { return this.at >= this.t.length && this.t.finished; }
  private setV(v: number, s: number) {
    const old = this.vs[v];
    if (old === s) return;
    this.byState[old]--; this.byState[s]++;
    this.vs[v] = s;
    if (this.byState[V.frontier] > this.maxFrontier) this.maxFrontier = this.byState[V.frontier];
  }
  private setE(e: number, s: number) {
    const old = this.es[e];
    if (old === s) return;
    if (old === E.tree) { this.tree--; this.treeWeight -= this.g.w[e]; }
    if (s === E.tree) { this.tree++; this.treeWeight += this.g.w[e]; }
    this.es[e] = s;
  }
  advance(steps: number): void {
    const ev = this.t.events;
    const end = Math.min(this.t.length, this.at + steps);
    const byRounds = this.kernel.chart?.x === 'rounds';
    // about 150 chart points over the run; while it is still computing, over what exists so far
    const every = Math.max(1, Math.floor(this.t.length / 150));
    for (; this.at < end; this.at++) {
      const o = W * this.at;
      const op = ev[o]; const a = ev[o + 1]; const b = ev[o + 2]; const x = ev[o + 3]; const y = ev[o + 4];
      switch (op) {
        case OP.discover: this.c.discovers++; this.setV(a, V.frontier); this.lastV = a; break;
        case OP.settle: this.c.settles++; this.setV(a, V.done); this.lastV = a; break;
        case OP.scan: case OP.relax:
          if (op === OP.scan) this.c.scans++; else { this.c.relaxations++; if (b) this.c.improvements++; }
          if (this.es[a] === E.none) this.setE(a, E.seen);
          this.recent.push(a);
          if (this.recent.length > RECENT) this.recent.shift();
          break;
        case OP.parent: {
          const old = this.par[a];
          if (old >= 0 && this.es[old] === E.tree) this.setE(old, E.seen);
          this.par[a] = b;
          if (b >= 0) this.setE(b, E.tree);
          break;
        }
        case OP.edge: this.c.marks++; this.setE(a, b); break;
        case OP.vertex: this.c.marks++; this.setV(a, b); this.lastV = a; break;
        case OP.group: this.c.groups++; this.grp[a] = b; this.lastV = a; break;
        case OP.value: {
          this.c.values++;
          const old = this.val[a];
          if (Number.isFinite(old) && Number.isFinite(x)) this.acc += Math.abs(x - old);
          this.val[a] = x; this.lastV = a;
          break;
        }
        case OP.flow: {
          this.c.flows++;
          const d = x - this.fl[a];
          if (this.g.eu[a] === this.t.opts.s) this.flowValue += d;
          if (this.g.ev[a] === this.t.opts.s) this.flowValue -= d;
          this.fl[a] = x;
          this.recent.push(a);
          if (this.recent.length > RECENT) this.recent.shift();
          break;
        }
        case OP.cell: {
          this.c.cells++;
          if (this.mat) {
            const k = a * this.g.n + b;
            const was = this.kernel.view?.matrix === 'distance' ? Number.isFinite(this.mat[k]) : this.mat[k] !== 0;
            const now = this.kernel.view?.matrix === 'distance' ? Number.isFinite(x) : x !== 0;
            this.cells += (now ? 1 : 0) - (was ? 1 : 0);
            this.mat[k] = x;
          }
          this.lastCell = [a, b];
          break;
        }
        case OP.place: this.c.places++; this.px[a] = x; this.py[a] = y; this.pz[a] = b; break;
        case OP.round:
          this.c.rounds++; this.change = this.acc; this.acc = 0;
          if (byRounds) this.sample();
          break;
      }
      if (!byRounds && (this.at + 1) % every === 0) this.sample(this.at + 1);
    }
    if (!this.t.finished) return;
    if (this.done && this.history.length && this.history[this.history.length - 1][0] !== (byRounds ? this.c.rounds : this.t.length)) {
      this.sample(byRounds ? this.c.rounds : this.t.length);
    }
  }
  /** Rounds in the run, a trailing part after the last round counting as one: its paced unit. */
  rounds(): number {
    const ev = this.t.events;
    let n = 0;
    let tail = false;
    for (let i = 0; i < this.t.length; i++) {
      if (ev[W * i] === OP.round) { n++; tail = false; } else tail = true;
    }
    return n + (tail ? 1 : 0);
  }
  /** Replay `rounds` whole rounds, but at most `cap` events this frame (a long round spans frames). */
  advanceRounds(rounds: number, cap: number): void {
    const ev = this.t.events;
    const limit = Math.min(this.t.length, this.at + cap);
    let end = this.at;
    let left = rounds;
    while (end < limit && left > 0) {
      if (ev[W * end] === OP.round) left--;
      end++;
    }
    this.advance(end - this.at);
  }
  groups(): number {
    const s = new Set<number>();
    for (let v = 0; v < this.g.n; v++) if (this.grp[v] >= 0) s.add(this.grp[v]);
    return s.size;
  }
  modularity(): number { return modularity(this.g, this.grp); }
  /** The sum of the vertices' values that are set. */
  total(): number {
    let t = 0;
    for (let v = 0; v < this.g.n; v++) if (Number.isFinite(this.val[v])) t += this.val[v];
    return t;
  }
  series(k: SeriesKey): number {
    switch (k) {
      case 'frontier': return this.byState[V.frontier];
      case 'done': return this.byState[V.done];
      case 'unseen': return this.byState[V.unseen];
      case 'marked': return this.byState[V.mark];
      case 'tree': return this.tree;
      case 'treeWeight': return this.treeWeight;
      case 'groups': return this.groups();
      case 'modularity': return this.modularity();
      case 'change': return this.change;
      case 'flow': return this.flowValue;
      case 'cells': return this.cells;
      case 'total': return this.total();
    }
  }
  private sample(x = this.kernel.chart?.x === 'rounds' ? this.c.rounds : this.at): void {
    const keys = this.kernel.chart?.series ?? [];
    this.history.push([x, ...keys.map((k) => this.series(k))]);
  }
}

const SERIES_LABELS: Record<SeriesKey, string> = {
  frontier: 'Frontier', done: 'Finished', unseen: 'Not reached', marked: 'Marked', tree: 'Tree edges',
  treeWeight: 'Tree weight', groups: 'Groups', modularity: 'Modularity Q', change: 'Change in the round',
  flow: 'Flow value', cells: 'Matrix entries filled', total: 'Sum of values',
};

function seriesLabel(k: GraphKernel, key: SeriesKey): string {
  const n = k.names ?? {};
  const map: Partial<Record<SeriesKey, string | undefined>> = {
    frontier: n.frontier, done: n.done, marked: n.marked, tree: n.tree, groups: n.groups, total: n.total,
  };
  return map[key] ?? SERIES_LABELS[key];
}

function readout(r: Replay, key: ReadoutKey): Stat {
  const k = r.kernel;
  const n = k.names ?? {};
  const c = r.c;
  switch (key) {
    case 'discovers': return { label: 'Discoveries', value: fmt(c.discovers) };
    case 'settles': return { label: 'Settlements', value: fmt(c.settles) };
    case 'scans': return { label: 'Edges examined', value: fmt(c.scans) };
    case 'relaxations': return { label: 'Relaxations (improving)', value: `${fmt(c.relaxations)} (${fmt(c.improvements)})` };
    case 'values': return { label: `${n.value ?? 'Value'} writes`, value: fmt(c.values) };
    case 'flows': return { label: 'Flow updates', value: fmt(c.flows) };
    case 'cells': return { label: 'Matrix writes', value: fmt(c.cells) };
    case 'places': return { label: 'Vertex moves', value: fmt(c.places) };
    case 'rounds': return { label: 'Rounds', value: fmt(c.rounds) };
    case 'frontier': return { label: n.frontier ?? 'Frontier', value: fmt(r.byState[V.frontier]) };
    case 'maxFrontier': return { label: `Largest ${(n.frontier ?? 'frontier').toLowerCase()}`, value: fmt(r.maxFrontier) };
    case 'done': return { label: n.done ?? 'Finished', value: `${fmt(r.byState[V.done])} of ${fmt(r.g.n)}` };
    case 'marked': return { label: n.marked ?? 'Marked', value: fmt(r.byState[V.mark]) };
    case 'tree': return { label: n.tree ?? 'Tree edges', value: fmt(r.tree) };
    case 'treeWeight': return { label: `Weight of the ${(n.tree ?? 'tree edges').toLowerCase()}`, value: fmt(r.treeWeight) };
    case 'groups': return { label: n.groups ?? 'Groups', value: fmt(r.groups()) };
    case 'modularity': return { label: 'Modularity Q', value: r.modularity().toFixed(3) };
    case 'flow': return { label: 'Flow value', value: fmt(r.flowValue) };
    case 'change': return { label: 'Change in the last round', value: r.change.toPrecision(3) };
    case 'total': return { label: n.total ?? 'Sum of values', value: r.total().toPrecision(4) };
  }
}

/** Screen geometry of the last drawing, for picking vertices with the pointer. */
interface Projection { sx: Float64Array; sy: Float64Array; r: number }

function vertexColour(ctx: PlateContext, pal: Palette, r: Replay, v: number, lo: number, hi: number): RGB | null {
  const mode = r.kernel.view?.colour ?? 'state';
  const s = r.vs[v];
  if (s === V.mark) return ctx.fg;
  if (mode === 'group' && r.grp[v] >= 0) return ramp(pal, (r.grp[v] * 0.6180339887) % 1);
  if (mode === 'value' && Number.isFinite(r.val[v])) return ramp(pal, hi > lo ? (r.val[v] - lo) / (hi - lo) : 0.6);
  if (mode === 'state' || mode === 'group' || mode === 'value') {
    if (s === V.frontier) return ramp(pal, 0.12);
    if (s === V.done) return ramp(pal, 0.72);
  }
  return null;
}

function drawGraph(p: p5, ctx: PlateContext, r: Replay, X0: number, Y0: number, Wd: number, Ht: number,
  angle: number): Projection {
  const g = r.g;
  const pal = ctx.palette();
  const view = r.kernel.view ?? {};
  const fg = ctx.fg;
  const n = g.n;
  const sx = new Float64Array(n); const sy = new Float64Array(n); const depth = new Float64Array(n);
  const ca = Math.cos(angle); const sa = Math.sin(angle);
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (let v = 0; v < n; v++) {
    let x = r.px[v]; const y = r.py[v];
    if (view.sphere) { const z = r.pz[v]; depth[v] = -x * sa + z * ca; x = x * ca + z * sa; }
    sx[v] = x; sy[v] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (view.anchors) for (let v = 0; v < n; v++) {
    x0 = Math.min(x0, g.x[v]); x1 = Math.max(x1, g.x[v]); y0 = Math.min(y0, g.y[v]); y1 = Math.max(y1, g.y[v]);
  }
  if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
  const spanX = Math.max(1e-9, x1 - x0); const spanY = Math.max(1e-9, y1 - y0);
  const scale = Math.min(Wd / spanX, Ht / spanY);
  const ox = X0 + (Wd - spanX * scale) / 2 - x0 * scale;
  const oy = Y0 + (Ht - spanY * scale) / 2 - y0 * scale;
  for (let v = 0; v < n; v++) { sx[v] = ox + sx[v] * scale; sy[v] = oy + sy[v] * scale; }
  const rad = Math.max(2.2, Math.min(9, Math.min(Wd, Ht) / (Math.sqrt(n) * 4.2)));

  if (view.anchors) {
    p.noStroke();
    p.fill(fg[0], fg[1], fg[2], 70);
    for (let v = 0; v < n; v++) {
      const ax = ox + g.x[v] * scale; const ay = oy + g.y[v] * scale;
      p.rect(ax - 1.5, ay - 1.5, 3, 3);
    }
    p.stroke(fg[0], fg[1], fg[2], 28);
    p.strokeWeight(1);
    for (let v = 0; v < n; v++) p.line(ox + g.x[v] * scale, oy + g.y[v] * scale, sx[v], sy[v]);
  }

  // edges, in layers so the interesting ones sit on top
  const order = [E.drop, E.none, E.seen, E.back, E.tree, E.cut, E.mark];
  const arrows = g.directed && rad >= 3 && g.m <= 500;
  // one pass sorts the edges into their layers
  const layers: number[][] = [[], [], [], [], [], [], []];
  for (let e = 0; e < g.m; e++) if (!(r.es[e] === E.none && view.hidden)) layers[r.es[e]].push(e);
  for (const st of order) {
    for (const e of layers[st]) {
      const u = g.eu[e]; const v = g.ev[e];
      let c: RGB = fg; let a = 255; let wgt = 1;
      if (view.flow && r.fl[e] > 0 && st !== E.cut && st !== E.mark) {
        const f = Math.min(1, r.fl[e] / Math.max(1e-9, g.cap[e]));
        c = ramp(pal, 0.25 + 0.75 * f); wgt = 1 + 4 * f;
      } else {
        switch (st) {
          case E.drop: a = 14; break;
          case E.none: a = 46; break;
          case E.seen: a = 110; break;
          case E.back: c = ramp(pal, 0.12); a = 190; wgt = 1.3; break;
          case E.tree: c = ramp(pal, 0.72); wgt = 2.6; break;
          case E.cut: c = ramp(pal, 0.02); wgt = 3.2; break;
          case E.mark: wgt = 3.4; break;
        }
      }
      if (view.sphere) a *= 0.45 + 0.55 * ((depth[u] + depth[v]) / 2 + 1) / 2;
      p.stroke(c[0], c[1], c[2], a);
      p.strokeWeight(wgt);
      p.line(sx[u], sy[u], sx[v], sy[v]);
      if (arrows && st !== E.drop) {
        const dx = sx[v] - sx[u]; const dy = sy[v] - sy[u];
        const L = Math.hypot(dx, dy);
        if (L > 3 * rad) {
          const ux = dx / L; const uy = dy / L;
          const tx = sx[v] - ux * (rad + 1); const ty = sy[v] - uy * (rad + 1);
          const hs = 2.2 + wgt;
          p.noStroke();
          p.fill(c[0], c[1], c[2], a);
          p.triangle(tx, ty, tx - ux * hs * 1.6 - uy * hs, ty - uy * hs * 1.6 + ux * hs,
            tx - ux * hs * 1.6 + uy * hs, ty - uy * hs * 1.6 - ux * hs);
        }
      }
    }
  }
  // the edges just examined
  if (!r.done) {
    p.stroke(fg[0], fg[1], fg[2], 230);
    p.strokeWeight(2);
    for (const e of r.recent) p.line(sx[g.eu[e]], sy[g.eu[e]], sx[g.ev[e]], sy[g.ev[e]]);
  }
  if (view.weights && g.m <= 60) {
    p.noStroke();
    p.fill(fg[0], fg[1], fg[2], 170);
    p.textSize(Math.max(8, rad * 1.3));
    p.textAlign(p.CENTER, p.CENTER);
    for (let e = 0; e < g.m; e++) {
      p.text(fmt(g.w[e]), (sx[g.eu[e]] + sx[g.ev[e]]) / 2, (sy[g.eu[e]] + sy[g.ev[e]]) / 2);
    }
  }

  // vertices
  let lo = Infinity; let hi = -Infinity;
  for (let v = 0; v < n; v++) {
    const x = r.val[v];
    if (Number.isFinite(x)) { if (x < lo) lo = x; if (x > hi) hi = x; }
  }
  const ids = Array.from({ length: n }, (_, i) => i);
  if (view.sphere) ids.sort((a, b) => depth[a] - depth[b]);
  for (const v of ids) {
    let rv = rad;
    if (view.size && Number.isFinite(r.val[v]) && hi > 0) rv = rad * (0.55 + 1.6 * Math.sqrt(Math.max(0, r.val[v]) / hi));
    if (view.sphere) rv *= 0.7 + 0.3 * (depth[v] + 1) / 2;
    const c = vertexColour(ctx, pal, r, v, lo, hi);
    p.strokeWeight(1.2);
    if (c) { p.fill(c[0], c[1], c[2]); p.stroke(ctx.bg[0], ctx.bg[1], ctx.bg[2]); } else {
      p.fill(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
      p.stroke(fg[0], fg[1], fg[2], r.vs[v] === V.dim ? 50 : 150);
    }
    p.circle(sx[v], sy[v], 2 * rv);
    if (view.truth) {
      const tc = ramp(pal, (g.truth[v] * 0.6180339887 + 0.3) % 1);
      p.noFill(); p.stroke(tc[0], tc[1], tc[2], 200); p.strokeWeight(1.4);
      p.circle(sx[v], sy[v], 2 * rv + 5);
    }
    if (r.vs[v] === V.mark || r.vs[v] === V.frontier) {
      p.noFill(); p.stroke(fg[0], fg[1], fg[2]); p.strokeWeight(1.6);
      p.circle(sx[v], sy[v], 2 * rv + 6);
    }
  }
  const ends = r.kernel.endpoints;
  if (ends) {
    p.noFill(); p.stroke(fg[0], fg[1], fg[2]); p.strokeWeight(2);
    const s = r.t.opts.s;
    if (ends !== 't') p.circle(sx[s], sy[s], 2 * rad + 10);
    if (ends !== 's') { const t = r.t.opts.t; p.rect(sx[t] - rad - 5, sy[t] - rad - 5, 2 * rad + 10, 2 * rad + 10); }
  }
  if (r.lastV >= 0 && !r.done) {
    p.noFill(); p.stroke(fg[0], fg[1], fg[2], 200); p.strokeWeight(1);
    p.circle(sx[r.lastV], sy[r.lastV], 2 * rad + 14);
  }
  if (view.names && n <= 48 && g.names.length) {
    p.noStroke(); p.fill(fg[0], fg[1], fg[2], 200);
    p.textSize(Math.max(8, Math.min(11, rad * 1.4)));
    p.textAlign(p.CENTER, p.TOP);
    for (let v = 0; v < n; v++) p.text(g.names[v], sx[v], sy[v] + rad + 2);
  }
  return { sx, sy, r: rad };
}

function drawMatrix(p: p5, ctx: PlateContext, r: Replay, X0: number, Y0: number, Wd: number, Ht: number): void {
  if (!r.mat) return;
  const n = r.g.n;
  const pal = ctx.palette();
  const size = Math.min(Wd, Ht);
  const cs = size / n;
  const ox = X0 + (Wd - size) / 2; const oy = Y0 + (Ht - size) / 2;
  const dist = r.kernel.view?.matrix === 'distance';
  let lo = Infinity; let hi = -Infinity;
  if (dist) for (const x of r.mat) if (Number.isFinite(x)) { if (x < lo) lo = x; if (x > hi) hi = x; }
  p.noStroke();
  p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 14);
  p.rect(ox, oy, size, size);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = r.mat[i * n + j];
      if (dist ? !Number.isFinite(x) : x === 0) continue;
      const c = dist ? ramp(pal, hi > lo ? (x - lo) / (hi - lo) : 0.5) : ramp(pal, 0.72);
      p.fill(c[0], c[1], c[2]);
      p.rect(ox + j * cs, oy + i * cs, Math.max(1, cs - (cs > 4 ? 1 : 0)), Math.max(1, cs - (cs > 4 ? 1 : 0)));
    }
  }
  const [li, lj] = r.lastCell;
  if (li >= 0 && !r.done) {
    p.noFill(); p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2]); p.strokeWeight(1.5);
    p.rect(ox + lj * cs, oy + li * cs, cs, cs);
    p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 60); p.strokeWeight(1);
    p.rect(ox, oy + li * cs, size, cs);
    p.rect(ox + lj * cs, oy, cs, size);
  }
}

function inputParam(kernel: GraphKernel): ParamDef[] {
  if (kernel.inputs.length < 2) return [];
  return [{
    kind: 'select', key: 'shape', label: 'Input', value: kernel.inputs[0], rebuild: true,
    options: kernel.inputs.map((s) => ({ value: s, label: SHAPE_LABELS[s] })),
  }];
}

function sizeParam(kernel: GraphKernel, cap?: number): ParamDef {
  const n = kernel.n ?? { min: 8, max: 240, value: 60 };
  const max = cap ? Math.min(cap, n.max) : n.max;
  return { kind: 'range', key: 'n', label: 'Vertices', min: n.min, max, step: 1, value: Math.min(max, n.value), rebuild: true };
}

const aspectOf = (k: GraphKernel) => (k.view?.matrix ? 1 : 16 / 9);

function options(kernel: GraphKernel, g: Graph, ctx: PlateContext, pick: number): Options {
  const p = defaultParams(kernel);
  for (const d of kernel.params ?? []) if (d.key in ctx.params) p[d.key] = ctx.params[d.key];
  const s = kernel.pick === 's' && pick >= 0 && pick < g.n ? pick : g.s;
  const t = kernel.pick === 't' && pick >= 0 && pick < g.n ? pick : g.t;
  return { s, t, p };
}

function plate(info: KernelInfo, kernel: GraphKernel): PlateCode {
  const params: ParamDef[] = [
    ...inputParam(kernel),
    sizeParam(kernel),
    ...(kernel.params ?? []),
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New graph when done', value: true },
    paletteParam('spectral'),
  ];
  const shapeOf = (ctx: PlateContext) => (kernel.inputs.length > 1 ? str(ctx.params, 'shape') : kernel.inputs[0]) as Shape;
  // a kernel charted by rounds whose events are too many to watch is paced by rounds: one
  // iteration is then the change a reader follows (decided per run, once its length is known)
  const canRound = kernel.chart?.x === 'rounds';
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 9,
    thumbnailFrames: 2,
    params,
    pace: { kind: 'replay', unit: canRound ? 'events, or rounds for a long run' : 'events' },
    create(p, ctx) {
      const pacer = new Pacer('replay', 'events', MAX_EVENTS_PER_FRAME);
      let byRounds = false;
      // the run computes in slices while it replays: at the ceiling until its length is known
      const measured = () => {
        if (pacer.length !== null || !r.t.finished) return;
        byRounds = canRound && !fits('replay', r.t.length) && r.rounds() > 0;
        pacer.unit = byRounds ? 'rounds' : 'events';
        pacer.known(byRounds ? r.rounds() : r.t.length, byRounds ? r.c.rounds : r.at);
      };
      let generation = 0;
      let pick = -1;
      let g = makeGraph(shapeOf(ctx), num(ctx.params, 'n'), ctx.seed, aspectOf(kernel));
      let running: Running;
      const run = () => {
        running = start(kernel, g, options(kernel, g, ctx, pick), ctx.seed + generation, kernel.cap);
        // a thumbnail needs the whole run; the live plate computes a slice per frame
        running.step(ctx.thumbnail ? Infinity : FRAME_UNITS);
        return new Replay(running.t, kernel);
      };
      let r = run();
      measured();
      let hold = 0;
      let angle = 0.6;
      let proj: Projection | null = null;
      let frame = 0;
      return {
        setup() {
          if (ctx.thumbnail) r.advance(Math.floor(r.t.length * 0.45));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            if (!r.t.finished) running.step(FRAME_UNITS);
            measured();
            if (!r.done) {
              const k = pacer.take(ctx.params);
              if (k) {
                if (byRounds) r.advanceRounds(k, MAX_EVENTS_PER_FRAME);
                else r.advance(k);
              }
            } else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              pick = -1;
              g = makeGraph(shapeOf(ctx), num(ctx.params, 'n'), ctx.seed + generation * 7919, aspectOf(kernel));
              r = run();
              pacer.start();
              measured();
            }
            if (kernel.view?.sphere) angle += 0.006;
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.round(Math.min(W, H) * 0.04);
          if (r.mat) {
            const half = (W - 3 * pad) / 2;
            proj = drawGraph(p, ctx, r, pad, pad, half, H - 2 * pad, angle);
            drawMatrix(p, ctx, r, 2 * pad + half, pad, half, H - 2 * pad);
          } else proj = drawGraph(p, ctx, r, pad, pad, W - 2 * pad, H - 2 * pad, angle);
          if (frame++ % STATS_EVERY) return;
          const keys = kernel.readouts ?? ['scans', 'done', 'frontier'];
          const rows: Stat[] = [
            { label: 'Graph', value: `${fmt(g.n)} vertices, ${fmt(g.m)} edges` },
            ...keys.map((k) => readout(r, k)),
            {
              label: 'Progress',
              value: r.t.finished
                ? `${Math.round((100 * r.at) / Math.max(1, r.t.length))}% of ${fmt(r.t.length)} events${r.t.truncated ? ' (stopped at the event cap)' : ''}`
                : `${fmt(r.at)} of ${fmt(r.t.length)} events so far (still computing)`,
            },
            pacer.row(ctx.params),
          ];
          if (r.done && r.t.result !== undefined && kernel.report) rows.push(...kernel.report(r.t.result, g, r.t.opts));
          ctx.stats(rows);
          if (kernel.chart && (frame - 1) % CHART_EVERY === 0) {
            const ch = kernel.chart;
            ctx.chart({
              title: ch.title,
              x: { label: ch.x === 'rounds' ? 'round' : 'events replayed' },
              y: { label: ch.y, log: ch.log },
              series: ch.series.map((s, i) => ({
                name: seriesLabel(kernel, s),
                points: r.history.map((h) => [h[0], h[i + 1]] as [number, number])
                  .filter((q) => Number.isFinite(q[1]) && (!ch.log || q[1] > 0)),
              })),
            });
          }
        },
        pressed(x, y) {
          if (!kernel.pick || !proj) return;
          let best = -1; let bd = Infinity;
          for (let v = 0; v < g.n; v++) {
            const d = (proj.sx[v] - x) ** 2 + (proj.sy[v] - y) ** 2;
            if (d < bd) { bd = d; best = v; }
          }
          if (best < 0 || bd > (6 * proj.r) ** 2) return;
          pick = best;
          hold = 0;
          r = run();
          pacer.start();
          measured();
        },
        pace: () => pacer.report(r.done, ctx.params),
      };
    },
  };
}

/** A lab whose every kernel is charted by rounds can be paced by rounds, as its plates are. */
const allRound = (kernels: { kernel: GraphKernel }[]) => kernels.every((k) => k.kernel.chart?.x === 'rounds');

/** What a lab's run is paced in: the longest pane's events, or its rounds when those are too many. */
function labLength(kernels: { kernel: GraphKernel }[], events: number[], rounds: () => number[]): { unit: string; length: number } {
  const most = Math.max(0, ...events);
  if (fits('replay', most) || !allRound(kernels)) return { unit: 'events', length: most };
  return { unit: 'rounds', length: Math.max(0, ...rounds()) };
}

/**
 * The lab's default number of vertices: `want`, or the largest smaller one whose run, counted at
 * the canonical seed, is still watchable at the calm pace (config/pacing.yaml).
 */
function labN(kernels: { kernel: GraphKernel }[], shape: Shape, min: number, want: number): number {
  const lengthAt = (n: number) => {
    const g = makeGraph(shape, n, 4242, 4 / 3);
    const runs = kernels.map((k) => {
      const run = start(k.kernel, g, { s: g.s, t: g.t, p: defaultParams(k.kernel) }, 4242, 2_000_000, false);
      run.step(Infinity);
      return run.t;
    });
    return labLength(kernels, runs.map((t) => t.length), () => runs.map((t) => t.counts.rounds + 1)).length;
  };
  return fitSize('replay', downFrom(want, min, 4), lengthAt);
}

function lab(id: string, kernels: { info: KernelInfo; kernel: GraphKernel }[]): PlateCode {
  // the inputs every kernel of the lab accepts, in the first kernel's order
  const common = kernels[0]?.kernel.inputs.filter((s) => kernels.every((k) => k.kernel.inputs.includes(s))) ?? [];
  const shapes: Shape[] = common.length ? common : ['geometric'];
  const nmin = Math.max(...kernels.map((k) => k.kernel.n?.min ?? 8));
  const nmax = Math.min(...kernels.map((k) => k.kernel.n?.max ?? 240), 160);
  const params: ParamDef[] = [
    ...(shapes.length > 1 ? [{
      kind: 'select', key: 'shape', label: 'Input', value: shapes[0], rebuild: true,
      options: shapes.map((s) => ({ value: s, label: SHAPE_LABELS[s] })),
    } as ParamDef] : []),
    { kind: 'range', key: 'n', label: 'Vertices', min: nmin, max: Math.max(nmin, nmax), step: 1, value: labN(kernels, shapes[0], nmin, Math.max(nmin, Math.min(nmax, 40))), rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New graph when done', value: true },
    paletteParam('spectral'),
  ];
  const shapeOf = (ctx: PlateContext) => (shapes.length > 1 ? str(ctx.params, 'shape') : shapes[0]) as Shape;
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params,
    pace: { kind: 'replay', unit: allRound(kernels) ? 'events, or rounds for a long run' : 'events' },
    create(p, ctx) {
      let generation = 0;
      // one pace for every pane, from the longest run once all are computed: the same events
      // per frame each, so the race stays fair
      const pacer = new Pacer('replay', 'events', MAX_EVENTS_PER_FRAME);
      let panes: { info: KernelInfo; kernel: GraphKernel; run: Running; r: Replay; finished: number }[] = [];
      const curves = kernels.map((k) => ({ info: k.info, pts: [] as [number, number][], slope: NaN }));
      let pending = curves.flatMap((_, ci) => SCALING_N.map((n) => [ci, n] as [number, number]));
      let finishedCount = 0;
      let hold = 0;
      let frame = 0;
      const build = () => {
        const shape = shapeOf(ctx);
        const g = makeGraph(shape, num(ctx.params, 'n'), ctx.seed + generation * 7919, 4 / 3);
        finishedCount = 0;
        panes = kernels.map((k) => {
          const opts: Options = { s: g.s, t: g.t, p: defaultParams(k.kernel) };
          const run = start(k.kernel, g, opts, ctx.seed + generation);
          run.step(ctx.thumbnail ? Infinity : FRAME_UNITS / kernels.length);
          return { ...k, run, r: new Replay(run.t, k.kernel), finished: 0 };
        });
      };
      // the scaling runs: one at a time, counted but not recorded, a slice per frame
      let measuring: { ci: number; n: number; run: Running } | null = null;
      const measure = () => {
        if (!measuring) {
          const next = pending.shift();
          if (!next) return;
          const [ci, n] = next;
          const k = kernels[ci].kernel;
          const g = makeGraph(shapeOf(ctx), Math.max(k.n?.min ?? 2, n), ctx.seed + n, 4 / 3);
          measuring = { ci, n: g.n, run: start(k, g, { s: g.s, t: g.t, p: defaultParams(k) }, ctx.seed, 2_000_000, false) };
        }
        measuring.run.step(FRAME_UNITS / 2);
        const t = measuring.run.t;
        if (!t.finished) return;
        const cv = curves[measuring.ci];
        cv.pts.push([measuring.n, t.truncated ? NaN : work(t.counts)]);
        cv.slope = exponent(cv.pts);
        measuring = null;
      };
      build();
      return {
        setup() {
          if (ctx.thumbnail) for (const pane of panes) pane.r.advance(Math.floor(pane.r.t.length * 0.4));
          pending = ctx.thumbnail ? [] : pending;
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            // the scaling runs wait until the panes' own runs are computed, so the two never
            // share a frame
            if (panes.every((x) => x.run.t.finished)) measure();
            if (pacer.length === null && panes.every((x) => x.run.t.finished)) {
              const { unit, length } = labLength(kernels, panes.map((x) => x.r.t.length), () => panes.map((x) => x.r.rounds()));
              pacer.unit = unit;
              pacer.known(length, unit === 'rounds' ? Math.max(0, ...panes.map((x) => x.r.c.rounds)) : Math.max(0, ...panes.map((x) => x.r.at)));
            }
            const steps = panes.some((x) => !x.r.done) ? pacer.take(ctx.params) : 0;
            for (const pane of panes) {
              if (!pane.run.t.finished) pane.run.step(FRAME_UNITS / panes.length);
              if (!pane.r.done && steps) {
                if (pacer.unit === 'rounds') pane.r.advanceRounds(steps, MAX_EVENTS_PER_FRAME);
                else pane.r.advance(steps);
                if (pane.r.done) pane.finished = ++finishedCount;
              }
            }
            if (panes.every((x) => x.r.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build();
              pacer.start();
              pacer.unit = 'events';
            }
          }
          const Wd = ctx.width; const Ht = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(Wd, Ht) * 0.025));
          const m = panes.length;
          const cols = Math.max(1, Math.round(Math.sqrt((m * Wd) / Ht)));
          const rows = Math.ceil(m / cols);
          const cw = (Wd - pad * (cols + 1)) / cols;
          const ch = (Ht - pad * (rows + 1)) / Math.max(1, rows);
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 10);
            p.rect(x, y, cw, ch);
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`${pane.info.title}${pane.finished ? `  #${pane.finished}` : ''}`, x + 4, y + 3);
            drawGraph(p, ctx, pane.r, x + 4, y + fs + 8, cw - 8, ch - fs - 12, 0.6);
          });
          if (frame++ % STATS_EVERY) return;
          ctx.chart({
            title: 'Measured work as the graph grows',
            x: { label: 'vertices n', log: true },
            y: { label: 'counted operations', log: true },
            series: curves.map((cv) => ({ name: cv.info.title, points: cv.pts.filter((q) => q[1] > 0 && Number.isFinite(q[1])) })),
          });
          ctx.stats(panes.map((pane, i) => {
            const slope = curves[i].slope;
            return {
              label: pane.info.title,
              value: `${fmt(work(pane.r.c))} counted operations in ${fmt(pane.r.at)} events replayed · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'}${pane.finished ? ` · finished #${pane.finished} (same events per frame)` : ''}`,
            };
          }).concat([pacer.row(ctx.params)]));
        },
        pace: () => pacer.report(panes.length > 0 && panes.every((x) => x.r.done), ctx.params),
      };
    },
  };
}

export const engine: Engine<GraphKernel> = { id: 'graph', plate, lab };
