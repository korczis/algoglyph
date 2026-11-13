// Escape-time iteration of the quadratic family z <- z² + c: the Mandelbrot set (start at
// z = 0, vary c) and its Julia sets (fix c, vary the start z). Pure numbers, no p5.

/**
 * Bailout radius. Any orbit with |z| > 2 ≥ |c| diverges, so 2 would do for membership; a large
 * radius makes the smooth count continuous to within about |c| / R² across integer steps.
 */
export const BAILOUT = 256;
const R2 = BAILOUT * BAILOUT;
const LOG_R = Math.log(BAILOUT);
const INV_LN2 = 1 / Math.LN2;

/** Returned for an orbit that stays within the bailout radius for the whole iteration cap. */
export const BOUNDED = -1;

/**
 * Iterate z <- z² + c from z0 = zr + i·zi for at most `maxIter` steps. Returns the smooth
 * escape count ν = n + 1 − log2(ln|z_n| / ln R), where n is the first index with |z_n| > R,
 * or BOUNDED. ν lies in [n, n + 1) up to the |c| / R² term, and is clamped at 0.
 */
export function escape(zr: number, zi: number, cr: number, ci: number, maxIter: number): number {
  let x = zr;
  let y = zi;
  let x2 = x * x;
  let y2 = y * y;
  for (let n = 0; ; n++) {
    const r2 = x2 + y2;
    if (r2 > R2) {
      const nu = n + 1 - Math.log((0.5 * Math.log(r2)) / LOG_R) * INV_LN2;
      return nu > 0 ? nu : 0;
    }
    if (n >= maxIter) return BOUNDED;
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
    x2 = x * x;
    y2 = y * y;
  }
}

/** Closed-form membership tests for the main cardioid and the period-2 disc (both inside M). */
export function inCardioidOrBulb(cr: number, ci: number): boolean {
  const xq = cr - 0.25;
  const q = xq * xq + ci * ci;
  if (q * (q + xq) <= 0.25 * ci * ci) return true;
  const xb = cr + 1;
  return xb * xb + ci * ci <= 1 / 16;
}

/** Mandelbrot escape count for parameter c, skipping the iteration where the answer is known. */
export function mandelbrot(cr: number, ci: number, maxIter: number): number {
  if (inCardioidOrBulb(cr, ci)) return BOUNDED;
  return escape(0, 0, cr, ci, maxIter);
}

/** Julia escape count for start z under the fixed parameter c. */
export function julia(zr: number, zi: number, cr: number, ci: number, maxIter: number): number {
  return escape(zr, zi, cr, ci, maxIter);
}

/** A rectangle of the complex plane: centre and real-axis width; height follows the aspect. */
export interface View {
  cx: number;
  cy: number;
  width: number;
}

/** The complex number under (x, y) of a w×h grid, imaginary axis pointing up. */
export function toPlane(view: View, w: number, h: number, x: number, y: number): [number, number] {
  const s = view.width / w;
  return [view.cx + (x - w / 2) * s, view.cy - (y - h / 2) * s];
}

/** Inverse of toPlane. */
export function toGrid(view: View, w: number, h: number, re: number, im: number): [number, number] {
  const s = view.width / w;
  return [(re - view.cx) / s + w / 2, (view.cy - im) / s + h / 2];
}

/** Recentre on (x, y) and divide the width by `factor` (> 1 zooms in). */
export function zoomAt(view: View, w: number, h: number, x: number, y: number,
  factor: number): View {
  const [cx, cy] = toPlane(view, w, h, x, y);
  return { cx, cy, width: view.width / factor };
}

/**
 * Interlaced row order for a progressive render: every 8th row first, then the rows halfway
 * between, down to single rows. Each entry is [row, span], span being how many rows from `row`
 * down that sample may stand in for until finer passes arrive.
 */
export function interlace(h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let s = 8; s >= 1; s /= 2) {
    const start = s === 8 ? 0 : s;
    const step = s === 8 ? 8 : 2 * s;
    for (let r = start; r < h; r += step) out.push([r, Math.min(s, h - r)]);
  }
  return out;
}

/**
 * The area inside from a pixel count: the fraction of the counted pixels that stayed bounded,
 * times the area of the view, with the binomial standard error of that fraction scaled the same
 * way. The pixel grid is regular, not random, so the error is a model of the count's spread;
 * an iteration cap counts slow escapers as inside, a bias the error does not include.
 */
export function countedArea(inside: number, pixels: number, viewArea: number): { area: number; se: number } {
  const p = pixels ? inside / pixels : 0;
  return { area: p * viewArea, se: pixels ? viewArea * Math.sqrt((p * (1 - p)) / pixels) : 0 };
}
