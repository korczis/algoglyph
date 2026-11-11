// Drawing a recorded frame: panels laid out in the given box, each a histogram, a plot or a set
// of bars. Colours come only from the context's palette and grounds.
import type p5 from 'p5';
import { ramp, type RGB } from '../../core/palette';
import type { PlateContext } from '../../core/plate';
import { FG, type Bars, type Hist, type Mark, type Panel, type Plot } from './trace';

interface Box { x: number; y: number; w: number; h: number }

function colour(ctx: PlateContext, tone: number | undefined): RGB {
  return tone === undefined || tone === FG ? ctx.fg : ramp(ctx.palette(), tone);
}

/** Panels side by side; three as one large and two stacked; four in a grid. */
export function layout(n: number, b: Box, gap: number): Box[] {
  if (n <= 1) return [b];
  const wide = b.w >= b.h * 1.1;
  if (n === 2) {
    return wide
      ? [{ ...b, w: (b.w - gap) / 2 }, { ...b, x: b.x + (b.w + gap) / 2, w: (b.w - gap) / 2 }]
      : [{ ...b, h: (b.h - gap) / 2 }, { ...b, y: b.y + (b.h + gap) / 2, h: (b.h - gap) / 2 }];
  }
  if (n === 3) {
    const half = (b.w - gap) / 2;
    const hh = (b.h - gap) / 2;
    return [
      { ...b, w: half },
      { x: b.x + half + gap, y: b.y, w: half, h: hh },
      { x: b.x + half + gap, y: b.y + hh + gap, w: half, h: hh },
    ];
  }
  const cols = 2;
  const rows = Math.ceil(n / cols);
  const cw = (b.w - gap) / cols;
  const ch = (b.h - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: b.x + (i % cols) * (cw + gap), y: b.y + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
}

export function drawPanels(p: p5, ctx: PlateContext, panels: Panel[], b: Box): void {
  const gap = Math.max(8, Math.round(Math.min(b.w, b.h) * 0.04));
  layout(panels.length, b, gap).forEach((box, i) => drawPanel(p, ctx, panels[i], box));
}

const tick = (v: number) => {
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 1e5)) return v.toExponential(1);
  return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
};

/** The panel's frame: title, plot area and the x/y extremes; returns the plot area. */
function frame(p: p5, ctx: PlateContext, title: string, b: Box, xr: [number, number] | null,
  yr: [number, number] | null, left = 0): Box & { fs: number } {
  const fs = Math.max(9, Math.min(13, Math.round(b.h * 0.06)));
  p.textSize(fs);
  p.noStroke();
  p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
  p.textAlign(p.LEFT, p.TOP);
  p.text(title, b.x, b.y);
  const ax = b.x + Math.max(left, yr ? fs * 2.6 : 0);
  const ay = b.y + fs + 6;
  const aw = b.x + b.w - ax;
  const ah = b.h - (fs + 6) - (xr ? fs + 4 : 0);
  p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 70);
  p.strokeWeight(1);
  p.line(ax, ay + ah, ax + aw, ay + ah);
  if (yr) p.line(ax, ay, ax, ay + ah);
  p.noStroke();
  p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 150);
  p.textSize(Math.max(8, fs - 2));
  if (xr) {
    p.textAlign(p.LEFT, p.TOP);
    p.text(tick(xr[0]), ax, ay + ah + 2);
    p.textAlign(p.RIGHT, p.TOP);
    p.text(tick(xr[1]), ax + aw, ay + ah + 2);
  }
  if (yr) {
    p.textAlign(p.RIGHT, p.TOP);
    p.text(tick(yr[1]), ax - 3, ay);
    p.textAlign(p.RIGHT, p.BOTTOM);
    p.text(tick(yr[0]), ax - 3, ay + ah);
  }
  return { x: ax, y: ay, w: Math.max(1, aw), h: Math.max(1, ah), fs };
}

function marks(p: p5, ctx: PlateContext, ms: Mark[] | undefined, a: Box & { fs: number },
  X: (v: number) => number, Y: (v: number) => number) {
  if (!ms) return;
  p.textSize(Math.max(8, a.fs - 2));
  for (const m of ms) {
    const c = colour(ctx, m.tone);
    p.stroke(c[0], c[1], c[2], 220);
    p.strokeWeight(m.dash ? 1 : 1.5);
    if (m.x !== undefined && Number.isFinite(m.x)) {
      const x = Math.max(a.x, Math.min(a.x + a.w, X(m.x)));
      if (m.dash) for (let y = a.y; y < a.y + a.h; y += 6) p.line(x, y, x, Math.min(y + 3, a.y + a.h));
      else p.line(x, a.y, x, a.y + a.h);
      if (m.label) {
        p.noStroke();
        p.fill(c[0], c[1], c[2]);
        p.textAlign(x > a.x + a.w * 0.7 ? p.RIGHT : p.LEFT, p.TOP);
        p.text(m.label, x + (x > a.x + a.w * 0.7 ? -3 : 3), a.y + 2);
      }
    }
    if (m.y !== undefined && Number.isFinite(m.y)) {
      const y = Math.max(a.y, Math.min(a.y + a.h, Y(m.y)));
      if (m.dash) for (let x = a.x; x < a.x + a.w; x += 6) p.line(x, y, Math.min(x + 3, a.x + a.w), y);
      else p.line(a.x, y, a.x + a.w, y);
      if (m.label) {
        p.noStroke();
        p.fill(c[0], c[1], c[2]);
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text(m.label, a.x + a.w - 2, y - 2);
      }
    }
  }
}

function drawHist(p: p5, ctx: PlateContext, h: Hist, b: Box) {
  const total = h.bins.reduce((s, c) => s + c, 0);
  const oTotal = h.overlay ? h.overlay.bins.reduce((s, c) => s + c, 0) : 0;
  const k = h.bins.length;
  const bw = (h.hi - h.lo) / k;
  const val = (c: number, t: number) => (h.normalise ? (t ? c / t : 0) : c);
  let top = 0;
  for (const c of h.bins) top = Math.max(top, val(c, total));
  if (h.overlay) for (const c of h.overlay.bins) top = Math.max(top, val(c, oTotal));
  const dens = h.density?.map(([x, d]) => [x, h.normalise ? d * bw : d * total * bw] as [number, number]);
  if (dens) for (const [, d] of dens) top = Math.max(top, d);
  top = top || 1;
  const a = frame(p, ctx, h.title, b, [h.lo, h.hi], null);
  const X = (v: number) => a.x + ((v - h.lo) / (h.hi - h.lo)) * a.w;
  const Y = (v: number) => a.y + a.h - (v / top) * a.h * 0.94;
  if (h.shade) {
    p.noStroke();
    p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 24);
    const x0 = Math.max(a.x, X(h.shade[0]));
    const x1 = Math.min(a.x + a.w, X(h.shade[1]));
    if (x1 > x0) p.rect(x0, a.y, x1 - x0, a.h);
  }
  p.noStroke();
  const pw = a.w / k;
  for (let i = 0; i < k; i++) {
    const v = val(h.bins[i], total);
    if (!v) continue;
    // one tone when given, otherwise the palette along the x-axis
    const col = colour(ctx, h.tone ?? 0.15 + 0.7 * (i / Math.max(1, k - 1)));
    p.fill(col[0], col[1], col[2], 210);
    p.rect(a.x + i * pw, Y(v), Math.max(1, pw - (pw > 4 ? 1 : 0)), a.y + a.h - Y(v));
  }
  if (h.overlay) {
    const o = colour(ctx, h.overlay.tone);
    p.stroke(o[0], o[1], o[2]);
    p.strokeWeight(2);
    p.noFill();
    p.beginShape();
    p.vertex(a.x, a.y + a.h);
    for (let i = 0; i < k; i++) {
      const y = Y(val(h.overlay.bins[i], oTotal));
      p.vertex(a.x + i * pw, y);
      p.vertex(a.x + (i + 1) * pw, y);
    }
    p.vertex(a.x + a.w, a.y + a.h);
    p.endShape();
  }
  if (dens) {
    p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 200);
    p.strokeWeight(1.5);
    p.noFill();
    p.beginShape();
    for (const [x, d] of dens) if (x >= h.lo && x <= h.hi) p.vertex(X(x), Y(d));
    p.endShape();
  }
  marks(p, ctx, h.marks, a, X, (v) => v);
}

function drawPlot(p: p5, ctx: PlateContext, q: Plot, b: Box) {
  const a = frame(p, ctx, q.title, b, q.x, q.y);
  const sx = q.x[1] - q.x[0] || 1;
  const sy = q.y[1] - q.y[0] || 1;
  const X = (v: number) => a.x + ((v - q.x[0]) / sx) * a.w;
  const Y = (v: number) => a.y + a.h - ((v - q.y[0]) / sy) * a.h;
  const pal = ctx.palette();
  if (q.field) {
    const { w, h, values } = q.field;
    const cw = a.w / w;
    const ch = a.h / h;
    p.noStroke();
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = ramp(pal, values[j * w + i]);
        p.fill(c[0], c[1], c[2], 150);
        p.rect(a.x + i * cw, a.y + a.h - (j + 1) * ch, cw + 0.6, ch + 0.6);
      }
    }
  }
  if (q.band && q.band.pts.length > 1) {
    const c = colour(ctx, q.band.tone ?? 0.5);
    p.noStroke();
    p.fill(c[0], c[1], c[2], 60);
    p.beginShape();
    for (const [x, lo] of q.band.pts) p.vertex(X(x), Y(Math.max(q.y[0], lo)));
    for (let i = q.band.pts.length - 1; i >= 0; i--) {
      const [x, , hi] = q.band.pts[i];
      p.vertex(X(x), Y(Math.min(q.y[1], hi)));
    }
    p.endShape(p.CLOSE);
  }
  for (const l of q.lines ?? []) {
    const c = colour(ctx, l.tone);
    p.stroke(c[0], c[1], c[2], 255 * (l.alpha ?? 1));
    p.strokeWeight(l.weight ?? 1.5);
    p.noFill();
    if (l.dash) {
      for (let i = 1; i < l.pts.length; i += 2) p.line(X(l.pts[i - 1][0]), Y(l.pts[i - 1][1]), X(l.pts[i][0]), Y(l.pts[i][1]));
    } else {
      p.beginShape();
      for (const [x, y] of l.pts) p.vertex(X(x), Y(y));
      p.endShape();
    }
  }
  for (const d of q.dots ?? []) {
    const r = d.size ?? Math.max(2, Math.min(a.w, a.h) * 0.012);
    p.noStroke();
    d.pts.forEach(([x, y], i) => {
      const c = colour(ctx, d.tones ? d.tones[i] : d.tone);
      p.fill(c[0], c[1], c[2], 255 * (d.alpha ?? 0.9));
      p.circle(X(x), Y(y), r * 2);
    });
  }
  marks(p, ctx, q.marks, a, X, Y);
}

function drawBars(p: p5, ctx: PlateContext, q: Bars, b: Box) {
  const fs = Math.max(9, Math.min(13, Math.round(b.h * 0.06)));
  p.textSize(Math.max(8, fs - 1));
  const labelW = Math.min(b.w * 0.35, Math.max(...q.rows.map((r) => p.textWidth(r.label)), 0) + 8);
  const a = frame(p, ctx, q.title, b, q.x, null, labelW);
  const s = q.x[1] - q.x[0] || 1;
  const X = (v: number) => a.x + ((Math.max(q.x[0], Math.min(q.x[1], v)) - q.x[0]) / s) * a.w;
  const n = Math.max(1, q.rows.length);
  const rh = a.h / n;
  if (q.x[0] < 0 && q.x[1] > 0) {
    p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 90);
    p.line(X(0), a.y, X(0), a.y + a.h);
  }
  q.rows.forEach((r, i) => {
    const y = a.y + i * rh;
    const c = colour(ctx, r.tone ?? 0.6);
    p.noStroke();
    p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
    p.textSize(Math.max(8, fs - 1));
    p.textAlign(p.RIGHT, p.CENTER);
    p.text(r.label, a.x - 4, y + rh / 2);
    p.fill(c[0], c[1], c[2], 220);
    const x0 = X(Math.min(r.lo, r.hi));
    const x1 = X(Math.max(r.lo, r.hi));
    p.rect(x0, y + rh * 0.18, Math.max(1, x1 - x0), rh * 0.64);
    if (r.err) {
      p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 200);
      p.strokeWeight(1);
      p.line(X(r.err[0]), y + rh / 2, X(r.err[1]), y + rh / 2);
    }
    if (r.mark !== undefined && Number.isFinite(r.mark)) {
      p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
      p.strokeWeight(2);
      p.line(X(r.mark), y + rh * 0.05, X(r.mark), y + rh * 0.95);
    }
  });
}

export function drawPanel(p: p5, ctx: PlateContext, q: Panel, b: Box): void {
  if (q.kind === 'hist') drawHist(p, ctx, q, b);
  else if (q.kind === 'plot') drawPlot(p, ctx, q, b);
  else drawBars(p, ctx, q, b);
}
