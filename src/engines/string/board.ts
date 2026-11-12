// The replayed board of a string kernel: rows of cells, tables, lists of chips, marks and links,
// rebuilt event by event from the trace, and drawn only through the plate's context.
import type p5 from 'p5';
import { ramp, type RGB } from '../../core/palette';
import type { PlateContext } from '../../core/plate';
import { OP, S, type Ev, type PartKind, type Trace } from './trace';

interface Part {
  kind: PartKind;
  label: string;
  cells: string[];
  states: number[];
  heat: number[];
  rows: number;
  cols: number;
  rowHead?: string[];
  colHead?: string[];
  offset: number;
  align: number;
  w: number;
  lines: number;
  /**
   * Cells given a state since the last clear, so a clear walks only those; null after an edit
   * that moves cells (splice, swap), when the next clear walks the whole part.
   */
  dirty: number[] | null;
}

/**
 * What a replay counts as one step: a costed event (`cost`), a counter tick only (`tick`, a lab's
 * fair unit), or a note (`note`: the kernel's narrative steps, for a run whose costed events are
 * too many to watch one at a time).
 */
export type StepUnit = 'cost' | 'tick' | 'note';

/** Events that cost a step of the plate's pace; marks, links and readouts are free. */
const COST = new Set<number>([OP.tick, OP.note, OP.offset, OP.push, OP.pop, OP.splice, OP.swap,
  OP.swapRows, OP.set]);

const counts = (unit: StepUnit, o: number) => (unit === 'tick' ? o === OP.tick : unit === 'note' ? o === OP.note : COST.has(o));

export class Board {
  parts: Part[] = [];
  links: { a: number; i: number; b: number; j: number; s: number }[] = [];
  note = '';
  stats = new Map<string, string>();
  plots = new Map<string, [number, number][]>();
  counts: number[];
  at = 0;
  /** Last touched position per scrolling track (keyed by the anchor part). */
  focus = new Map<number, number>();
  /** [event, ...counts] about every 1/120 of the run, for the default chart. */
  history: number[][];
  private every: number;
  constructor(readonly t: Trace) {
    this.counts = t.counters.map(() => 0);
    this.history = [[0, ...this.counts]];
    this.every = Math.max(1, Math.floor(t.events.length / 120));
  }
  get done(): boolean { return this.at >= this.t.events.length; }
  /** Steps of `unit` in the whole run: the length the plate paces. */
  steps(unit: StepUnit = 'cost'): number {
    const ev = this.t.events;
    const e: Ev = { o: 0, p: 0, i: 0, j: 0, v: 0 };
    let n = 0;
    for (let k = 0; k < ev.length; k++) {
      ev.get(k, e);
      if (counts(unit, e.o)) n++;
    }
    return n;
  }
  /** The replay's read cursor into the event log. */
  private cur: Ev = { o: 0, p: 0, i: 0, j: 0, v: 0 };
  /**
   * Replay events until `budget` steps of `unit` have passed, and at most `cap` events in all:
   * marks and readouts cost no step of the pace, but they are work.
   */
  advance(budget: number, unit: StepUnit = 'cost', cap = Infinity): void {
    const ev = this.t.events;
    let left = budget;
    const end = Math.min(ev.length, this.at + cap);
    while (this.at < end && left > 0) {
      const e = ev.get(this.at++, this.cur);
      this.apply(e);
      if (counts(unit, e.o)) left--;
      if (this.at % this.every === 0 || this.at === ev.length) this.history.push([this.at, ...this.counts]);
    }
  }
  /** Replay a fraction of the run at once (thumbnails). */
  seek(frac: number): void {
    const end = Math.floor(this.t.events.length * frac);
    while (this.at < end) this.apply(this.t.events.get(this.at++, this.cur));
  }
  private anchor(p: number): number {
    const a = this.parts[p]?.align ?? -1;
    return a >= 0 ? a : p;
  }
  private touch(p: number, i: number): void {
    const q = this.parts[p];
    if (!q) return;
    if (q.kind === 'row') this.focus.set(this.anchor(p), i + q.offset);
    else if (q.kind === 'table') this.focus.set(p, i);
  }
  private apply(e: Ev): void {
    const q = this.parts[e.p];
    switch (e.o) {
      case OP.tick: this.counts[e.i] += e.v; break;
      case OP.part: {
        const meta = JSON.parse(e.s ?? '{}') as { kind: PartKind; label: string; rowHead?: string[]; colHead?: string[] };
        const cells = meta.kind === 'table' ? new Array<string>(e.i * e.j).fill('') : (e.ss ?? []).slice();
        this.parts[e.p] = {
          kind: meta.kind, label: meta.label, cells, states: cells.map(() => 0), heat: cells.map(() => NaN),
          rows: meta.kind === 'table' ? e.i : 1, cols: meta.kind === 'table' ? e.j : cells.length,
          rowHead: meta.rowHead, colHead: meta.colHead, offset: 0,
          align: meta.kind === 'row' || meta.kind === 'heat' ? e.i : -1,
          w: meta.kind === 'row' ? e.j : 1, lines: meta.kind === 'list' ? e.i : 1, dirty: [],
        };
        this.links = this.links.filter((l) => l.a !== e.p && l.b !== e.p);
        break;
      }
      case OP.set: if (q) { q.cells[e.i] = e.s ?? ''; this.touch(e.p, e.i); } break;
      case OP.mark: if (q && e.i < q.states.length) {
        q.states[e.i] = e.j;
        if (e.j) { q.dirty?.push(e.i); this.touch(e.p, e.i); }
      } break;
      case OP.clear: if (q) {
        if (e.i || !q.dirty) for (let k = 0; k < q.states.length; k++) { if (e.i || q.states[k] !== S.done) q.states[k] = 0; }
        else for (const k of q.dirty) if (k < q.states.length && q.states[k] !== S.done) q.states[k] = 0;
        q.dirty = [];
      } break;
      case OP.offset: if (q) { q.offset = e.i; this.focus.set(this.anchor(e.p), e.i + q.cells.length - 1); } break;
      case OP.heat: if (q) { q.heat[e.i] = e.v; this.touch(e.p, e.i); } break;
      case OP.push: if (q) {
        q.cells.push(e.s ?? ''); q.states.push(e.i); q.heat.push(NaN);
        if (e.i) q.dirty?.push(q.states.length - 1);
      } break;
      case OP.pop: if (q) { q.cells.pop(); q.states.pop(); q.heat.pop(); } break;
      case OP.splice: if (q) {
        const items = e.ss ?? [];
        q.cells.splice(e.i, e.j, ...items);
        q.states.splice(e.i, e.j, ...items.map(() => 0));
        q.heat.splice(e.i, e.j, ...items.map(() => NaN));
        q.dirty = null;
        this.touch(e.p, e.i);
      } break;
      case OP.swap: if (q) {
        for (const arr of [q.cells, q.states, q.heat] as unknown[][]) { const t = arr[e.i]; arr[e.i] = arr[e.j]; arr[e.j] = t; }
        q.dirty = null;
      } break;
      case OP.swapRows: if (q) {
        for (let c = 0; c < q.cols; c++) {
          const a = e.i * q.cols + c; const b = e.j * q.cols + c;
          for (const arr of [q.cells, q.states, q.heat] as unknown[][]) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; }
        }
        if (q.rowHead) { const h = q.rowHead.slice(); [h[e.i], h[e.j]] = [h[e.j], h[e.i]]; q.rowHead = h; }
        q.dirty = null;
      } break;
      case OP.link: this.links.push({ a: e.p, i: e.i, b: e.v, j: e.j, s: Number(e.s) }); break;
      case OP.unlink: this.links = []; break;
      case OP.note: this.note = e.s ?? ''; break;
      case OP.stat: this.stats.set(e.s ?? '', e.ss?.[0] ?? ''); break;
      case OP.plot: {
        const k = e.s ?? '';
        let pts = this.plots.get(k);
        if (!pts) { pts = []; this.plots.set(k, pts); }
        pts.push([e.v, Number(e.ss?.[0])]);
        break;
      }
    }
  }
}

const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Draw the board in the rectangle (x, y, w, h). */
export function drawBoard(p: p5, ctx: PlateContext, b: Board, x: number, y: number, w: number, h: number,
  center = false): void {
  const pal = ctx.palette();
  const fg = ctx.fg; const bg = ctx.bg;
  const fillOf = (s: number, heat: number): RGB | null => {
    if (s === S.hit) return ramp(pal, 0.72);
    if (s === S.miss) return ramp(pal, 0.04);
    if (s === S.done) return ramp(pal, 0.9);
    if (s === S.alt) return ramp(pal, 0.4);
    if (Number.isFinite(heat)) return ramp(pal, heat);
    return null;
  };
  const ink = (c: RGB | null): RGB => {
    if (!c) return fg;
    return Math.abs(lum(c) - lum(fg)) > Math.abs(lum(c) - lum(bg)) ? fg : bg;
  };
  const parts = b.parts.filter(Boolean);
  if (!parts.length) return;
  const units = parts.reduce((s, q) => s + (q.kind === 'table' ? q.rows + (q.colHead ? 1 : 0)
    : q.kind === 'list' ? q.lines : q.kind === 'heat' ? 1.4 : 1) + 0.35, 0) + (b.note ? 1.2 : 0);
  const u = Math.max(5, Math.min(32, h / units));
  if (center && units * u < h) { y += (h - units * u) / 2; h = units * u; }
  const hasLabel = parts.some((q) => q.label);
  const gw = hasLabel ? Math.min(w * 0.2, 118) : 0;
  const lfs = Math.max(8, Math.min(12, u * 0.5));
  const pos = new Map<string, [number, number]>();
  p.textFont('monospace');
  let cy = y;
  const cellBox = (cx: number, top: number, cw: number, chh: number, text: string, s: number, heat: number) => {
    const f = fillOf(s, heat);
    p.noStroke();
    if (f) p.fill(f[0], f[1], f[2]);
    else p.fill(fg[0], fg[1], fg[2], s === S.dim ? 6 : 16);
    if (s === S.focus) { p.stroke(fg[0], fg[1], fg[2]); p.strokeWeight(2); }
    p.rect(cx + 0.5, top + 0.5, Math.max(1, cw - 1), Math.max(1, chh - 1), Math.min(3, cw * 0.15));
    p.noStroke();
    if (text && cw >= 7 && chh >= 7) {
      const c = ink(f);
      p.fill(c[0], c[1], c[2], s === S.dim ? 110 : 255);
      p.textSize(Math.max(6, Math.min(chh * 0.62, (cw * 1.55) / Math.max(1, text.length))));
      p.text(text, cx + cw / 2, top + chh / 2 + 0.5);
    }
  };
  // scrolling tracks: rows aligned to one anchor scroll together
  const index = new Map(b.parts.map((q, k) => [q, k]));
  const trackLen = new Map<number, number>();
  const trackW = new Map<number, number>();
  b.parts.forEach((q, k) => {
    if (!q || q.kind !== 'row') return;
    const a = q.align >= 0 ? q.align : k;
    trackLen.set(a, Math.max(trackLen.get(a) ?? 0, q.offset + q.cells.length));
    trackW.set(a, Math.max(trackW.get(a) ?? 1, q.w));
  });
  for (const q of parts) {
    const k = index.get(q) as number;
    if (q.label) {
      p.noStroke();
      p.fill(fg[0], fg[1], fg[2], 190);
      p.textSize(lfs);
      p.textAlign(p.LEFT, p.CENTER);
      let lab = q.label;
      while (lab.length > 3 && p.textWidth(lab) > gw - 6) lab = lab.slice(0, -2);
      p.text(lab === q.label ? lab : `${lab}…`, x, cy + u / 2);
    }
    p.textAlign(p.CENTER, p.CENTER);
    const x0 = x + gw; const avail = w - gw;
    if (q.kind === 'row') {
      const a = q.align >= 0 ? q.align : k;
      const len = trackLen.get(a) ?? q.cells.length;
      // a row shrinks its cells to fit the width, down to a legible size, then scrolls
      const fit = Math.max(Math.min(u, 15), Math.min(u, avail / Math.max(1, len * (trackW.get(a) ?? 1))));
      const cw = fit * q.w;
      const vis = Math.max(1, Math.floor(avail / cw));
      const rh = Math.min(u, Math.max(fit, u * 0.6));
      const f = b.focus.get(a) ?? 0;
      const start = len > vis ? Math.max(0, Math.min(len - vis, f - Math.floor(vis / 2))) : 0;
      for (let i = 0; i < q.cells.length; i++) {
        const at = i + q.offset - start;
        if (at < 0 || at >= vis) continue;
        cellBox(x0 + at * cw, cy + (u - rh) / 2, cw, rh, q.cells[i], q.states[i], q.heat[i]);
        pos.set(`${k}:${i}`, [x0 + at * cw + cw / 2, cy + u / 2]);
      }
      cy += u * 1.35;
    } else if (q.kind === 'heat') {
      const n = q.cells.length;
      const hh = u * 1.4;
      const cols = Math.max(1, Math.floor(avail));
      p.noStroke();
      if (n <= cols) {
        const cw = avail / Math.max(1, n);
        for (let i = 0; i < n; i++) {
          const v = q.heat[i];
          const f = Number.isFinite(v) ? ramp(pal, v) : null;
          if (f) p.fill(f[0], f[1], f[2]); else p.fill(fg[0], fg[1], fg[2], 14);
          p.rect(x0 + i * cw, cy, Math.max(1, cw - (cw > 4 ? 1 : 0)), hh);
          if (q.states[i] === S.focus) { p.fill(fg[0], fg[1], fg[2]); p.rect(x0 + i * cw, cy + hh, Math.max(1, cw), 3); }
          pos.set(`${k}:${i}`, [x0 + (i + 0.5) * cw, cy + hh / 2]);
        }
      } else {
        for (let c = 0; c < cols; c++) {
          const lo = Math.floor((c * n) / cols); const hi = Math.max(lo + 1, Math.floor(((c + 1) * n) / cols));
          let s = 0; let m = 0; let focus = false;
          for (let i = lo; i < hi; i++) {
            if (Number.isFinite(q.heat[i])) { s += q.heat[i]; m++; }
            if (q.states[i] === S.focus) focus = true;
          }
          const f = m ? ramp(pal, s / m) : null;
          if (f) p.fill(f[0], f[1], f[2]); else p.fill(fg[0], fg[1], fg[2], 14);
          p.rect(x0 + c, cy, 1, hh);
          if (focus) { p.fill(fg[0], fg[1], fg[2]); p.rect(x0 + c - 1, cy + hh, 3, 3); }
        }
      }
      cy += hh + u * 0.35;
    } else if (q.kind === 'table') {
      p.textSize(Math.max(6, u * 0.5));
      const headW = q.rowHead ? Math.min(avail * 0.3, Math.max(u, ...q.rowHead.map((s) => p.textWidth(s) + 6))) : 0;
      const tw = avail - headW;
      const cw = Math.min(u * 1.6, tw / Math.max(1, q.cols));
      const th = u * (q.rows + (q.colHead ? 1 : 0));
      const ch = Math.min(u, th / Math.max(1, q.rows + (q.colHead ? 1 : 0)));
      let ty = cy;
      if (q.colHead) {
        p.fill(fg[0], fg[1], fg[2], 170);
        for (let c = 0; c < q.cols; c++) {
          const s = q.colHead[c] ?? '';
          if (cw >= 7) { p.textSize(Math.max(6, Math.min(ch * 0.55, (cw * 1.5) / Math.max(1, s.length)))); p.text(s, x0 + headW + c * cw + cw / 2, ty + ch / 2); }
        }
        ty += ch;
      }
      for (let r = 0; r < q.rows; r++) {
        if (q.rowHead) {
          p.noStroke();
          p.fill(fg[0], fg[1], fg[2], 170);
          p.textSize(Math.max(6, ch * 0.55));
          p.textAlign(p.RIGHT, p.CENTER);
          let s = q.rowHead[r] ?? '';
          while (s.length > 2 && p.textWidth(s) > headW - 4) s = s.slice(0, -1);
          p.text(s, x0 + headW - 4, ty + ch / 2);
          p.textAlign(p.CENTER, p.CENTER);
        }
        for (let c = 0; c < q.cols; c++) {
          const i = r * q.cols + c;
          cellBox(x0 + headW + c * cw, ty, cw, ch, q.cells[i], q.states[i], q.heat[i]);
          pos.set(`${k}:${i}`, [x0 + headW + c * cw + cw / 2, ty + ch / 2]);
        }
        ty += ch;
      }
      cy = ty + u * 0.35;
    } else {
      const chh = u * 0.86;
      p.textSize(Math.max(7, u * 0.52));
      const widths = q.cells.map((s) => Math.min(avail, p.textWidth(s) + u * 0.6));
      // fill lines from the newest item backwards, so the latest items are always visible
      const lines: number[][] = [];
      let cur: number[] = []; let cw = 0;
      for (let i = q.cells.length - 1; i >= 0; i--) {
        if (cur.length && cw + widths[i] > avail) {
          lines.unshift(cur.reverse());
          cur = []; cw = 0;
          if (lines.length >= q.lines) break;
        }
        cur.push(i); cw += widths[i] + 3;
      }
      if (cur.length && lines.length < q.lines) lines.unshift(cur.reverse());
      lines.forEach((ln, li) => {
        let lx = x0;
        const ly = cy + li * u;
        for (const i of ln) {
          const s = q.states[i];
          const f = fillOf(s, q.heat[i]);
          p.noStroke();
          if (f) p.fill(f[0], f[1], f[2]); else p.fill(fg[0], fg[1], fg[2], s === S.dim ? 6 : 20);
          if (s === S.focus) { p.stroke(fg[0], fg[1], fg[2]); p.strokeWeight(2); }
          p.rect(lx, ly, widths[i], chh, 4);
          p.noStroke();
          const c = ink(f);
          p.fill(c[0], c[1], c[2], s === S.dim ? 110 : 255);
          let t = q.cells[i];
          while (t.length > 2 && p.textWidth(t) > widths[i] - u * 0.4) t = t.slice(0, -1);
          p.text(t, lx + widths[i] / 2, ly + chh / 2 + 0.5);
          pos.set(`${k}:${i}`, [lx + widths[i] / 2, ly + chh / 2]);
          lx += widths[i] + 3;
        }
      });
      cy += q.lines * u + u * 0.35;
    }
  }
  for (const l of b.links) {
    const a = pos.get(`${l.a}:${l.i}`); const c = pos.get(`${l.b}:${l.j}`);
    if (!a || !c) continue;
    const f = fillOf(l.s, NaN) ?? fg;
    p.stroke(f[0], f[1], f[2], 210);
    p.strokeWeight(1.5);
    p.line(a[0], a[1] + (a[1] < c[1] ? u * 0.4 : -u * 0.4), c[0], c[1] + (a[1] < c[1] ? -u * 0.4 : u * 0.4));
  }
  p.noStroke();
  if (b.note) {
    p.fill(fg[0], fg[1], fg[2], 210);
    p.textSize(Math.max(9, Math.min(13, u * 0.55)));
    p.textAlign(p.LEFT, p.CENTER);
    let s = b.note;
    while (s.length > 4 && p.textWidth(s) > w) s = s.slice(0, -2);
    p.text(s === b.note ? s : `${s}…`, x, Math.min(y + h - u * 0.5, cy + u * 0.5));
  }
}
