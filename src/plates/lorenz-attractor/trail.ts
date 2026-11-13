// A tracer's trail: the last `max` points of its path in a ring buffer, each with the speed it
// arrived at, taken once when it is pushed. The array it replaces shifted up to 2400 points per
// tracer on every step and recomputed every point's speed and colour every frame; at the heaviest
// corner (48 tracers, 12 steps a frame) that was about 1.4 million moves, 115,000 square roots and
// 115,000 colour arrays allocated a frame. Each point's colour is now taken once per palette (a
// palette change recolours the trail on the next frame). drawTrail issues the same strokes and
// vertices the array code did, in the same order.
import { ramp } from '../../core/palette';

export type V3 = [number, number, number];

/** The speed at which a point colours fully: above it the ramp stays at its top. */
const TOP_SPEED = 220;

export class Trail {
  private readonly pts: V3[];
  private readonly speed: Float64Array;
  /** Each point's colour, and the palette it was taken from. */
  private readonly colour: (readonly number[])[];
  private readonly colourOf: unknown[];
  private start = 0;
  private len = 0;

  /** Holds the last `max` points (at least one) of a path stepped every `dt`. */
  constructor(readonly max: number, private readonly dt: number) {
    const cap = Math.max(1, Math.floor(max)) + 1;
    this.pts = new Array<V3>(cap);
    this.speed = new Float64Array(cap);
    this.colour = new Array(cap);
    this.colourOf = new Array(cap);
  }

  /** Points held now. */
  get length(): number {
    return this.len;
  }

  /** The j-th point held, oldest first. */
  at(j: number): V3 {
    return this.pts[(this.start + j) % this.pts.length];
  }

  /** The speed the j-th point arrived at (from the point pushed before it). */
  speedAt(j: number): number {
    return this.speed[(this.start + j) % this.pts.length];
  }

  /** The j-th point's colour in `pal`: the speed ramp, taken once per point and palette. */
  colourAt(j: number, pal: Parameters<typeof ramp>[0]): readonly number[] {
    const i = (this.start + j) % this.pts.length;
    if (this.colourOf[i] !== pal) {
      this.colour[i] = ramp(pal, Math.min(1, this.speed[i] / TOP_SPEED));
      this.colourOf[i] = pal;
    }
    return this.colour[i];
  }

  /** Add the newest point, dropping the oldest once `max` are held. */
  push(b: V3): void {
    const cap = this.pts.length;
    const idx = (this.start + this.len) % cap;
    if (this.len > 0) {
      const a = this.pts[(this.start + this.len - 1) % cap];
      this.speed[idx] = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / this.dt;
    }
    this.pts[idx] = b;
    this.colourOf[idx] = undefined;
    if (this.len < Math.max(1, Math.floor(this.max))) this.len++;
    else this.start = (this.start + 1) % cap;
  }
}

type Pen = {
  beginShape(): void;
  endShape(): void;
  stroke(r: number, g: number, b: number, a: number): void;
  vertex(x: number, y: number, z: number): void;
};

/** The trail as a line from its second point on, coloured by speed and fading towards its tail. */
export function drawTrail(p: Pen, tr: Trail, pal: Parameters<typeof ramp>[0]): void {
  p.beginShape();
  const n = tr.length;
  for (let j = 1; j < n; j++) {
    const b = tr.at(j);
    const c = tr.colourAt(j, pal);
    const fade = j / n;
    p.stroke(c[0], c[1], c[2], 40 + 215 * fade);
    // the attractor sits around z ≈ ρ − 1; centre it and map z to screen-up
    p.vertex(b[0], -(b[2] - 25), b[1]);
  }
  p.endShape();
}
