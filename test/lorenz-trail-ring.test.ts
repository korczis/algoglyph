// The Lorenz trails' cost at the heaviest corner (48 tracers, trail 2400, 12 steps a frame): each
// step shifted an array of up to 2400 points per tracer (about 1.4 million moves a frame) and
// every frame recomputed every point's speed. A ring buffer with each point's speed taken once,
// when it is pushed, draws the same strokes and vertices: proved here within one run against the
// old array code, with every argument compared exactly (no rounding, no hash from one CPU).
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette as lookupPalette, ramp } from '../src/core/palette';
import type { Chart, Params, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { lorenzAttractor } from '../src/plates/lorenz-attractor/plate';
import { drawTrail, Trail, type V3 } from '../src/plates/lorenz-attractor/trail';

/** A p5 that records every call with its arguments exactly. */
function exactRecorder() {
  const calls: unknown[][] = [];
  const p = new Proxy({}, {
    get(_t, key) {
      if (typeof key !== 'string') return undefined;
      if (/^[A-Z_]+$/.test(key)) return key;
      return (...args: unknown[]) => { calls.push([key, ...args]); };
    },
  });
  return { p: p as never, calls };
}

/** The trail code before the ring buffer, as it was in the plate: an array, shift, and speed per frame. */
function oldTrailDraw(p: { beginShape(): void; endShape(): void; stroke(...a: number[]): void; vertex(...a: number[]): void },
  tr: V3[], pal: ReturnType<typeof lookupPalette>, dt: number): void {
  p.beginShape();
  for (let j = 1; j < tr.length; j++) {
    const a = tr[j - 1];
    const b = tr[j];
    const v = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt;
    const c = ramp(pal, Math.min(1, v / 220));
    const fade = j / tr.length;
    p.stroke(c[0], c[1], c[2], 40 + 215 * fade);
    p.vertex(b[0], -(b[2] - 25), b[1]);
  }
  p.endShape();
}

const DT = 0.006;

describe('lorenz-attractor: the trail ring buffer', () => {
  it('draws exactly what the array trail drew, push by push, past its length', () => {
    const pal = lookupPalette('ember');
    for (const max of [1, 2, 5, 100]) {
      const rnd = mulberry32(4242 + max);
      const ring = new Trail(max, DT);
      const arr: V3[] = [];
      let h: V3 = [1, 1, 20];
      for (let k = 0; k < 3 * max + 7; k++) {
        h = [h[0] + (rnd() - 0.5) * 3, h[1] + (rnd() - 0.5) * 3, h[2] + (rnd() - 0.5) * 3];
        ring.push(h);
        arr.push(h);
        if (arr.length > max) arr.shift();
        const a = exactRecorder();
        const b = exactRecorder();
        drawTrail(a.p, ring, pal);
        oldTrailDraw(b.p, arr, pal, DT);
        expect(a.calls, `max ${max}, push ${k}`).toEqual(b.calls);
      }
    }
  });

  it('steps the plate without shifting an array, at the heaviest corner', () => {
    const params: Params = {};
    for (const d of lorenzAttractor.params) params[d.key] = d.value;
    Object.assign(params, { tracers: 48, trail: 2400, speed: 12, rho: 60 });
    const out: string[] = [];
    const ctx: PlateContext = {
      width: 1440, height: 900, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
      bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false,
      palette: () => lookupPalette(String(params.palette ?? 'ember')),
      stats(rows: Stat[]) { out.push(JSON.stringify(rows)); },
      chart(c: Chart) { out.push(JSON.stringify(c)); },
    };
    // a p5 that draws nothing and stores nothing: 220 frames at the corner make about 50 million calls
    const p = new Proxy({}, {
      get(_t, key) { return typeof key === 'string' && /^[A-Z_]+$/.test(key) ? key : () => undefined; },
    }) as never;
    const sim = lorenzAttractor.create(p, ctx);
    sim.setup();
    const shift = Array.prototype.shift;
    let shifts = 0;
    Array.prototype.shift = function patched(this: unknown[]) { shifts++; return shift.call(this); };
    try {
      for (let f = 0; f < 220; f++) sim.draw();
    } finally {
      Array.prototype.shift = shift;
    }
    expect(shifts).toBe(0);
  });
});
