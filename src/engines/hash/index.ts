// The hash engine: symbol-table kernels (open addressing, chaining, extendible hashing) run one
// seeded workload of inserts, searches and deletes; the plate replays the recorded trace on a
// table of its own and measures probes per search against the load factor (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type Chart, type ParamDef, type PlateCode, type PlateContext,
  type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { apply, DELETED, EMPTY, KIND, OP, STRIDE, Table, trace, tracer, type HashKernel, type Size,
  type Step, type Tracer,
  type Trace } from './table';
import { scalingWorkload, STREAM_LABELS, STREAMS, workload, type Stream } from './workload';
import { count } from '../../core/format';

const HOLD_FRAMES = 90;
export const SCALING_N = [16, 32, 64, 128, 256, 512];
/** Trace events a lab's scaling measurement may record in one frame. */
export const FRAME_EVENTS = 40_000;

const fmt = count;
const dec = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const KIND_NAME = ['insert', 'search', 'delete'];

/** Total counted work of a trace: every hash, probe, write, removal, page and directory read. */
export function work(t: Trace): number {
  const c = t.counts;
  return c.hashes + c.probes + c.writes + c.removes + c.loads + c.dirReads;
}

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

/** Load factor of a table: keys per slot or chain, or (pages) the share of page space in use. */
export function load(t: Table, layout: HashKernel['layout'], pageSize: number): number {
  if (!t.m) return 0;
  return layout === 'pages' ? t.count / (t.m * pageSize) : t.count / t.m;
}

/** The longest run of occupied or deleted slots, wrapping around the end of the table. */
export function longestCluster(t: Table): number {
  const m = t.m;
  let best = 0; let run = 0; let first = -1;
  for (let b = 0; b < m; b++) {
    if (t.value(b, 0) !== EMPTY) { run++; best = Math.max(best, run); } else {
      if (first < 0) first = run;
      run = 0;
    }
  }
  if (first < 0) return m;
  return Math.max(best, run + first);
}

export function longestChain(t: Table): number {
  let best = 0;
  for (const b of t.buckets) best = Math.max(best, b.length);
  return best;
}

interface Point { alpha: number; hit: number; miss: number; loads: number; deleting: boolean }

/** One replayed run: a table rebuilt from the trace's events, and measurements counted from them. */
export class Replay {
  table = new Table();
  at = 0;
  c = { hashes: 0, probes: 0, writes: 0, rehashes: 0, splits: 0, doublings: 0, loads: 0 };
  op: { kind: number; key: number; ok: boolean | null; probes: number } | null = null;
  hiBucket = -1;
  hiPos = -1;
  private batch = false;
  private deleting = false;
  private acc = { hit: 0, hits: 0, miss: 0, misses: 0, loads: 0, n: 0 };
  /** Mean probes at each closed measurement batch. */
  points: Point[] = [];
  /** Every measured search so far. */
  all = { hit: 0, hits: 0, miss: 0, misses: 0 };
  /** [keys stored, pages, directory entries] as keys arrive (pages layout). */
  growth: [number, number, number][] = [];
  private every: number;
  constructor(readonly t: Trace, readonly layout: HashKernel['layout'], n: number) {
    this.every = Math.max(1, Math.floor(n / 160));
  }
  get done(): boolean { return this.at >= this.t.length; }
  advance(steps: number): void {
    const ev = this.t.events;
    const end = Math.min(this.t.length, this.at + steps);
    for (; this.at < end; this.at++) {
      const o = STRIDE * this.at;
      const op = ev[o];
      switch (op) {
        case OP.begin:
          this.op = { kind: ev[o + 1], key: ev[o + 2], ok: null, probes: 0 };
          break;
        case OP.end: {
          const ok = ev[o + 2] === 1;
          const probes = ev[o + 3];
          if (this.op) { this.op.ok = ok; this.op.probes = probes; }
          if (this.batch && ev[o + 1] === KIND.search) {
            if (ok) { this.acc.hit += probes; this.acc.hits++; this.all.hit += probes; this.all.hits++; } else {
              this.acc.miss += probes; this.acc.misses++; this.all.miss += probes; this.all.misses++;
            }
            this.acc.loads += ev[o + 4];
            this.acc.n++;
          }
          if (this.layout === 'pages' && ev[o + 1] === KIND.insert && ok
            && this.table.count % this.every === 0) {
            this.growth.push([this.table.count, this.table.m, this.table.dir.length]);
          }
          break;
        }
        case OP.hash: this.c.hashes++; break;
        case OP.probe: this.c.probes++; this.hiBucket = ev[o + 1]; this.hiPos = ev[o + 2]; break;
        case OP.write: this.c.writes++; this.hiBucket = ev[o + 1]; this.hiPos = ev[o + 2]; break;
        case OP.resize: if (this.table.m > 0) this.c.rehashes++; break;
        case OP.newPage: if (this.table.m > 0) this.c.splits++; break;
        case OP.double: this.c.doublings++; break;
        case OP.load: this.c.loads++; this.hiBucket = ev[o + 1]; break;
        case OP.check:
          if (ev[o + 1] === 1) {
            this.batch = true;
            this.deleting = ev[o + 2] === 1;
            this.acc = { hit: 0, hits: 0, miss: 0, misses: 0, loads: 0, n: 0 };
          } else {
            this.batch = false;
            const a = this.acc;
            this.points.push({
              alpha: load(this.table, this.layout, this.t.pageSize),
              hit: a.hits ? a.hit / a.hits : NaN,
              miss: a.misses ? a.miss / a.misses : NaN,
              loads: a.n ? a.loads / a.n : NaN,
              deleting: this.deleting,
            });
          }
          break;
        default: break;
      }
      apply(this.table, ev, this.at);
    }
  }
}

// ---- drawing ---------------------------------------------------------------------------------

type Box = [number, number, number, number];

function drawSlots(p: p5, ctx: PlateContext, r: Replay, [x, y, w, h]: Box): void {
  const t = r.table;
  const m = t.m;
  if (!m) return;
  const cols = Math.max(1, Math.ceil(Math.sqrt((m * w) / Math.max(1, h))));
  const rows = Math.ceil(m / cols);
  const s = Math.min(w / cols, h / rows);
  const ox = x + (w - cols * s) / 2;
  const oy = y + (h - rows * s) / 2;
  const gap = s > 6 ? 1 : 0;
  let maxD = 4;
  for (let b = 0; b < m; b++) if (t.value(b, 0) >= 0) maxD = Math.max(maxD, t.dist[b][0]);
  const pal = ctx.palette();
  const [fr, fg, fb] = ctx.fg;
  p.noStroke();
  for (let b = 0; b < m; b++) {
    const cx = ox + (b % cols) * s;
    const cy = oy + Math.floor(b / cols) * s;
    const v = t.value(b, 0);
    if (v === EMPTY) {
      p.fill(fr, fg, fb, 18);
      p.rect(cx, cy, s - gap, s - gap);
    } else if (v === DELETED) {
      p.fill(fr, fg, fb, 18);
      p.rect(cx, cy, s - gap, s - gap);
      p.fill(fr, fg, fb, 120);
      p.rect(cx + s * 0.32, cy + s * 0.32, s * 0.36 - gap, s * 0.36 - gap);
    } else {
      const c: RGB = ramp(pal, 0.12 + (0.88 * Math.log1p(t.dist[b][0])) / Math.log1p(maxD));
      p.fill(c[0], c[1], c[2]);
      p.rect(cx, cy, s - gap, s - gap);
    }
  }
  if (!r.done && r.hiBucket >= 0 && r.hiBucket < m) {
    p.noFill();
    p.stroke(fr, fg, fb);
    p.strokeWeight(Math.max(1.5, s * 0.12));
    p.rect(ox + (r.hiBucket % cols) * s, oy + Math.floor(r.hiBucket / cols) * s, s - gap, s - gap);
    p.noStroke();
  }
}

function drawChains(p: p5, ctx: PlateContext, r: Replay, [x, y, w, h]: Box): void {
  const t = r.table;
  const m = t.m;
  if (!m) return;
  const perBand = Math.max(1, Math.floor(w / 3));
  const bands = Math.ceil(m / perBand);
  const per = Math.ceil(m / bands);
  const bw = w / per;
  const bandH = h / bands;
  const maxLen = Math.max(1, longestChain(t));
  const cellH = Math.min(bw, (bandH - 6) / maxLen);
  const gap = bw > 4 ? 1 : 0;
  const pal = ctx.palette();
  const [fr, fg, fb] = ctx.fg;
  p.noStroke();
  for (let b = 0; b < m; b++) {
    const cx = x + (b % per) * bw;
    const base = y + (Math.floor(b / per) + 1) * bandH - 2;
    p.fill(fr, fg, fb, 40);
    p.rect(cx, base, Math.max(0.5, bw - gap), 2);
    const len = t.buckets[b].length;
    for (let i = 0; i < len; i++) {
      const c = ramp(pal, 0.12 + (0.88 * i) / Math.max(1, maxLen - 1));
      p.fill(c[0], c[1], c[2]);
      p.rect(cx, base - 2 - (i + 1) * cellH, Math.max(0.5, bw - gap), Math.max(0.5, cellH - (cellH > 4 ? 1 : 0)));
    }
  }
  if (!r.done && r.hiBucket >= 0 && r.hiBucket < m) {
    const b = r.hiBucket;
    const cx = x + (b % per) * bw;
    const base = y + (Math.floor(b / per) + 1) * bandH - 2;
    p.fill(fr, fg, fb);
    p.triangle(cx + bw / 2, base + 1, cx + bw / 2 - 4, base + 7, cx + bw / 2 + 4, base + 7);
    if (r.hiPos >= 0 && r.hiPos < t.buckets[b].length) {
      p.noFill();
      p.stroke(fr, fg, fb);
      p.strokeWeight(1.5);
      p.rect(cx, base - 2 - (r.hiPos + 1) * cellH, Math.max(0.5, bw - gap), Math.max(0.5, cellH - 1));
      p.noStroke();
    }
  }
}

/**
 * The first directory index of each page's run of entries. A page of local depth d owns
 * 2^(g - d) consecutive entries, so the walk jumps a whole run at a time: its cost is the
 * number of pages, not the size of the directory.
 */
export function pageRuns(t: Table): number[] {
  const runs: number[] = [];
  const D = t.dir.length;
  const g = t.globalDepth;
  for (let i = 0; i < D;) {
    runs.push(i);
    const d = t.depths[t.dir[i]] ?? g;
    i += 2 ** Math.max(0, g - d);
  }
  return runs;
}

function drawPages(p: p5, ctx: PlateContext, r: Replay, [x, y, w, h]: Box): void {
  const t = r.table;
  const B = r.t.pageSize;
  const D = t.dir.length;
  if (!D) return;
  const pal = ctx.palette();
  const [fr, fg, fb] = ctx.fg;
  // pages in directory order, so the strip and the grid read in the same order
  const rank = new Int32Array(t.m).fill(-1);
  const order: number[] = [];
  const runs = pageRuns(t);
  for (const i of runs) {
    const pg = t.dir[i];
    if (rank[pg] < 0) { rank[pg] = order.length; order.push(pg); }
  }
  const colour = (pg: number): RGB => ramp(pal, (rank[pg] * 0.6180339887) % 1, true);
  const dirH = Math.max(8, Math.round(h * 0.12));
  p.noStroke();
  for (let k = 0; k < runs.length; k++) {
    const s = runs[k];
    const e = k + 1 < runs.length ? runs[k + 1] : D;
    const c = colour(t.dir[s]);
    p.fill(c[0], c[1], c[2]);
    const x0 = x + (s / D) * w;
    const x1 = x + (e / D) * w;
    p.rect(x0, y, Math.max(0.5, x1 - x0 - (x1 - x0 > 4 ? 1 : 0)), dirH);
  }
  // the page grid
  const top = y + dirH + Math.max(10, h * 0.08);
  const H = y + h - top;
  const P = order.length;
  let best = { cols: 1, bw: 0, bh: 0 };
  for (let cols = 1; cols <= P; cols++) {
    const rows = Math.ceil(P / cols);
    const bw = w / cols;
    const bh = Math.min(H / rows, (bw * 0.9) / (B * 0.6));
    if (bh * bw > best.bh * best.bw) best = { cols, bw, bh };
  }
  const { cols, bw, bh } = best;
  const boxes = new Map<number, Box>();
  order.forEach((pg, k) => {
    const bx = x + (k % cols) * bw + bw * 0.05;
    const by = top + Math.floor(k / cols) * bh + bh * 0.08;
    const ww = bw * 0.9;
    const hh = bh * 0.84;
    boxes.set(pg, [bx, by, ww, hh]);
    const c = colour(pg);
    p.fill(fr, fg, fb, 18);
    p.rect(bx, by, ww, hh);
    // local depth against global depth, as a bar along the top of the page
    p.fill(fr, fg, fb, 110);
    p.rect(bx, by, ww * (t.globalDepth ? t.depths[pg] / t.globalDepth : 1), Math.max(1.5, hh * 0.08));
    const cw = ww / B;
    const len = t.buckets[pg].length;
    p.fill(c[0], c[1], c[2]);
    for (let i = 0; i < len; i++) {
      p.rect(bx + i * cw + (cw > 4 ? 1 : 0), by + hh * 0.16, Math.max(0.5, cw - (cw > 4 ? 2 : 0)), hh * 0.8);
    }
  });
  if (D <= 64 && P <= 64) {
    p.strokeWeight(1);
    for (let k = 0; k < runs.length; k++) {
      const s = runs[k];
      const e = k + 1 < runs.length ? runs[k + 1] : D;
      const box = boxes.get(t.dir[s]);
      if (!box) continue;
      const c = colour(t.dir[s]);
      p.stroke(c[0], c[1], c[2], 150);
      p.line(x + ((s + e) / 2 / D) * w, y + dirH, box[0] + box[2] / 2, box[1]);
    }
    p.noStroke();
  }
  if (!r.done && r.hiBucket >= 0) {
    const box = boxes.get(r.hiBucket);
    if (box) {
      p.noFill();
      p.stroke(fr, fg, fb);
      p.strokeWeight(2);
      p.rect(box[0], box[1], box[2], box[3]);
      p.noStroke();
    }
  }
}

export function drawTable(p: p5, ctx: PlateContext, r: Replay, box: Box): void {
  if (r.layout === 'slots') drawSlots(p, ctx, r, box);
  else if (r.layout === 'chains') drawChains(p, ctx, r, box);
  else drawPages(p, ctx, r, box);
}

// ---- parameters and runs ---------------------------------------------------------------------

function params(kernels: HashKernel[], n: number, nMax: number): ParamDef[] {
  const loads = kernels.map((k) => k.maxLoad).filter((x): x is number => x !== undefined);
  const out: ParamDef[] = [
    {
      kind: 'select', key: 'stream', label: 'Keys', value: 'uniform', rebuild: true,
      options: STREAMS.map((s) => ({ value: s, label: STREAM_LABELS[s] })),
    },
    { kind: 'range', key: 'n', label: 'Keys inserted', min: 8, max: nMax, step: 8, value: n, rebuild: true },
  ];
  if (loads.length) {
    const max = Math.min(...loads);
    out.push({ kind: 'range', key: 'load', label: 'Fill to load factor (percent)', min: 25, max,
      step: 5, value: Math.min(75, max), rebuild: true,
      hint: 'A fixed-size table gets n divided by this load factor, rounded up, as its slots or chains' });
  }
  if (kernels.some((k) => k.layout === 'pages')) {
    out.push({ kind: 'range', key: 'page', label: 'Keys per page', min: 4, max: 16, step: 1, value: 4, rebuild: true });
  }
  out.push(
    { kind: 'range', key: 'deletes', label: 'Keys deleted at the end (percent)', min: 0, max: 90, step: 5, value: 50, rebuild: true },
    { kind: 'range', key: 'speed', label: 'Trace events per frame', min: 1, max: 2000, step: 1, value: 12 },
    { kind: 'toggle', key: 'loop', label: 'New keys when done', value: true },
    paletteParam('ember'),
  );
  return out;
}

function sizeOf(ctx: PlateContext, n: number): Size {
  const ld = ctx.params.load === undefined ? 100 : num(ctx.params, 'load');
  const page = ctx.params.page === undefined ? 4 : num(ctx.params, 'page');
  return { n, m: Math.max(1, Math.ceil(n / (ld / 100))), pageSize: page };
}

function steps(ctx: PlateContext, n: number, seed: number) {
  return workload(str(ctx.params, 'stream') as Stream, n, num(ctx.params, 'deletes'), seed);
}

function opText(r: Replay): string {
  const o = r.op;
  if (!o) return 'allocating the table';
  const unit = r.layout === 'pages' ? 'key comparisons' : 'probes';
  const what = o.ok === null ? 'running' : o.kind === KIND.search ? (o.ok ? 'found' : 'not found')
    : o.kind === KIND.insert ? (o.ok ? 'added' : 'already present') : (o.ok ? 'deleted' : 'absent');
  const count = o.probes === 1 ? `1 ${unit.replace(/s$/, '')}` : `${o.probes} ${unit}`;
  return `${KIND_NAME[o.kind]} ${o.key}: ${what}${o.ok === null ? '' : `, ${count}`}`;
}

// ---- charts ----------------------------------------------------------------------------------

function probeChart(r: Replay, kernel: HashKernel): Chart {
  const pts = r.points;
  const pick = (deleting: boolean, f: (q: Point) => number) => pts.filter((q) => q.deleting === deleting
    && Number.isFinite(f(q))).map((q) => [q.alpha, f(q)] as [number, number]);
  const series: Chart['series'] = [
    { name: 'Hit, measured while inserting', points: pick(false, (q) => q.hit) },
    { name: 'Miss, measured while inserting', points: pick(false, (q) => q.miss) },
    { name: 'Hit, measured after deletes', points: pick(true, (q) => q.hit) },
    { name: 'Miss, measured after deletes', points: pick(true, (q) => q.miss) },
  ].filter((s) => s.points.length);
  const ex = kernel.expected;
  const top = Math.max(0, ...pts.map((q) => q.alpha));
  if (ex && top > 0) {
    const grid = Array.from({ length: 25 }, (_, i) => (top * i) / 24).filter((a) => a < 0.985);
    series.push(
      { name: `Hit, ${ex.label}`, points: grid.map((a) => [a, ex.hit(a)]) },
      { name: `Miss, ${ex.label}`, points: grid.map((a) => [a, ex.miss(a)]) },
    );
  }
  return {
    title: 'Probes per search against the load factor',
    x: { label: 'load factor (keys per slot)' },
    y: { label: r.layout === 'chains' ? 'keys compared per search' : 'slots probed per search' },
    series,
  };
}

function growthChart(r: Replay, kernel: HashKernel): Chart {
  const B = r.t.pageSize;
  const g = r.growth.filter((q) => q[0] > 0);
  const series: Chart['series'] = [
    { name: 'Pages, measured', points: g.map((q) => [q[0], q[1]]) },
    { name: 'Directory entries, measured', points: g.map((q) => [q[0], q[2]]) },
  ];
  const ex = kernel.growth;
  if (ex && g.length) {
    series.push(
      { name: `Pages, ${ex.label}: n / (b ln 2)`, points: g.map((q) => [q[0], ex.pages(q[0], B)]) },
      { name: `Directory, ${ex.label}: (e / (b ln 2)) n^(1+1/b)`, points: g.map((q) => [q[0], ex.directory(q[0], B)]) },
    );
  }
  return {
    title: 'Pages and directory as keys arrive',
    x: { label: 'keys stored', log: true },
    y: { label: 'count', log: true },
    series,
  };
}

function stats(r: Replay, kernel: HashKernel): Stat[] {
  const t = r.table;
  const last = r.points[r.points.length - 1];
  const a = load(t, r.layout, r.t.pageSize);
  const rows: Stat[] = [{ label: 'Keys stored', value: fmt(t.count) }];
  if (r.layout === 'pages') {
    rows.push(
      { label: 'Pages', value: `${fmt(t.m)} of ${r.t.pageSize} keys` },
      { label: 'Page space in use', value: `${dec(100 * a, 1)}%` },
      { label: 'Global depth', value: `${t.globalDepth} bits, ${fmt(t.dir.length)} directory entries` },
      { label: 'Page splits', value: fmt(r.c.splits) },
      { label: 'Directory doublings', value: fmt(r.c.doublings) },
      { label: 'Keys compared per search', value: last ? `${dec(last.hit)} hit · ${dec(last.miss)} miss` : '–' },
    );
  } else {
    rows.push(
      { label: r.layout === 'chains' ? 'Chains' : 'Slots', value: fmt(t.m) },
      { label: 'Load factor', value: dec(a) },
      { label: r.layout === 'chains' ? 'Keys compared per search' : 'Probes per search',
        value: last ? `${dec(last.hit)} hit · ${dec(last.miss)} miss (last batch)` : '–' },
    );
    const ex = kernel.expected;
    if (ex && a < 0.985) rows.push({ label: `${ex.label}, at this load`, value: `${dec(ex.hit(a))} hit · ${dec(ex.miss(a))} miss` });
    if (r.layout === 'chains') rows.push({ label: 'Longest chain', value: fmt(longestChain(t)) });
    else {
      rows.push({ label: 'Longest cluster', value: fmt(longestCluster(t)) });
      rows.push({ label: 'Tombstones', value: fmt(t.tombstones) });
    }
    if (!kernel.maxLoad) rows.push({ label: 'Rehashes', value: fmt(r.c.rehashes) });
  }
  rows.push(
    { label: 'Hash evaluations', value: fmt(r.c.hashes) },
    { label: 'Writes', value: fmt(r.c.writes) },
    { label: 'Operation', value: opText(r) },
    { label: 'Progress', value: `${Math.round((100 * r.at) / Math.max(1, r.t.length))}% of ${fmt(r.t.length)} events${r.t.truncated ? ' (trace truncated)' : ''}` },
  );
  return rows;
}

// ---- the plate -------------------------------------------------------------------------------

/**
 * The next run of a looping plate or lab, traced a slice of at most FRAME_EVENTS events per
 * frame while the finished run stays on screen, so the handover never computes a whole trace in
 * one frame.
 */
export class Rebuild {
  private jobs: { run: Tracer; at: number }[];
  /** Events recorded by the last step. */
  lastEvents = 0;
  constructor(kernels: HashKernel[], private steps: Step[], size: Size) {
    this.jobs = kernels.map((k) => ({ run: tracer(k, size), at: 0 }));
  }
  get ready(): boolean { return this.jobs.every((j) => j.at >= this.steps.length); }
  step(budget = FRAME_EVENTS): void {
    this.lastEvents = 0;
    for (const j of this.jobs) {
      if (this.lastEvents >= budget) return;
      if (j.at >= this.steps.length) continue;
      const before = j.run.length;
      j.at = j.run.run(this.steps, j.at, budget - this.lastEvents);
      this.lastEvents += j.run.length - before;
    }
  }
  traces(): Trace[] { return this.jobs.map((j) => j.run.result()); }
}

function plate(info: KernelInfo, kernel: HashKernel): PlateCode {
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 9,
    thumbnailFrames: 2,
    params: params([kernel], 96, 512),
    create(p, ctx) {
      let generation = 0;
      let hold = 0;
      let next: { rebuild: Rebuild; n: number } | null = null;
      const n0 = num(ctx.params, 'n');
      let r = new Replay(trace(kernel, steps(ctx, n0, ctx.seed), sizeOf(ctx, n0)), kernel.layout, n0);
      return {
        setup() {
          if (ctx.thumbnail) r.advance(Math.floor(r.t.length * 0.55));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            if (!r.done) r.advance(num(ctx.params, 'speed'));
            else if (bool(ctx.params, 'loop')) {
              // trace the next run across the hold frames; show it once it is complete
              if (!next) {
                const n = num(ctx.params, 'n');
                generation++;
                next = { rebuild: new Rebuild([kernel], steps(ctx, n, ctx.seed + generation * 7919), sizeOf(ctx, n)), n };
              }
              if (!next.rebuild.ready) next.rebuild.step();
              if (++hold > HOLD_FRAMES && next.rebuild.ready) {
                r = new Replay(next.rebuild.traces()[0], kernel.layout, next.n);
                next = null;
                hold = 0;
              }
            }
          }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          drawTable(p, ctx, r, [pad, pad, ctx.width - 2 * pad, ctx.height - 2 * pad]);
          ctx.chart(kernel.layout === 'pages' ? growthChart(r, kernel) : probeChart(r, kernel));
          ctx.stats(stats(r, kernel));
        },
      };
    },
  };
}

// ---- the lab ---------------------------------------------------------------------------------

/**
 * The lab's scaling measurement: every kernel at every n of SCALING_N, on the scaling workload,
 * run a slice of at most FRAME_EVENTS trace events per step. A run that hits the event cap is
 * left out of its curve rather than plotted.
 */
export class Scaling {
  /** Per kernel, the measured [n, work] points so far. */
  curves: [number, number][][];
  /** Events recorded by the last step. */
  lastEvents = 0;
  private jobs: [number, number][];
  private job: { ci: number; n: number; run: Tracer; steps: Step[]; at: number } | null = null;
  constructor(private kernels: HashKernel[], private stream: Stream, private size: (n: number) => Size,
    private seed: number) {
    this.curves = kernels.map(() => []);
    this.jobs = kernels.flatMap((_, ci) => SCALING_N.map((n) => [ci, n] as [number, number]));
  }
  get done(): boolean { return !this.job && !this.jobs.length; }
  step(): void {
    this.lastEvents = 0;
    while (this.lastEvents < FRAME_EVENTS) {
      if (!this.job) {
        const next = this.jobs.shift();
        if (!next) return;
        const [ci, n] = next;
        const run = tracer(this.kernels[ci], this.size(n));
        this.job = { ci, n, run, steps: scalingWorkload(this.stream, n, this.seed + n), at: 0 };
      }
      const j = this.job;
      const before = j.run.length;
      j.at = j.run.run(j.steps, j.at, FRAME_EVENTS - this.lastEvents);
      this.lastEvents += j.run.length - before;
      if (j.at >= j.steps.length) {
        const tr = j.run.result();
        if (!tr.truncated) this.curves[j.ci].push([j.n, work(tr)]);
        this.job = null;
      }
    }
  }
}

function lab(id: string, kernels: { info: KernelInfo; kernel: HashKernel }[]): PlateCode {
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: params(kernels.map((k) => k.kernel), 64, 256),
    create(p, ctx) {
      let generation = 0;
      let hold = 0;
      let finishedCount = 0;
      let panes: { info: KernelInfo; kernel: HashKernel; r: Replay; finished: number }[] = [];
      const curves = kernels.map((k) => ({ info: k.info, pts: [] as [number, number][], slope: NaN }));
      const scaling = new Scaling(kernels.map((k) => k.kernel), str(ctx.params, 'stream') as Stream,
        (n) => sizeOf(ctx, n), ctx.seed);
      let next: { rebuild: Rebuild; n: number } | null = null;
      const show = (traces: Trace[], n: number) => {
        finishedCount = 0;
        panes = kernels.map((k, i) => ({ ...k, r: new Replay(traces[i], k.kernel.layout, n), finished: 0 }));
      };
      const start = () => {
        const n = num(ctx.params, 'n');
        return { rebuild: new Rebuild(kernels.map((k) => k.kernel), steps(ctx, n, ctx.seed + generation * 7919), sizeOf(ctx, n)), n };
      };
      const build = () => {
        // the first run is traced at creation; later ones a slice per frame (see draw)
        const first = start();
        while (!first.rebuild.ready) first.rebuild.step(Infinity);
        show(first.rebuild.traces(), first.n);
      };
      // a bounded slice of the scaling runs per frame, so the lab never blocks a phone's main thread
      const measure = () => {
        scaling.step();
        scaling.curves.forEach((pts, ci) => { curves[ci].pts = pts; curves[ci].slope = exponent(pts); });
      };
      build();
      const color = (i: number): RGB => ramp(ctx.palette(), panes.length < 2 ? 0.5 : 0.1 + (0.8 * i) / (panes.length - 1));
      return {
        setup() {
          if (ctx.thumbnail) for (const pane of panes) pane.r.advance(Math.floor(pane.r.t.length * 0.5));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            measure();
            const speed = num(ctx.params, 'speed');
            for (const pane of panes) {
              if (pane.r.done) continue;
              pane.r.advance(speed);
              if (pane.r.done) pane.finished = ++finishedCount;
            }
            if (panes.every((x) => x.r.done) && bool(ctx.params, 'loop')) {
              if (!next) { generation++; next = start(); }
              if (!next.rebuild.ready) next.rebuild.step();
              if (++hold > HOLD_FRAMES && next.rebuild.ready) {
                show(next.rebuild.traces(), next.n);
                next = null;
                hold = 0;
              }
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
          const m = panes.length;
          const cols = Math.max(1, Math.round(Math.sqrt((m * W) / Math.max(1, H) / 1.3)));
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (H - pad * (rows + 1)) / Math.max(1, rows);
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
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
            p.text(`${pane.info.title}${pane.finished ? `  #${pane.finished}` : ''}`, x + 8, y);
            drawTable(p, ctx, pane.r, [x, y + fs + 8, cw, ch - fs - 8]);
          });
          ctx.chart({
            title: 'Measured work as n grows',
            x: { label: 'keys n', log: true },
            y: { label: 'hashes + probes + writes + removals + page and directory reads', log: true },
            series: curves.map((cv) => ({ name: cv.info.title, points: cv.pts.slice() })),
          });
          ctx.stats(panes.map((pane, i) => {
            const a = pane.r.all;
            const slope = curves[i].slope;
            const unit = pane.kernel.layout === 'slots' ? 'probes' : 'compared';
            return {
              label: pane.info.title,
              value: `${dec(a.hits ? a.hit / a.hits : NaN)} ${unit}/hit · ${dec(a.misses ? a.miss / a.misses : NaN)} ${unit}/miss · growth n^${dec(slope)}${pane.finished ? ` · finished #${pane.finished}` : ''}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<HashKernel> = { id: 'hash', plate, lab };
