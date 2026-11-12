// Drawing shared by the two-slit plates: the screen histogram drawn sideways beside an apparatus,
// so a position on the screen is a height on the canvas for the apparatus and the curves alike.
// Drawing only: nothing here is measured.
import type { RGB } from '../../../core/palette';

export const rgba = (c: RGB, a: number): string =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

export interface Panel {
  /** Left edge and width of the histogram panel (px). */
  x: number;
  w: number;
  /** Top and height of the screen's span (px). */
  y: number;
  h: number;
}

/** Bars of counts, one per bin, growing rightwards from the panel's left edge. */
export function bars(g: CanvasRenderingContext2D, p: Panel, counts: ArrayLike<number>,
  peak: number, fill: string): void {
  const n = counts.length;
  const bh = p.h / n;
  g.fillStyle = fill;
  for (let i = 0; i < n; i++) {
    const len = peak > 0 ? (counts[i] / peak) * p.w : 0;
    if (len > 0) g.fillRect(p.x, p.y + (n - 1 - i) * bh + 0.5, len, Math.max(0.5, bh - 1));
  }
}

/** A curve of per-bin values in the same orientation as `bars`. */
export function curve(g: CanvasRenderingContext2D, p: Panel, values: ArrayLike<number>,
  peak: number, stroke: string, width = 1.4, dash: number[] = []): void {
  const n = values.length;
  const bh = p.h / n;
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.setLineDash(dash);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const x = p.x + (peak > 0 ? (values[i] / peak) * p.w : 0);
    const y = p.y + (n - 1 - i + 0.5) * bh;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.setLineDash([]);
}

/** A short legend: coloured swatch and label per row, top-left at (x, y). */
export function legend(g: CanvasRenderingContext2D, x: number, y: number,
  rows: [string, string][], fg: RGB, size = 11): void {
  g.font = `${size}px monospace`;
  g.textBaseline = 'middle';
  rows.forEach(([colour, label], i) => {
    const yy = y + i * (size + 5);
    g.fillStyle = colour;
    g.fillRect(x, yy - 3, 14, 6);
    g.fillStyle = rgba(fg, 0.8);
    g.fillText(label, x + 20, yy);
  });
}
