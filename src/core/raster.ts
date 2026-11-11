// A low-resolution pixel buffer blitted onto the p5 canvas. Plates that shade every cell (the
// ripple tank, Voronoi, cellular automata, the avalanche matrix) write here instead of issuing
// thousands of rect() calls.
import type p5 from 'p5';
import type { RGB } from './palette';

export class Raster {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly image: ImageData;

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('Raster: 2D context unavailable');
    this.g = g;
    this.image = g.createImageData(this.w, this.h);
    this.data = this.image.data;
  }

  fill(c: RGB): void {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
    }
  }

  set(x: number, y: number, r: number, g: number, b: number): void {
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }

  /** Move every row up by `rows`, leaving the bottom rows as they were (for scrolling). */
  scrollUp(rows: number): void {
    const stride = this.w * 4;
    this.data.copyWithin(0, rows * stride);
  }

  /** Draw the buffer over the whole canvas; `smooth` false keeps hard pixel edges. */
  blit(p: p5, smooth: boolean, x = 0, y = 0, w = p.width, h = p.height): void {
    this.g.putImageData(this.image, 0, 0);
    const ctx = p.drawingContext as CanvasRenderingContext2D;
    ctx.save();
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.canvas, x, y, w, h);
    ctx.restore();
  }
}
