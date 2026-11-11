// The numeric engine: a kernel computes on seeded input and returns a run (panels and steps of
// layers in data coordinates, with readouts measured from the run); the plate replays the steps,
// drawing every layer through the plate context. A lab runs several kernels on the same input
// side by side and overlays the series each one measures (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, type ParamDef, type Params, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import { Raster } from '../../core/raster';
import type { Engine, KernelInfo } from '../types';
import type { Layer, NumericKernel, NumericRun, Panel, XY } from './trace';

const HOLD_FRAMES = 150;

const controls = (): ParamDef[] => [
  { kind: 'range', key: 'speed', label: 'Speed', min: 0.25, max: 8, step: 0.25, value: 1 },
  { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
];

function defaults(defs: ParamDef[] | undefined): Params {
  const out: Params = {};
  for (const d of defs ?? []) out[d.key] = d.value;
  return out;
}

interface Box { x: number; y: number; w: number; h: number }

/** Where each panel's data box lands on the canvas, with a title line above it. */
function layout(panels: Panel[], r: Box, fs: number): { box: Box; right: number; X: (v: number) => number; Y: (v: number) => number }[] {
  const gap = Math.max(8, Math.round(r.w * 0.02));
  const total = panels.reduce((s, q) => s + (q.weight ?? 1), 0);
  const free = r.w - gap * (panels.length - 1);
  let x = r.x;
  return panels.map((q) => {
    const w = (free * (q.weight ?? 1)) / total;
    let box: Box = { x, y: r.y + fs + 6, w, h: r.h - fs - 6 };
    const right = x + w;
    x += w + gap;
    const dx = q.x[1] - q.x[0] || 1;
    const dy = q.y[1] - q.y[0] || 1;
    if (q.equal) {
      const k = Math.min(box.w / dx, box.h / dy);
      box = { x: box.x + (box.w - k * dx) / 2, y: box.y + (box.h - k * dy) / 2, w: k * dx, h: k * dy };
    }
    const b = box;
    return {
      box: b,
      right,
      X: (v: number) => b.x + ((v - q.x[0]) / dx) * b.w,
      Y: (v: number) => b.y + b.h - ((v - q.y[0]) / dy) * b.h,
    };
  });
}

const rasters = new WeakMap<Layer, { r: Raster; key: string }>();

function drawRun(p: p5, ctx: PlateContext, run: NumericRun, at: number, r: Box): void {
  const pal = ctx.palette();
  const fg = ctx.fg;
  const fs = Math.max(9, Math.min(14, Math.round(Math.min(r.w, r.h) * 0.045)));
  const frames = layout(run.panels, r, fs);
  p.textSize(fs);
  run.panels.forEach((q, i) => {
    const { box, X, Y } = frames[i];
    p.noStroke();
    p.fill(fg[0], fg[1], fg[2], 200);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(fit(p, q.title, frames[i].right - box.x), box.x, box.y - 4);
    p.noFill();
    p.stroke(fg[0], fg[1], fg[2], 40);
    p.strokeWeight(1);
    p.rect(box.x, box.y, box.w, box.h);
    if (q.axes) {
      p.stroke(fg[0], fg[1], fg[2], 70);
      if (q.y[0] < 0 && q.y[1] > 0) p.line(box.x, Y(0), box.x + box.w, Y(0));
      if (q.x[0] < 0 && q.x[1] > 0) p.line(X(0), box.y, X(0), box.y + box.h);
    }
  });
  const step = run.steps[Math.max(0, Math.min(run.steps.length - 1, at))];
  if (!step) return;
  const colour = (tone: number | undefined): RGB => (tone === undefined || tone < 0 ? fg : ramp(pal, tone));
  const ctx2d = p.drawingContext as CanvasRenderingContext2D;
  for (const L of step.layers) {
    const f = frames[L.panel ?? 0];
    if (!f) continue;
    const { X, Y, box } = f;
    // push/pop keep p5's cached styles in step with the context the clip is saved on
    p.push();
    ctx2d.beginPath();
    ctx2d.rect(box.x, box.y, box.w, box.h);
    ctx2d.clip();
    const c = colour(L.tone);
    const a = (L.alpha ?? 1) * 255;
    switch (L.kind) {
      case 'curve': {
        const n = Math.min(L.pts.length, L.n ?? L.pts.length);
        p.noFill();
        p.stroke(c[0], c[1], c[2], a);
        p.strokeWeight(L.weight ?? 2);
        p.beginShape();
        for (let k = 0; k < n; k++) {
          const [x, y] = L.pts[k];
          if (Number.isFinite(x) && Number.isFinite(y)) p.vertex(X(x), Y(y));
        }
        p.endShape();
        break;
      }
      case 'points': {
        const n = Math.min(L.pts.length, L.n ?? L.pts.length);
        const s = L.size ?? 3;
        p.noStroke();
        for (let k = 0; k < n; k++) {
          const [x, y] = L.pts[k];
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          const ck = L.tones ? colour(L.tones[k]) : c;
          p.fill(ck[0], ck[1], ck[2], a);
          if (s <= 1.5) p.rect(X(x), Y(y), s, s);
          else p.circle(X(x), Y(y), s);
        }
        break;
      }
      case 'segments':
        p.stroke(c[0], c[1], c[2], a);
        p.strokeWeight(L.weight ?? 1);
        for (const [x0, y0, x1, y1] of L.segs) p.line(X(x0), Y(y0), X(x1), Y(y1));
        break;
      case 'rects':
        for (const [x, y, w, h, t] of L.rects) {
          const ck = colour(t);
          if (L.outline) { p.noFill(); p.stroke(ck[0], ck[1], ck[2], a); p.strokeWeight(1.5); } else { p.noStroke(); p.fill(ck[0], ck[1], ck[2], a); }
          const x0 = X(x); const x1 = X(x + w); const y0 = Y(y); const y1 = Y(y + h);
          p.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        }
        break;
      case 'polygon':
        if (L.outline) { p.noFill(); p.stroke(c[0], c[1], c[2], a); p.strokeWeight(1.5); } else { p.noStroke(); p.fill(c[0], c[1], c[2], a); }
        p.beginShape();
        for (const [x, y] of L.pts) p.vertex(X(x), Y(y));
        p.endShape(p.CLOSE);
        break;
      case 'grid': {
        const shown = Math.min(L.rows, L.rowsShown ?? L.rows);
        const key = `${pal.id}|${ctx.theme}|${shown}`;
        let cached = rasters.get(L);
        if (!cached || cached.key !== key) {
          const ras = cached?.r ?? new Raster(L.cols, L.rows);
          ras.fill(ctx.bg);
          const span = L.hi - L.lo || 1;
          for (let i = 0; i < shown; i++) {
            for (let j = 0; j < L.cols; j++) {
              const v = L.values[i * L.cols + j];
              if (!Number.isFinite(v) || v === L.clear) continue;
              const cc = ramp(pal, (v - L.lo) / span);
              ras.set(j, i, cc[0], cc[1], cc[2]);
            }
          }
          cached = { r: ras, key };
          rasters.set(L, cached);
        }
        const [bx0, by0, bx1, by1] = L.box ?? [run.panels[L.panel ?? 0].x[0], run.panels[L.panel ?? 0].y[0],
          run.panels[L.panel ?? 0].x[1], run.panels[L.panel ?? 0].y[1]];
        const gx0 = X(bx0); const gx1 = X(bx1); const gy0 = Y(by1); const gy1 = Y(by0);
        cached.r.blit(p, false, Math.min(gx0, gx1), Math.min(gy0, gy1), Math.abs(gx1 - gx0), Math.abs(gy1 - gy0));
        break;
      }
      case 'text':
        p.noStroke();
        p.fill(c[0], c[1], c[2], a);
        p.textSize(Math.max(8, fs - 2));
        p.textAlign(L.align === 'right' ? p.RIGHT : L.align === 'center' ? p.CENTER : p.LEFT, p.CENTER);
        p.text(L.text, X(L.x), Y(L.y));
        p.textSize(fs);
        break;
    }
    p.pop();
  }
}

/** The text, shortened with an ellipsis to fit width w at the current text size. */
function fit(p: p5, text: string, w: number): string {
  if (p.textWidth(text) <= w) return text;
  let t = text;
  while (t.length > 1 && p.textWidth(`${t}…`) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** One kernel's run as the plate replays it. */
class Replay {
  run: NumericRun;
  at = 0;
  private acc = 0;
  constructor(kernel: NumericKernel, seed: number, params: Params) {
    this.run = kernel.run({ seed, params });
  }
  get last(): number { return this.run.steps.length - 1; }
  get done(): boolean { return this.at >= this.last; }
  advance(perFrame: number): void {
    this.acc += perFrame;
    while (this.acc >= 1 && !this.done) { this.at++; this.acc -= 1; }
    if (this.done) this.acc = 0;
  }
}

function merged(kernel: NumericKernel, ctx: PlateContext): Params {
  return { ...defaults(kernel.params), ...ctx.params };
}

function plate(info: KernelInfo, kernel: NumericKernel): PlateCode {
  return {
    id: info.id,
    mode: '2d',
    aspect: kernel.aspect ?? 16 / 9,
    thumbnailFrames: 2,
    params: [...(kernel.params ?? []), ...controls(), paletteParam(kernel.palette ?? 'spectral')],
    create(p, ctx) {
      let generation = 0;
      let hold = 0;
      let r = new Replay(kernel, ctx.seed, merged(kernel, ctx));
      return {
        setup() {
          if (ctx.thumbnail) r.at = Math.round(r.last * (kernel.thumb ?? 1));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            if (!r.done) r.advance(((kernel.rate ?? 2) * num(ctx.params, 'speed')) / 60);
            else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              r = new Replay(kernel, ctx.seed + generation * 7919, merged(kernel, ctx));
            }
          }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          drawRun(p, ctx, r.run, r.at, { x: pad, y: pad, w: ctx.width - 2 * pad, h: ctx.height - 2 * pad });
          const step = r.run.steps[r.at];
          const chart = step?.chart ?? r.run.chart;
          if (chart) ctx.chart(chart);
          ctx.stats([...(step?.stats ?? []), { label: 'Step', value: `${r.at + 1} of ${r.run.steps.length}` }]);
        },
      };
    },
  };
}

function lab(id: string, kernels: { info: KernelInfo; kernel: NumericKernel }[]): PlateCode {
  // the controls every kernel of the lab shares, so all of them run on the same input
  const first = kernels[0]?.kernel.params ?? [];
  const shared = first.filter((d) => kernels.every((k) => (k.kernel.params ?? []).some((e) => e.key === d.key)));
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: [...shared, ...controls(), paletteParam(kernels[0]?.kernel.palette ?? 'spectral')],
    create(p, ctx) {
      let generation = 0;
      let hold = 0;
      let panes: { info: KernelInfo; kernel: NumericKernel; r: Replay }[] = [];
      let series: { name: string; points: XY[] }[] = [];
      const build = () => {
        const seed = ctx.seed + generation * 7919;
        panes = kernels.map((k) => ({ ...k, r: new Replay(k.kernel, seed, merged(k.kernel, ctx)) }));
        series = kernels.flatMap((k) => (k.kernel.probe?.measure({ seed, params: merged(k.kernel, ctx) }) ?? [])
          .map((s) => ({ name: `${k.info.title}: ${s.name}`, points: s.points })));
      };
      build();
      const probe = kernels.find((k) => k.kernel.probe)?.kernel.probe;
      return {
        setup() {
          if (ctx.thumbnail) for (const q of panes) q.r.at = Math.round(q.r.last * (q.kernel.thumb ?? 1));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            for (const q of panes) if (!q.r.done) q.r.advance(((q.kernel.rate ?? 2) * num(ctx.params, 'speed')) / 60);
            if (panes.every((q) => q.r.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build();
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.round(Math.min(W, H) * 0.03);
          const ch = (H - pad * (panes.length + 1)) / Math.max(1, panes.length);
          const fs = Math.max(10, Math.min(15, Math.round(ch * 0.07)));
          panes.forEach((q, i) => {
            const y = pad + i * (ch + pad);
            p.noStroke();
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textSize(fs);
            p.textAlign(p.LEFT, p.TOP);
            p.text(q.info.title, pad, y);
            drawRun(p, ctx, q.r.run, q.r.at, { x: pad, y: y + fs + 4, w: W - 2 * pad, h: ch - fs - 4 });
          });
          if (probe) ctx.chart({ title: 'Measured side by side', x: probe.x, y: probe.y, series });
          const rows: Stat[] = [];
          for (const q of panes) {
            const st = q.r.run.steps[q.r.at]?.stats ?? [];
            rows.push({ label: q.info.title, value: st.slice(0, 3).map((s) => `${s.label} ${s.value}`).join(' · ') });
          }
          ctx.stats(rows);
        },
      };
    },
  };
}

export const engine: Engine<NumericKernel> = { id: 'numeric', plate, lab };
