// The small-n bar view of the bespoke sorting plates: a handful to a few hundred keys as bars,
// each coloured by its role (compared, kept, dropped, in place), the touched positions marked
// under the axis, and the key written on each bar while the bars are wide enough to read it.
// Drawing only; what a plate shows is counted by its own algorithm.
import type p5 from 'p5';
import type { RGB } from '../../../core/palette';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bars {
  keys: ArrayLike<number>;
  /** The largest key: bar heights are key / max of the box. */
  max: number;
  /** Positions in the box; more than keys.length leaves empty slots on the right. */
  slots?: number;
  color(i: number): RGB;
  /** Opacity 0..255 of bar i (default opaque). */
  alpha?(i: number): number;
  /** Positions marked under the axis (the operation's operands). */
  touched?: readonly number[];
  /** Write each key on its bar when the bars are at least this wide (px); 0 never. */
  labelFrom?: number;
  fg: RGB;
}

/** Width of one slot of a bar view of `slots` positions in `box`. */
export function slotWidth(box: Box, slots: number): number {
  return box.w / Math.max(1, slots);
}

/** The x centre of slot i. */
export function slotX(box: Box, slots: number, i: number): number {
  return box.x + (i + 0.5) * slotWidth(box, slots);
}

export function drawBars(p: p5, box: Box, b: Bars): void {
  const n = b.keys.length;
  const slots = Math.max(n, b.slots ?? n);
  if (!slots) return;
  const cw = slotWidth(box, slots);
  const gap = cw > 6 ? Math.min(6, cw * 0.14) : 0;
  const label = (b.labelFrom ?? 22) > 0 && cw >= (b.labelFrom ?? 22);
  const room = label ? Math.min(18, cw * 0.5) + 4 : 0;
  const scale = (box.h - room) / Math.max(1, b.max);
  p.noStroke();
  for (let i = 0; i < n; i++) {
    const h = Math.max(2, b.keys[i] * scale);
    const c = b.color(i);
    p.fill(c[0], c[1], c[2], b.alpha ? b.alpha(i) : 255);
    p.rect(box.x + i * cw + gap / 2, box.y + box.h - h, Math.max(1, cw - gap), h, cw > 14 ? 3 : 0);
  }
  if (label) {
    p.textAlign(p.CENTER, p.BOTTOM);
    p.textSize(Math.min(14, Math.max(9, cw * 0.38)));
    for (let i = 0; i < n; i++) {
      const h = Math.max(2, b.keys[i] * scale);
      p.fill(b.fg[0], b.fg[1], b.fg[2], b.alpha ? Math.max(90, b.alpha(i)) : 220);
      p.text(String(b.keys[i]), box.x + (i + 0.5) * cw, box.y + box.h - h - 3);
    }
  }
  if (b.touched?.length) {
    p.fill(...b.fg);
    for (const i of b.touched) {
      if (i < 0 || i >= slots) continue;
      p.rect(box.x + i * cw + gap / 2, box.y + box.h + 3, Math.max(2, cw - gap), 3);
    }
  }
}

/** One line of text on the canvas in the foreground colour (the readouts carry the same facts). */
export function caption(p: p5, fg: RGB, text: string, x: number, y: number, size = 12,
  align: 'left' | 'right' | 'center' = 'left', alpha = 210): void {
  p.noStroke();
  p.fill(fg[0], fg[1], fg[2], alpha);
  p.textSize(size);
  p.textAlign(align === 'left' ? p.LEFT : align === 'right' ? p.RIGHT : p.CENTER, p.TOP);
  p.text(text, x, y);
}

/** Padding that scales with the canvas: tight on a phone, roomier on a desktop. */
export function padding(width: number): number {
  return Math.round(Math.max(10, Math.min(28, width * 0.022)));
}
