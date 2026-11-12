// Draws a geometry trace's marks into a rectangle of the canvas, through the plate's context:
// world coordinates (y up) are fitted to the rectangle with one scale, colours come from the
// palette and the ground colours only.
import type p5 from 'p5';
import { ramp, type RGB } from '../../core/palette';
import type { PlateContext } from '../../core/plate';
import type { Box, Mark } from './trace';
import type { Packed } from './track';

export interface View { ox: number; oy: number; s: number; box: Box; u: number }

/** Fit `box` into the screen rectangle (x, y, w, h), centred, aspect kept. */
export function fit(box: Box, x: number, y: number, w: number, h: number): View {
  const bw = Math.max(1e-9, box.x1 - box.x0);
  const bh = Math.max(1e-9, box.y1 - box.y0);
  const s = Math.min(w / bw, h / bh);
  return { ox: x + (w - bw * s) / 2, oy: y + (h - bh * s) / 2, s, box, u: Math.max(0.6, Math.min(w, h) / 420) };
}

export function drawMarks(p: p5, ctx: PlateContext, v: View, marks: Mark[]): void {
  const pal = ctx.palette();
  const X = (x: number) => v.ox + (x - v.box.x0) * v.s;
  const Y = (y: number) => v.oy + (v.box.y1 - y) * v.s;
  const colour = (c: number | undefined, a: number | undefined): [number, number, number, number] => {
    const rgb = c === undefined ? ctx.fg : ramp(pal, c);
    return [rgb[0], rgb[1], rgb[2], a ?? 255];
  };
  for (const m of marks) {
    const [r, g, b, a] = colour(m.c, m.a);
    switch (m.t) {
      case 'p':
        p.noStroke();
        p.fill(r, g, b, a);
        p.circle(X(m.x), Y(m.y), 2 * (m.r ?? 2) * v.u);
        break;
      case 'l':
        p.stroke(r, g, b, a);
        p.strokeWeight((m.w ?? 1) * v.u);
        p.line(X(m.x0), Y(m.y0), X(m.x1), Y(m.y1));
        break;
      case 'g':
        if (m.fill) { p.noStroke(); p.fill(r, g, b, a); } else {
          p.noFill();
          p.stroke(r, g, b, a);
          p.strokeWeight((m.w ?? 1) * v.u);
        }
        p.beginShape();
        for (let i = 0; i + 1 < m.pts.length; i += 2) p.vertex(X(m.pts[i]), Y(m.pts[i + 1]));
        if (m.close || m.fill) p.endShape(p.CLOSE); else p.endShape();
        break;
      case 'r': {
        const x0 = X(Math.min(m.x0, m.x1)); const y0 = Y(Math.max(m.y0, m.y1));
        const w = Math.abs(m.x1 - m.x0) * v.s; const h = Math.abs(m.y1 - m.y0) * v.s;
        if (m.fill) { p.noStroke(); p.fill(r, g, b, a); } else {
          p.noFill();
          p.stroke(r, g, b, a);
          p.strokeWeight((m.w ?? 1) * v.u);
        }
        p.rect(x0, y0, w, h);
        break;
      }
      case 'o':
        if (m.fill) { p.noStroke(); p.fill(r, g, b, a); } else {
          p.noFill();
          p.stroke(r, g, b, a);
          p.strokeWeight((m.w ?? 1) * v.u);
        }
        p.circle(X(m.x), Y(m.y), 2 * m.rad * v.s);
        break;
      case 'x':
        p.noStroke();
        p.fill(r, g, b, a);
        p.textSize(Math.max(9, Math.round(10 * v.u)));
        p.textAlign(m.align === 'r' ? p.RIGHT : m.align === 'c' ? p.CENTER : p.LEFT, p.CENTER);
        p.text(m.s, X(m.x), Y(m.y));
        break;
    }
  }
}

/**
 * Draw a packed frame straight from its Float64Array (track.ts's layout), creating no objects
 * per mark and skipping style calls that would not change anything, so a frame of thousands of
 * marks costs its drawing and nothing else.
 */
export function drawPacked(p: p5, ctx: PlateContext, v: View, pk: Packed): void {
  const d = pk.data;
  const pal = ctx.palette();
  const memo = new Map<number, RGB>();
  const rgbOf = (c: number): RGB => {
    if (Number.isNaN(c)) return ctx.fg;
    let rgb = memo.get(c);
    if (!rgb) { rgb = ramp(pal, c); memo.set(c, rgb); }
    return rgb;
  };
  // the colour last set, held as its own fields: one combined key would let two different
  // (colour, alpha) pairs collide and skip a needed call
  const same = (x: number, y: number) => x === y || (Number.isNaN(x) && Number.isNaN(y));
  let fillC = NaN; let fillA = NaN; let strokeC = NaN; let strokeA = NaN; let weight = NaN;
  let filling = true; let stroking = true; let fillSet = false; let strokeSet = false;
  const fill = (c: number, a: number) => {
    if (filling && fillSet && same(c, fillC) && a === fillA) return;
    const rgb = rgbOf(c);
    p.fill(rgb[0], rgb[1], rgb[2], a);
    fillC = c; fillA = a; filling = true; fillSet = true;
  };
  const stroke = (c: number, a: number, w: number) => {
    if (!stroking || !strokeSet || !same(c, strokeC) || a !== strokeA) {
      const rgb = rgbOf(c);
      p.stroke(rgb[0], rgb[1], rgb[2], a);
      strokeC = c; strokeA = a; stroking = true; strokeSet = true;
    }
    if (w !== weight) { p.strokeWeight(w); weight = w; }
  };
  const noFill = () => { if (filling) { p.noFill(); filling = false; } };
  const noStroke = () => { if (stroking) { p.noStroke(); stroking = false; } };
  const X = (x: number) => v.ox + (x - v.box.x0) * v.s;
  const Y = (y: number) => v.oy + (v.box.y1 - y) * v.s;
  let k = 0;
  while (k < d.length) {
    const kind = d[k]; const c = d[k + 1]; const a = Number.isNaN(d[k + 2]) ? 255 : d[k + 2];
    const w = d[k + 3]; const flags = d[k + 4];
    k += 5;
    const filled = (flags & 1) === 1;
    const style = (wDefault: number) => {
      if (filled) { noStroke(); fill(c, a); } else { noFill(); stroke(c, a, (Number.isNaN(w) ? wDefault : w) * v.u); }
    };
    if (kind === 2) {
      const len = d[k++];
      style(1);
      p.beginShape();
      for (let i = 0; i + 1 < len; i += 2) p.vertex(X(d[k + i]), Y(d[k + i + 1]));
      if ((flags & 2) === 2 || filled) p.endShape(p.CLOSE); else p.endShape();
      k += len;
      continue;
    }
    const x0 = d[k]; const y0 = d[k + 1]; const x1 = d[k + 2]; const y1 = d[k + 3];
    k += 4;
    if (kind === 0) {
      noStroke(); fill(c, a);
      p.circle(X(x0), Y(y0), 2 * (Number.isNaN(w) ? 2 : w) * v.u);
    } else if (kind === 1) {
      stroke(c, a, (Number.isNaN(w) ? 1 : w) * v.u);
      p.line(X(x0), Y(y0), X(x1), Y(y1));
    } else if (kind === 3) {
      style(1);
      p.rect(X(Math.min(x0, x1)), Y(Math.max(y0, y1)), Math.abs(x1 - x0) * v.s, Math.abs(y1 - y0) * v.s);
    } else if (kind === 4) {
      style(1);
      p.circle(X(x0), Y(y0), 2 * x1 * v.s);
    } else {
      noStroke(); fill(c, a);
      const al = (flags >> 2) & 3;
      p.textSize(Math.max(9, Math.round(10 * v.u)));
      p.textAlign(al === 3 ? p.RIGHT : al === 2 ? p.CENTER : p.LEFT, p.CENTER);
      p.text(pk.strings[x1], X(x0), Y(y0));
    }
  }
}
