// Drawing the signal engine's panels, only through the plate context's colours and the p5
// instance the stage made. Panels are declarative (trace.ts); this module is the only place
// they become pixels.
import type p5 from 'p5';
import { ramp, type RGB } from '../../core/palette';
import type { PlateContext } from '../../core/plate';
import { Raster } from '../../core/raster';
import type { ButterflyPanel, LanesPanel, Mark, Panel, PlanePanel, Series, SpectrumPanel, TextPanel,
  WaterfallPanel, WavePanel, XYPanel } from './trace';

export interface Box { x: number; y: number; w: number; h: number }

/** Layout of panels inside the canvas: explicit rows, or one to four packed by default. */
export function layout(n: number, W: number, H: number, rows?: number[][]): Box[] {
  const pad = Math.max(4, Math.round(Math.min(W, H) * 0.02));
  const grid = rows ?? (n <= 1 ? [[0]] : n === 2 ? (W / H > 1.3 ? [[0, 1]] : [[0], [1]])
    : n === 3 ? [[0], [1, 2]] : [[0, 1], [2, 3]]);
  const out: Box[] = [];
  const rh = (H - pad * (grid.length + 1)) / grid.length;
  grid.forEach((row, r) => {
    const cw = (W - pad * (row.length + 1)) / row.length;
    row.forEach((idx, c) => {
      out[idx] = { x: pad + c * (cw + pad), y: pad + r * (rh + pad), w: cw, h: rh };
    });
  });
  return out;
}

export class Painter {
  private rasters = new Map<string, Raster>();
  constructor(private p: p5, private ctx: PlateContext) {}

  private get fs(): number {
    return Math.max(8, Math.min(13, Math.round(Math.min(this.ctx.width, this.ctx.height) * 0.03)));
  }

  color(tone: number | undefined, i: number, n: number): RGB {
    if (tone === -1) return this.ctx.fg;
    const t = tone ?? (n < 2 ? 0.65 : 0.15 + (0.8 * i) / (n - 1));
    return ramp(this.ctx.palette(), t);
  }

  private ink(a: number): void {
    const f = this.ctx.fg;
    this.p.fill(f[0], f[1], f[2], a);
  }

  /** The frame and title of a panel; returns the plot area inside it. */
  private frame(b: Box, title: string): Box {
    const { p } = this;
    const f = this.ctx.fg;
    p.noFill();
    p.stroke(f[0], f[1], f[2], 34);
    p.strokeWeight(1);
    p.rect(b.x, b.y, b.w, b.h, 3);
    const fs = this.fs;
    if (this.ctx.thumbnail) return { x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 6 };
    p.noStroke();
    this.ink(190);
    p.textSize(fs);
    p.textAlign(p.LEFT, p.TOP);
    p.text(title, b.x + 6, b.y + 4);
    const top = fs + 8;
    return { x: b.x + 6, y: b.y + top, w: b.w - 12, h: b.h - top - fs - 6 };
  }

  private small(text: string, x: number, y: number, ax: 'left' | 'center' | 'right', ay: 'top' | 'bottom' | 'center'): void {
    if (this.ctx.thumbnail) return;
    const { p } = this;
    p.noStroke();
    this.ink(150);
    p.textSize(Math.max(8, this.fs - 2));
    p.textAlign(ax === 'left' ? p.LEFT : ax === 'center' ? p.CENTER : p.RIGHT,
      ay === 'top' ? p.TOP : ay === 'bottom' ? p.BOTTOM : p.CENTER);
    p.text(text, x, y);
  }

  draw(panel: Panel, b: Box): void {
    switch (panel.kind) {
      case 'wave': return this.wave(panel, b);
      case 'lanes': return this.lanes(panel, b);
      case 'spectrum': return this.spectrum(panel, b);
      case 'waterfall': return this.waterfall(panel, b);
      case 'plane': return this.plane(panel, b);
      case 'xy': return this.xy(panel, b);
      case 'butterfly': return this.butterfly(panel, b);
      case 'text': return this.text(panel, b);
    }
  }

  /** One curve over index, min/max per pixel column when it is denser than the plot. */
  private curve(s: Series, a: Box, lo: number, hi: number, upto: number, c: RGB, total: number): void {
    const { p } = this;
    const n = Math.min(upto, s.y.length);
    if (n < 1) return;
    const X = (i: number) => a.x + (total > 1 ? (i / (total - 1)) * a.w : a.w / 2);
    const Y = (v: number) => a.y + a.h - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * a.h;
    p.stroke(c[0], c[1], c[2], s.alpha ?? 235);
    p.strokeWeight(1.4);
    p.noFill();
    if (s.stems && total <= a.w * 1.5) {
      const base = Y(Math.min(hi, Math.max(lo, 0)));
      for (let i = 0; i < n; i++) p.line(X(i), base, X(i), Y(s.y[i]));
      return;
    }
    if (total <= a.w * 1.5) {
      p.beginShape();
      for (let i = 0; i < n; i++) p.vertex(X(i), Y(s.y[i]));
      p.endShape();
      return;
    }
    const cols = Math.max(1, Math.floor(a.w));
    let prev: [number, number] | null = null;
    for (let col = 0; col < cols; col++) {
      const i0 = Math.floor((col / cols) * total);
      const i1 = Math.min(n, Math.floor(((col + 1) / cols) * total));
      if (i0 >= n) break;
      let mn = Infinity; let mx = -Infinity;
      for (let i = i0; i < Math.max(i1, i0 + 1); i++) { const v = s.y[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const x = a.x + col + 0.5;
      p.line(x, Y(mn), x, Y(mx));
      if (prev) p.line(prev[0], prev[1], x, Y(s.y[i0]));
      prev = [x, Y(s.y[Math.max(i0, i1 - 1)])];
    }
  }

  private marks(marks: Mark[] | undefined, a: Box, X: (v: number) => number): void {
    if (!marks) return;
    const { p } = this;
    const f = this.ctx.fg;
    marks.forEach((m, i) => {
      const x = X(m.at);
      if (x < a.x - 1 || x > a.x + a.w + 1) return;
      p.stroke(f[0], f[1], f[2], 90);
      p.strokeWeight(1);
      (p.drawingContext as CanvasRenderingContext2D).setLineDash([3, 3]);
      p.line(x, a.y, x, a.y + a.h);
      (p.drawingContext as CanvasRenderingContext2D).setLineDash([]);
      if (m.label) this.small(m.label, x + 3, a.y + 2 + (i % 2) * (this.fs + 1), 'left', 'top');
    });
  }

  private range(series: Series[], upto: number): [number, number] {
    let lo = Infinity; let hi = -Infinity;
    for (const s of series) {
      for (let i = 0; i < Math.min(upto, s.y.length); i++) {
        const v = s.y[i];
        if (!Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!Number.isFinite(lo)) return [-1, 1];
    if (hi - lo < 1e-12) return [lo - 1, hi + 1];
    const m = (hi - lo) * 0.06;
    return [lo - m, hi + m];
  }

  private wave(w: WavePanel, b: Box): void {
    const a = this.frame(b, w.title);
    const total = Math.max(...w.series.map((s) => s.y.length));
    const upto = w.upto ?? total;
    const [lo, hi] = w.range ?? this.range(w.series, total);
    const { p } = this;
    const f = this.ctx.fg;
    if (lo < 0 && hi > 0) {
      const y0 = a.y + a.h - ((0 - lo) / (hi - lo)) * a.h;
      p.stroke(f[0], f[1], f[2], 40);
      p.line(a.x, y0, a.x + a.w, y0);
    }
    w.series.forEach((s, i) => this.curve(s, a, lo, hi, upto, this.color(s.tone, i, w.series.length), total));
    this.marks(w.marks, a, (v) => a.x + (v / Math.max(1, total - 1)) * a.w);
    if (upto < total) {
      const x = a.x + (upto / Math.max(1, total - 1)) * a.w;
      p.stroke(f[0], f[1], f[2], 120);
      p.line(x, a.y, x, a.y + a.h);
    }
    this.legend(w.series, a);
  }

  private legend(series: Series[], a: Box): void {
    if (series.length < 2 || this.ctx.thumbnail) return;
    const { p } = this;
    const fs = Math.max(8, this.fs - 2);
    p.textSize(fs);
    let x = a.x + a.w;
    for (let i = series.length - 1; i >= 0; i--) {
      const s = series[i];
      const tw = p.textWidth(s.name);
      x -= tw + 16;
      const c = this.color(s.tone, i, series.length);
      p.noStroke();
      p.fill(c[0], c[1], c[2]);
      p.rect(x, a.y + a.h + 6, 8, 3);
      this.small(s.name, x + 11, a.y + a.h + 8, 'left', 'center');
    }
  }

  private lanes(l: LanesPanel, b: Box): void {
    const a = this.frame(b, l.title);
    const n = l.lanes.length;
    const gap = 4;
    const lh = (a.h - gap * (n - 1)) / Math.max(1, n);
    const total = Math.max(...l.lanes.map((s) => s.y.length));
    l.lanes.forEach((s, i) => {
      const box = { x: a.x, y: a.y + i * (lh + gap), w: a.w, h: lh };
      const [lo, hi] = this.range([s], s.y.length);
      const m = Math.max(Math.abs(lo), Math.abs(hi));
      const sym = lo < 0 ? [-m, m] as [number, number] : [lo, hi] as [number, number];
      this.curve(s, box, sym[0], sym[1], l.upto ?? total, this.color(s.tone, i, n), s.y.length);
      if (lh > 14) this.small(s.name, box.x + box.w, box.y + 1, 'right', 'top');
    });
    this.marks(l.marks, a, (v) => a.x + (v / Math.max(1, total - 1)) * a.w);
  }

  private spectrum(s: SpectrumPanel, b: Box): void {
    const a = this.frame(b, s.title);
    const { p } = this;
    const f = this.ctx.fg;
    const fmin = s.logx ? Math.max(1e-6, s.fmin ?? s.fmax / 1000) : 0;
    const X = (hz: number) => (s.logx
      ? a.x + ((Math.log(Math.max(hz, fmin)) - Math.log(fmin)) / (Math.log(s.fmax) - Math.log(fmin))) * a.w
      : a.x + (hz / s.fmax) * a.w);
    const Y = (d: number) => a.y + a.h - ((Math.min(s.ceil, Math.max(s.floor, d)) - s.floor) / (s.ceil - s.floor)) * a.h;
    // dB grid every 20 dB
    p.strokeWeight(1);
    for (let d = Math.ceil(s.floor / 20) * 20; d <= s.ceil; d += 20) {
      p.stroke(f[0], f[1], f[2], 22);
      p.line(a.x, Y(d), a.x + a.w, Y(d));
      this.small(`${d}`, a.x + 2, Y(d) - 1, 'left', 'bottom');
    }
    const ticks: number[] = [];
    if (s.logx) {
      for (let dec = 10 ** Math.ceil(Math.log10(fmin)); dec <= s.fmax; dec *= 10) ticks.push(dec);
    } else {
      const step = niceStep(s.fmax / 4);
      for (let t = step; t < s.fmax * 0.999; t += step) ticks.push(t);
    }
    for (const t of ticks) {
      p.stroke(f[0], f[1], f[2], 22);
      p.line(X(t), a.y, X(t), a.y + a.h);
      this.small(t >= 1000 ? `${t / 1000}k` : `${t}`, X(t), a.y + a.h + 2, 'center', 'top');
    }
    this.small('dB', a.x + a.w, a.y + 1, 'right', 'top');
    s.series.forEach((ser, si) => {
      const c = this.color(ser.tone, si, s.series.length);
      const n = ser.y.length;
      const hz = (k: number) => (s.fmax * k) / Math.max(1, n - 1);
      p.stroke(c[0], c[1], c[2], ser.alpha ?? 235);
      p.strokeWeight(ser.stems ? 2 : 1.4);
      p.noFill();
      if (ser.stems) {
        for (let k = 0; k < n; k++) {
          if (ser.y[k] <= s.floor) continue;
          if (s.logx && hz(k) < fmin) continue;
          p.line(X(hz(k)), Y(s.floor), X(hz(k)), Y(ser.y[k]));
        }
        return;
      }
      // a column-wise maximum keeps narrow peaks visible when bins outnumber pixels
      const cols = Math.max(1, Math.floor(a.w));
      const best = new Float64Array(cols).fill(-Infinity);
      for (let k = 0; k < n; k++) {
        const h = hz(k);
        if (s.logx && h < fmin) continue;
        const col = Math.min(cols - 1, Math.max(0, Math.floor(X(h) - a.x)));
        if (ser.y[k] > best[col]) best[col] = ser.y[k];
      }
      p.beginShape();
      for (let col = 0; col < cols; col++) if (best[col] > -Infinity) p.vertex(a.x + col + 0.5, Y(best[col]));
      p.endShape();
    });
    this.marks(s.marks, a, X);
    this.legend(s.series, { ...a, h: a.h + this.fs });
  }

  private waterfall(w: WaterfallPanel, b: Box): void {
    const a = this.frame(b, w.title);
    const cols = Math.max(1, w.rows.length);
    const bins = w.rows[0]?.length ?? 1;
    const rh = Math.min(bins, 160);
    const key = `${cols}x${rh}`;
    let r = this.rasters.get(key);
    if (!r) { r = new Raster(cols, rh); this.rasters.set(key, r); }
    r.fill(this.ctx.bg);
    const pal = this.ctx.palette();
    for (let c = 0; c < Math.min(w.upto, cols); c++) {
      const row = w.rows[c];
      for (let y = 0; y < rh; y++) {
        const k0 = Math.floor((y / rh) * bins);
        const k1 = Math.max(k0 + 1, Math.floor(((y + 1) / rh) * bins));
        let m = -Infinity;
        for (let k = k0; k < k1; k++) if (row[k] > m) m = row[k];
        const t = (m - w.floor) / (w.ceil - w.floor);
        const col = ramp(pal, Math.min(1, Math.max(0, t)));
        const k = Math.min(1, Math.max(0, t * 1.4));
        const bg = this.ctx.bg;
        r.set(c, rh - 1 - y, bg[0] + (col[0] - bg[0]) * k, bg[1] + (col[1] - bg[1]) * k, bg[2] + (col[2] - bg[2]) * k);
      }
    }
    r.blit(this.p, false, a.x, a.y, a.w, a.h);
    const step = niceStep(w.fmax / 4);
    for (let t = step; t < w.fmax * 0.999; t += step) {
      const y = a.y + a.h - (t / w.fmax) * a.h;
      this.small(t >= 1000 ? `${t / 1000}k` : `${t}`, a.x + 2, y, 'left', 'center');
    }
    this.small('time →', a.x + a.w, a.y + a.h + 2, 'right', 'top');
  }

  private square(a: Box, range: [number, number, number, number], equal: boolean) {
    const [x0, x1, y0, y1] = range;
    let sx = a.w / (x1 - x0 || 1);
    let sy = a.h / (y1 - y0 || 1);
    let ox = a.x; let oy = a.y;
    if (equal) {
      const s = Math.min(sx, sy);
      ox += (a.w - s * (x1 - x0)) / 2;
      oy += (a.h - s * (y1 - y0)) / 2;
      sx = s; sy = s;
    }
    return {
      X: (x: number) => ox + (x - x0) * sx,
      Y: (y: number) => oy + (y1 - y) * sy,
      s: Math.min(sx, sy),
    };
  }

  private plane(z: PlanePanel, b: Box): void {
    const a = this.frame(b, z.title);
    const lim = Math.max(1.3, ...z.poles.map(([x, y]) => Math.hypot(x, y) * 1.1), ...z.zeros.map(([x, y]) => Math.hypot(x, y) * 1.1));
    const { X, Y, s } = this.square(a, [-lim, lim, -lim, lim], true);
    const { p } = this;
    const f = this.ctx.fg;
    p.noFill();
    p.stroke(f[0], f[1], f[2], 40);
    p.strokeWeight(1);
    p.line(X(-lim), Y(0), X(lim), Y(0));
    p.line(X(0), Y(-lim), X(0), Y(lim));
    p.stroke(f[0], f[1], f[2], 140);
    p.circle(X(0), Y(0), 2 * s);
    const r = Math.max(3, s * 0.07);
    const cz = this.color(0.25, 0, 1);
    p.strokeWeight(2);
    p.stroke(cz[0], cz[1], cz[2]);
    for (const [x, y] of z.zeros) p.circle(X(x), Y(y), 2 * r);
    const cp = this.color(0.85, 0, 1);
    p.stroke(cp[0], cp[1], cp[2]);
    for (const [x, y] of z.poles) {
      p.line(X(x) - r, Y(y) - r, X(x) + r, Y(y) + r);
      p.line(X(x) - r, Y(y) + r, X(x) + r, Y(y) - r);
    }
    this.small('o zeros   x poles', a.x + a.w, a.y + a.h, 'right', 'bottom');
  }

  private xy(g: XYPanel, b: Box): void {
    const a = this.frame(b, g.title);
    const { X, Y } = this.square(a, g.range, Boolean(g.equal));
    const { p } = this;
    // data outside the range stays inside the panel
    const dc = p.drawingContext as CanvasRenderingContext2D;
    dc.save();
    dc.beginPath();
    dc.rect(a.x, a.y, a.w, a.h);
    dc.clip();
    const lines = g.lines ?? [];
    lines.forEach((l, i) => {
      const c = this.color(l.tone, i, lines.length);
      p.stroke(c[0], c[1], c[2], l.alpha ?? 230);
      p.strokeWeight(l.weight ?? 1.4);
      p.noFill();
      p.beginShape();
      for (let k = 0; k + 1 < l.pts.length; k += 2) p.vertex(X(l.pts[k]), Y(l.pts[k + 1]));
      p.endShape();
    });
    for (const d of g.dots ?? []) {
      const c = this.color(d.tone, 0, 1);
      p.noStroke();
      p.fill(c[0], c[1], c[2]);
      p.circle(X(d.x), Y(d.y), 2 * (d.r ?? 3));
    }
    for (const ar of g.arrows ?? []) {
      const c = this.color(ar.tone, 0, 1);
      p.stroke(c[0], c[1], c[2]);
      p.strokeWeight(2.2);
      const [ax, ay, bx, by] = [X(ar.x0), Y(ar.y0), X(ar.x1), Y(ar.y1)];
      p.line(ax, ay, bx, by);
      const ang = Math.atan2(by - ay, bx - ax);
      const h = 7;
      p.line(bx, by, bx - h * Math.cos(ang - 0.45), by - h * Math.sin(ang - 0.45));
      p.line(bx, by, bx - h * Math.cos(ang + 0.45), by - h * Math.sin(ang + 0.45));
    }
    for (const t of g.labels ?? []) this.small(t.text, X(t.x) + 4, Y(t.y) - 2, 'left', 'bottom');
    dc.restore();
    if (g.xLabel) this.small(g.xLabel, a.x + a.w, a.y + a.h + 2, 'right', 'top');
    if (g.yLabel) this.small(g.yLabel, a.x + 2, a.y + 1, 'left', 'top');
  }

  private butterfly(bf: ButterflyPanel, b: Box): void {
    const a = this.frame(b, bf.title);
    const { p } = this;
    const stages = Math.round(Math.log2(bf.n));
    const colX = (s: number) => a.x + 8 + (s / stages) * (a.w - 16);
    const rowY = (i: number) => a.y + 4 + ((i + 0.5) / bf.n) * (a.h - 8);
    const f = this.ctx.fg;
    // the wiring of every stage, the latest one done in colour
    for (let s = 0; s < stages; s++) {
      const half = 1 << s;
      const active = s === bf.done - 1;
      const c = this.color(0.75, 0, 1);
      p.strokeWeight(active ? 1.3 : 0.7);
      if (active) p.stroke(c[0], c[1], c[2], 220);
      else p.stroke(f[0], f[1], f[2], s < bf.done ? 60 : 22);
      for (let start = 0; start < bf.n; start += 2 * half) {
        for (let k = 0; k < half; k++) {
          const i = start + k; const j = i + half;
          p.line(colX(s), rowY(i), colX(s + 1), rowY(i));
          p.line(colX(s), rowY(j), colX(s + 1), rowY(j));
          p.line(colX(s), rowY(i), colX(s + 1), rowY(j));
          p.line(colX(s), rowY(j), colX(s + 1), rowY(i));
        }
      }
    }
    const pal = this.ctx.palette();
    p.noStroke();
    const r = Math.max(1.5, Math.min(5, (a.h / bf.n) * 0.38));
    for (let s = 0; s <= Math.min(bf.done, stages); s++) {
      const m = bf.mags[s];
      if (!m) continue;
      let mx = 0;
      for (let i = 0; i < m.length; i++) mx = Math.max(mx, m[i]);
      for (let i = 0; i < bf.n; i++) {
        const t = mx > 0 ? m[i] / mx : 0;
        const c = ramp(pal, 0.15 + 0.85 * t);
        p.fill(c[0], c[1], c[2], 90 + 165 * t);
        p.circle(colX(s), rowY(i), 2 * r * (0.5 + 0.5 * t));
      }
    }
  }

  private text(t: TextPanel, b: Box): void {
    const a = this.frame(b, t.title);
    if (this.ctx.thumbnail) return;
    const { p } = this;
    const longest = Math.max(1, ...t.lines.map((l) => l.text.length));
    const fs = Math.max(7, Math.min(this.fs, Math.floor(a.w / (longest * 0.62)), Math.floor(a.h / Math.max(1, t.lines.length) / 1.35)));
    p.textFont('monospace');
    p.textSize(fs);
    p.textAlign(p.LEFT, p.TOP);
    p.noStroke();
    t.lines.forEach((l, i) => {
      const c = l.tone === undefined ? this.ctx.fg : this.color(l.tone, 0, 1);
      p.fill(c[0], c[1], c[2], 220);
      p.text(l.text, a.x, a.y + i * fs * 1.35);
    });
    p.textFont('sans-serif');
  }
}

export function niceStep(raw: number): number {
  const e = 10 ** Math.floor(Math.log10(raw));
  const m = raw / e;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
}
