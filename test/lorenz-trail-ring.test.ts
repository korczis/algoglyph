// The Lorenz trails' cost at the heaviest corner (48 tracers, trail 2400, 12 steps a frame): each
// step shifted an array of up to 2400 points per tracer (about 1.4 million moves a frame) and
// every frame recomputed every point's speed. A ring buffer with each point's speed taken once,
// when it is pushed, draws the same strokes and vertices: proved here within one run against the
// old array code, with every argument compared exactly (no rounding, no hash from one CPU).
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette as lookupPalette, ramp } from '../src/core/palette';
import type { Chart, Params, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { lorenzAttractor, makeLorenz } from '../src/plates/lorenz-attractor/plate';
import { drawTrail, strideFor, Trail, VERTEX_CAP, type V3 } from '../src/plates/lorenz-attractor/trail';

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

  it('draws every point up to the vertex cap, and a stride of 4 at the heaviest corner', () => {
    const tracers = lorenzAttractor.params.find((d) => d.key === 'tracers') as { min: number; max: number; step: number; value: number };
    const trail = lorenzAttractor.params.find((d) => d.key === 'trail') as { min: number; max: number; step: number; value: number };
    expect(strideFor(tracers.value, trail.value)).toBe(1);
    for (let t = tracers.min; t <= tracers.max; t += tracers.step) {
      for (let l = trail.min; l <= trail.max; l += trail.step) {
        if (t * l <= VERTEX_CAP) expect(strideFor(t, l), `${t} × ${l}`).toBe(1);
        else expect(strideFor(t, l) * VERTEX_CAP, `${t} × ${l}`).toBeGreaterThanOrEqual(t * l);
      }
    }
    expect(strideFor(tracers.max, trail.max)).toBe(4);
  });

  it('a strided trail ends on the newest point and keeps each point\'s own colour and fade', () => {
    const pal = lookupPalette('ember');
    const ring = new Trail(103, DT);
    const rnd = mulberry32(7);
    for (let k = 0; k < 140; k++) ring.push([rnd() * 20, rnd() * 20, rnd() * 40]);
    const full = exactRecorder();
    const strided = exactRecorder();
    drawTrail(full.p, ring, pal, 1);
    drawTrail(strided.p, ring, pal, 4);
    // full: begin, (stroke, vertex) for j = 1 … 102, end; strided keeps j = 2, 6, …, 102
    const pairs = (calls: unknown[][]) => calls.slice(1, -1);
    const kept = pairs(full.calls).filter((_, i) => Math.floor(i / 2) % 4 === 1);
    expect(pairs(strided.calls)).toEqual(kept);
    expect(strided.calls.at(-2)).toEqual(full.calls.at(-2));
  });

  /** Drive the capped plate and the uncapped one in lockstep from one seed, comparing every call of every frame. */
  function lockstep(params: Params, frames: number): { equal: boolean; frames: number } {
    const make = (cap: number) => {
      const ctx: PlateContext = {
        width: 1440, height: 900, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
        bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false,
        palette: () => lookupPalette(String(params.palette ?? 'ember')),
        stats() {}, chart() {},
      };
      const rec = exactRecorder();
      const sim = makeLorenz(cap).create(rec.p, ctx);
      sim.setup();
      return { sim, calls: rec.calls };
    };
    const a = make(VERTEX_CAP);
    const b = make(Infinity);
    for (let f = 0; f < frames; f++) {
      a.calls.length = 0;
      b.calls.length = 0;
      a.sim.draw();
      b.sim.draw();
      if (JSON.stringify(a.calls) !== JSON.stringify(b.calls)) return { equal: false, frames: f };
    }
    return { equal: true, frames };
  }

  it('the default run draws exactly what drawing every point draws, frame by frame, past a full trail', () => {
    const params: Params = {};
    for (const d of lorenzAttractor.params) params[d.key] = d.value;
    // 900 points at 3 steps a frame fill the trail at frame 300; 330 frames run past it
    expect(lockstep(params, 330)).toEqual({ equal: true, frames: 330 });
  });

  it('a planted change fails the same comparison: at the heaviest corner the strided frame differs', () => {
    const params: Params = {};
    for (const d of lorenzAttractor.params) params[d.key] = d.value;
    Object.assign(params, { tracers: 48, trail: 2400, speed: 12, rho: 60 });
    expect(lockstep(params, 5).equal).toBe(false);
  });
});
