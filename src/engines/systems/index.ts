// The systems engine: protocols on a seeded discrete-event simulator, replayed as a space-time
// (swim-lane) diagram. Each lane is a process, node, client or server; messages are arrows from
// send to arrival, lost ones end in a cross; lane states are bands, and a kernel with a state
// machine gets it drawn beside the lanes with every observed transition counted. Readouts and
// charts are counted from the recorded trace up to the replayed time (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, type ParamDef, type Params, type PlateCode, type PlateContext,
  type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { defaultParams, NET_PARAMS, simulate, type MarkEv, type MsgEv, type Run,
  type SystemsKernel } from './sim';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

export type { SystemsKernel } from './sim';

const fmt = (x: number, digits = 0) => (Number.isFinite(x)
  ? x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '–');

interface Segment { lane: number; t0: number; t1: number; state: string }

/** One replayed run: the trace, and the counters and gauges up to the replayed time. */
class Replay {
  t = 0;
  private cursor = 0;
  counts = new Map<string, number>();
  gauges = new Map<string, number>();
  msgs: MsgEv[] = [];
  marks: MarkEv[] = [];
  segments: Segment[] = [];
  states: string[] = [];
  /** Observed transitions of the kernel's machine, "from>to" -> count, up to the replayed time. */
  transitions = new Map<string, number>();
  private trans: { t: number; key: string }[] = [];
  private transAt = 0;
  series = new Map<string, [number, number][]>();
  constructor(readonly run: Run, readonly kernel: SystemsKernel) {
    const { net } = run;
    const last = new Map<number, Segment>();
    const known = new Set<string>(kernel.machine?.states ?? []);
    this.states = [...known];
    const machineLanes = kernel.machine?.lanes;
    for (const e of net.events) {
      if (e.k === 'msg') this.msgs.push(e);
      else if (e.k === 'mark') this.marks.push(e);
      else if (e.k === 'state') {
        const prev = last.get(e.lane);
        if (prev) prev.t1 = e.t;
        if (kernel.machine && prev && (!machineLanes || machineLanes.includes(e.lane))
          && prev.state !== e.state) this.trans.push({ t: e.t, key: `${prev.state}>${e.state}` });
        const seg = { lane: e.lane, t0: e.t, t1: run.span, state: e.state };
        last.set(e.lane, seg);
        this.segments.push(seg);
        if (e.state && !known.has(e.state)) { known.add(e.state); this.states.push(e.state); }
      }
    }
    // samples, binned when the chart asks for a rate
    const bin = kernel.chart?.bin;
    for (const name of kernel.chart?.series ?? []) this.series.set(name, []);
    if (kernel.chart && !kernel.chart.series) {
      for (const e of net.events) if (e.k === 'sample' && !this.series.has(e.series)) this.series.set(e.series, []);
    }
    if (bin) {
      const nb = Math.ceil(run.span / bin);
      const sums = new Map<string, number[]>();
      for (const name of this.series.keys()) sums.set(name, new Array(nb).fill(0));
      for (const e of net.events) {
        if (e.k !== 'sample') continue;
        const b = Math.min(nb - 1, Math.floor(e.t / bin));
        const arr = sums.get(e.series);
        if (arr) arr[b] += e.value;
      }
      for (const [name, arr] of sums) {
        this.series.set(name, arr.map((v, i) => [(i + 1) * bin, v] as [number, number]));
      }
    } else {
      for (const e of net.events) {
        if (e.k === 'sample') this.series.get(e.series)?.push([e.t, e.value]);
      }
    }
  }
  get horizon() { return this.run.span; }
  /** What the lanes show change: messages, marks and state bands; the run's paced length. */
  get changes() { return this.msgs.length + this.marks.length + this.segments.length; }
  get done() { return this.t >= this.horizon; }
  advanceTo(t: number) {
    this.t = Math.min(this.horizon, t);
    const { events, stamps } = this.run.net;
    for (; this.cursor < events.length && stamps[this.cursor] <= this.t; this.cursor++) {
      const e = events[this.cursor];
      if (e.k === 'count') this.counts.set(e.key, (this.counts.get(e.key) ?? 0) + e.by);
      else if (e.k === 'gauge') this.gauges.set(e.key, e.value);
    }
    for (; this.transAt < this.trans.length && this.trans[this.transAt].t <= this.t; this.transAt++) {
      const k = this.trans[this.transAt].key;
      this.transitions.set(k, (this.transitions.get(k) ?? 0) + 1);
    }
  }
  count(key: string) { return this.counts.get(key) ?? 0; }
  private verdictText: string | undefined;
  /** The kernel's result line for the finished run, computed once. */
  verdict(): string | undefined {
    if (!this.kernel.verdict) return undefined;
    this.verdictText ??= this.kernel.verdict(this.run.result, this.run.net);
    return this.verdictText;
  }
  /** Chart series up to the replayed time (complete bins only). */
  chartSeries() {
    const out: { name: string; points: [number, number][] }[] = [];
    for (const [name, pts] of this.series) {
      const upto = pts.filter((q) => q[0] <= this.t);
      const stride = Math.max(1, Math.ceil(upto.length / 400));
      out.push({ name, points: stride > 1 ? upto.filter((_, i) => i % stride === 0) : upto });
    }
    return out;
  }
  /** Lanes' current states at the replayed time. */
  current(): Map<number, string> {
    const m = new Map<number, string>();
    for (const s of this.segments) if (s.t0 <= this.t) m.set(s.lane, s.state);
    return m;
  }
}

function readouts(r: Replay): Stat[] {
  const k = r.kernel;
  const rows: Stat[] = k.readouts.map((d) => {
    const v = d.kind === 'gauge' ? r.gauges.get(d.key) ?? NaN : r.count(d.key);
    return { label: d.label, value: `${fmt(v, d.digits ?? 0)}${Number.isFinite(v) ? d.unit ?? '' : ''}` };
  });
  rows.push({ label: 'Messages sent', value: fmt(r.count('net.sent')) });
  if (r.count('net.dropped') || r.run.net.cfg.loss > 0 || r.run.net.cfg.partition) {
    rows.push({ label: 'Messages dropped (loss or partition)', value: fmt(r.count('net.dropped')) });
  }
  rows.push({ label: 'Simulated time', value: `${fmt(r.t)} of ${fmt(r.horizon)} ms` });
  if (r.done && k.verdict) rows.push({ label: 'Result', value: r.verdict() ?? '' });
  if (r.run.net.truncated) rows.push({ label: 'Trace', value: 'stopped at the event cap' });
  return rows;
}

const alpha = (c: RGB, a: number): [number, number, number, number] => [c[0], c[1], c[2], a];

/** The time window the diagram shows: the whole run, or the last `window` ms of it. */
function view(r: Replay): [number, number] {
  const span = r.horizon;
  const win = Math.min(span, r.run.setup.window ?? Math.min(span, 1500));
  const v1 = Math.min(span, Math.max(win, r.t));
  return [v1 - win, v1];
}

/** The swim-lane diagram of a replay inside the box (x, y, w, h). */
function drawLanes(p: p5, ctx: PlateContext, r: Replay, x: number, y: number, w: number, h: number,
  compact: boolean) {
  const pal = ctx.palette();
  const fg = ctx.fg;
  const lanes = r.run.net.lanes;
  let fs = compact ? 9 : Math.max(9, Math.min(12, Math.round(h / (lanes.length * 2.6))));
  p.textSize(fs);
  // lane names take at most a quarter of the width; on a phone the type shrinks to fit
  const widest = Math.max(...lanes.map((s) => p.textWidth(s)));
  const room = Math.round(w * 0.25) - 10;
  if (!compact && widest > room) { fs = Math.max(7, Math.floor((fs * room) / widest)); p.textSize(fs); }
  const labelW = compact ? 0 : Math.min(room, Math.max(...lanes.map((s) => p.textWidth(s)))) + 10;
  const axisH = compact ? 0 : fs + 6;
  const x0 = x + labelW; const x1 = x + w - 4;
  const top = y + 4; const bottom = y + h - axisH;
  const [v0, v1] = view(r);
  const X = (t: number) => x0 + ((t - v0) / Math.max(1e-9, v1 - v0)) * (x1 - x0);
  const gap = (bottom - top) / lanes.length;
  const Y = (lane: number) => top + (lane + 0.5) * gap;
  const tone = (state: string) => {
    const i = r.states.indexOf(state);
    return ramp(pal, r.states.length < 2 ? 0.5 : i / (r.states.length - 1));
  };
  const now = r.t;
  // lane baselines and names
  p.stroke(...alpha(fg, 50));
  p.strokeWeight(1);
  for (let i = 0; i < lanes.length; i++) p.line(x0, Y(i), x1, Y(i));
  if (!compact) {
    p.noStroke();
    p.fill(...alpha(fg, 220));
    p.textAlign(p.RIGHT, p.CENTER);
    for (let i = 0; i < lanes.length; i++) p.text(lanes[i], x0 - 6, Y(i));
  }
  // p.push() saves the canvas context with p5's own style cache, so the clip and every fill or
  // stroke set inside it are undone together by p.pop(); a bare save()/restore() would leave
  // p5 believing a colour is set that the canvas has already dropped
  p.push();
  const g = p.drawingContext as CanvasRenderingContext2D;
  g.beginPath();
  g.rect(x0 - 5, y, x1 - x0 + 10, h);
  g.clip();
  // a partition window
  const part = r.run.net.cfg.partition;
  if (part && part.from < now && part.to > v0) {
    p.noStroke();
    p.fill(...alpha(fg, 16));
    const a = X(Math.max(v0, part.from));
    p.rect(a, top, X(Math.min(part.to, now)) - a, bottom - top);
    if (!compact) {
      p.fill(...alpha(fg, 150));
      p.textAlign(p.LEFT, p.TOP);
      p.text('partition', a + 3, top);
    }
  }
  // state bands
  const bandH = Math.max(3, gap * 0.22);
  p.noStroke();
  for (const s of r.segments) {
    if (!s.state || s.t0 > now || s.t1 < v0) continue;
    const c = tone(s.state);
    p.fill(...alpha(c, 80));
    const a = X(Math.max(v0, s.t0));
    p.rect(a, Y(s.lane) - bandH / 2, Math.max(1, X(Math.min(s.t1, now)) - a), bandH);
  }
  // messages: background traffic faint, the rest fainter the more of it is on screen
  const drop = ramp(pal, 0);
  const visible = r.msgs.filter((m) => m.t0 <= now && m.t1 >= v0);
  const loud = visible.filter((m) => !m.quiet).length;
  const strong = Math.round(Math.max(45, Math.min(150, (150 * 120) / Math.max(1, loud))));
  for (const m of visible) {
    const ax = X(m.t0); const ay = Y(m.from);
    const end = m.fate === 0 ? m.t1 : m.t0 + (m.t1 - m.t0) * 0.5;
    if (m.fate !== 0 && end < v0) continue;
    const f = Math.min(1, (now - m.t0) / Math.max(1e-9, end - m.t0));
    const bx = ax + (X(end) - ax) * f; const by = ay + (Y(m.to) - ay) * f;
    if (m.fate === 0) {
      p.stroke(...alpha(fg, m.quiet ? 32 : strong));
      p.strokeWeight(1);
      p.line(ax, ay, bx, by);
      if (f >= 1 && !m.quiet && strong > 60 && Math.hypot(bx - ax, by - ay) > 8) {
        const a = Math.atan2(by - ay, bx - ax);
        p.noStroke();
        p.fill(...alpha(fg, strong + 20));
        p.triangle(bx, by, bx - 6 * Math.cos(a - 0.4), by - 6 * Math.sin(a - 0.4),
          bx - 6 * Math.cos(a + 0.4), by - 6 * Math.sin(a + 0.4));
      }
    } else {
      p.stroke(...alpha(drop, 170));
      p.strokeWeight(1);
      p.line(ax, ay, bx, by);
      if (f >= 1) {
        const s = 3;
        p.line(bx - s, by - s, bx + s, by + s);
        p.line(bx - s, by + s, bx + s, by - s);
      }
    }
  }
  // point events, labelled where a label fits beside the previous one on its lane
  const dot = Math.max(4, Math.min(8, gap * 0.28));
  p.textSize(Math.max(8, fs - 2));
  p.textAlign(p.CENTER, p.BOTTOM);
  const lastRight = new Array<number>(lanes.length).fill(-Infinity);
  for (const m of r.marks) {
    if (m.t > now || m.t < v0) continue;
    const c = ramp(pal, m.tone);
    const mx = X(m.t);
    p.noStroke();
    p.fill(c[0], c[1], c[2]);
    p.circle(mx, Y(m.lane), dot);
    if (!compact && m.label) {
      const half = p.textWidth(m.label) / 2;
      if (mx - half > lastRight[m.lane] + 2) {
        p.fill(...alpha(fg, 200));
        p.text(m.label, mx, Y(m.lane) - dot / 2 - 1);
        lastRight[m.lane] = mx + half;
      }
    }
  }
  // the replay cursor
  p.stroke(...alpha(fg, 120));
  p.strokeWeight(1);
  p.line(X(now), top, X(now), bottom);
  p.pop();
  if (!compact) {
    p.noStroke();
    p.fill(...alpha(fg, 150));
    p.textSize(Math.max(8, fs - 1));
    p.textAlign(p.CENTER, p.TOP);
    const ticks = Math.max(2, Math.min(5, Math.floor((x1 - x0) / 90)));
    for (let i = 0; i <= ticks; i++) {
      const t = v0 + ((v1 - v0) * i) / ticks;
      const label = i === ticks ? `${fmt(t)} ms` : fmt(t);
      const tx = Math.min(Math.max(X(t), x0 + p.textWidth(label) / 2), x1 - p.textWidth(label) / 2);
      p.text(label, tx, bottom + 3);
    }
  }
}

/** The kernel's state machine: states on a ring, edges weighted by observed transitions. */
function drawMachine(p: p5, ctx: PlateContext, r: Replay, x: number, y: number, w: number, h: number) {
  const states = r.kernel.machine?.states ?? [];
  if (!states.length) return;
  const pal = ctx.palette();
  const fg = ctx.fg;
  const cx = x + w / 2; const cy = y + h / 2;
  const R = Math.min(w, h) * 0.32;
  const rad = Math.max(16, Math.min(w, h) * 0.13);
  const pos = states.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / states.length;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number];
  });
  const fs = Math.max(9, Math.min(12, Math.round(rad * 0.5)));
  p.textSize(fs);
  for (const [key, n] of r.transitions) {
    const [a, b] = key.split('>');
    const i = states.indexOf(a); const j = states.indexOf(b);
    if (i < 0 || j < 0) continue;
    const [ax, ay] = pos[i]; const [bx, by] = pos[j];
    // offset the two directions of an edge so both stay visible
    const ang = Math.atan2(by - ay, bx - ax);
    const ox = -Math.sin(ang) * 5; const oy = Math.cos(ang) * 5;
    const sx = ax + Math.cos(ang) * rad + ox; const sy = ay + Math.sin(ang) * rad + oy;
    const ex = bx - Math.cos(ang) * rad + ox; const ey = by - Math.sin(ang) * rad + oy;
    p.stroke(...alpha(fg, 150));
    p.strokeWeight(Math.min(4, 1 + Math.log2(1 + n)));
    p.line(sx, sy, ex, ey);
    p.noStroke();
    p.fill(...alpha(fg, 170));
    p.triangle(ex, ey, ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4),
      ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4));
    p.fill(...alpha(fg, 230));
    p.textAlign(p.CENTER, p.CENTER);
    p.text(String(n), (sx + ex) / 2 + ox * 2, (sy + ey) / 2 + oy * 2);
  }
  const occupancy = new Map<string, number>();
  const lanes = r.kernel.machine?.lanes;
  for (const [lane, s] of r.current()) {
    if (lanes && !lanes.includes(lane)) continue;
    occupancy.set(s, (occupancy.get(s) ?? 0) + 1);
  }
  states.forEach((s, i) => {
    const c = ramp(pal, states.length < 2 ? 0.5 : r.states.indexOf(s) / Math.max(1, r.states.length - 1));
    const occ = occupancy.get(s) ?? 0;
    p.stroke(c[0], c[1], c[2]);
    p.strokeWeight(occ ? 3 : 1.5);
    p.fill(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
    p.circle(pos[i][0], pos[i][1], 2 * rad);
    p.noStroke();
    p.fill(...alpha(fg, 235));
    p.textAlign(p.CENTER, p.CENTER);
    p.text(s, pos[i][0], pos[i][1] - (occ ? fs * 0.5 : 0));
    if (occ) p.text(`×${occ}`, pos[i][0], pos[i][1] + fs * 0.6);
  });
}

/**
 * Simulated time runs evenly, at the rate that shows the run's visible changes (messages, marks,
 * state bands) at its calm pace: a run of many changes is slowed until they read at most at the
 * ceiling. The old slider's top replayed a run in about 75 frames; the pace never asks more.
 */
function pacerFor(changes: number): Pacer {
  const pacer = new Pacer('replay', 'changes', Math.max(1, changes / 75));
  pacer.start(changes);
  return pacer;
}

/** Simulated ms one frame advances: the changes it shows, spread evenly over the run. */
const msPerFrame = (pacer: Pacer, params: Params, horizon: number, changes: number) =>
  (pacer.perFrame(params) * horizon) / Math.max(1, changes);

function plate(info: KernelInfo, kernel: SystemsKernel): PlateCode {
  const params: ParamDef[] = [
    ...(kernel.network ? NET_PARAMS : []),
    ...(kernel.params ?? []),
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New run when done', value: true },
    paletteParam('spectral'),
  ];
  return {
    id: info.id,
    mode: '2d',
    aspect: 3 / 2,
    thumbnailFrames: 2,
    params,
    pace: { kind: 'replay', unit: 'changes' },
    create(p, ctx) {
      let generation = 0;
      const build = () => new Replay(simulate(kernel, ctx.params as Params, ctx.seed + generation * 7919), kernel);
      let r = build();
      let pacer = pacerFor(r.changes);
      let hold = 0;
      return {
        setup() {
          if (ctx.thumbnail) r.advanceTo(r.horizon * 0.7);
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            if (!r.done) r.advanceTo(r.t + msPerFrame(pacer, ctx.params, r.horizon, r.changes));
            else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              r = build();
              pacer = pacerFor(r.changes);
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.round(Math.min(W, H) * 0.04);
          const side = kernel.machine && W >= 520 ? Math.round(W * 0.28) : 0;
          drawLanes(p, ctx, r, pad, pad, W - 2 * pad - side, H - 2 * pad, false);
          if (side) drawMachine(p, ctx, r, W - pad - side, pad, side, H - 2 * pad);
          if (kernel.chart) {
            ctx.chart({
              title: kernel.chart.title,
              x: { label: 'simulated time (ms)' },
              y: { label: kernel.chart.y },
              series: r.chartSeries(),
            });
          }
          ctx.stats([...readouts(r), pacer.row(ctx.params)]);
        },
        pace: () => pacer.report(r.done, ctx.params),
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: SystemsKernel }[]): PlateCode {
  const params: ParamDef[] = [
    ...NET_PARAMS,
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New run when done', value: true },
    paletteParam('spectral'),
  ];
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params,
    pace: { kind: 'replay', unit: 'changes' },
    create(p, ctx) {
      let generation = 0;
      let panes: { info: KernelInfo; r: Replay; sent: [number, number][] }[] = [];
      let hold = 0;
      // every pane's simulated clock runs alike, at the rate the busiest run needs
      let pacer = pacerFor(0);
      let span = 1;
      let most = 1;
      const build = () => {
        panes = kernels.map(({ info, kernel }) => {
          // every kernel runs on the same network controls and seed, with its own defaults
          const shared: Params = { delay: ctx.params.delay, loss: ctx.params.loss, partition: ctx.params.partition };
          const run = simulate(kernel, defaultParams(kernel, shared), ctx.seed + generation * 7919);
          const r = new Replay(run, kernel);
          const step = run.span / 120;
          const sent: [number, number][] = [];
          let n = 0; let next = step;
          for (const m of r.msgs) {
            while (m.t0 > next) { sent.push([next, n]); next += step; }
            n++;
          }
          while (next <= run.span + 1e-9) { sent.push([next, n]); next += step; }
          return { info, r, sent };
        });
        // the busiest run, in changes per simulated ms, sets the clock; the lab lasts as long as
        // its longest run at that clock
        const busiest = panes.reduce((a, b) => (b.r.changes / b.r.horizon > a.r.changes / a.r.horizon ? b : a));
        span = Math.max(...panes.map((x) => x.r.horizon));
        most = Math.round((busiest.r.changes / busiest.r.horizon) * span);
        pacer = pacerFor(most);
      };
      build();
      return {
        setup() {
          if (ctx.thumbnail) for (const x of panes) x.r.advanceTo(x.r.horizon * 0.7);
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            const dt = msPerFrame(pacer, ctx.params, span, most);
            for (const x of panes) if (!x.r.done) x.r.advanceTo(x.r.t + dt);
            if (panes.every((x) => x.r.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build();
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
          const m = panes.length;
          const cols = W >= 640 ? 2 : 1;
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (H - pad * (rows + 1)) / rows;
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.08)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(pane.info.title, x, y);
            drawLanes(p, ctx, pane.r, x, y + fs + 4, cw, ch - fs - 4, true);
          });
          ctx.chart({
            title: 'Messages sent so far',
            x: { label: 'simulated time (ms)' },
            y: { label: 'messages' },
            series: panes.map((x) => ({ name: x.info.title, points: x.sent.filter((q) => q[0] <= x.r.t) })),
          });
          ctx.stats(panes.map((x) => {
            const r = x.r;
            const verdict = r.done && r.kernel.verdict ? ` · ${r.verdict()}` : '';
            return {
              label: x.info.title,
              value: `${fmt(r.count('net.sent'))} sent · ${fmt(r.count('net.dropped'))} dropped${verdict}`,
            };
          }).concat([pacer.row(ctx.params)]));
        },
        pace: () => pacer.report(panes.every((x) => x.r.done), ctx.params),
      };
    },
  };
}

export const engine: Engine<SystemsKernel> = { id: 'systems', plate, lab };
