// pathfinding-terrain's wall height becomes a control (wave 7a phase 2, C7): the plate made every
// cell whose normalised height is at least 0.8 a wall; it now uses the `wall` control, 0.8 by
// default, so the default map is the old one. Its low end is measured where the plate's 20 map
// attempts start failing: below it some builds find no map with a passable start, goal and a
// path between (the plate then says so, the latent crash phase 1 fixed); its top is 1, where only
// the highest cell is a wall, since the heights are normalised to [0, 1].
// Checked here: the control exists with the old constant as its default, it travels in a shared
// link, the default draws exactly what the plate drew with the constant (a mock that pins the
// wall level to 0.8 whatever the plate passes, in the same run), and it drives the readouts: at
// both ends A* at weight 1 is optimal, 0 % above, and its path cost is a heap-free Dijkstra's.
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, RangeParam, Stat } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { mulberry32 } from '../src/core/random';
import { terrain, type Terrain } from '../src/plates/pathfinding-terrain/search';
import plateCode from '../src/plates/pathfinding-terrain/plate';
import { read, type Claim } from './support/claims';
import { drawRecorder } from './support/draw-recorder';
import { installBrowserStubs } from './support/p5-stub';

/** Each raster the plate blits, as a digest of its pixels: the offscreen canvas's putImageData
 * (src/core/raster.ts) records here, so the comparison below sees the shaded map, not only the
 * route and the labels drawn over it. */
const pixels: string[] = [];
(globalThis as Record<string, unknown>).document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => new Proxy({}, {
      get: (_t, key) => (key === 'createImageData'
        ? (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) })
        : key === 'putImageData'
          ? (image: { data: Uint8ClampedArray }) => { pixels.push(createHash('sha256').update(image.data).digest('hex')); }
          : () => undefined),
    }),
  }),
};
installBrowserStubs();

const ID = 'pathfinding-terrain';
const KEY = 'wall';
const SEARCH = '../src/plates/pathfinding-terrain/search';
/** The plate's default map: 800 × 500 px at 12 px cells (as test/support/claims.ts runs it). */
const W = 66;
const H = 41;
const defOf = () => plateCode.params.find((d) => d.key === KEY) as RangeParam | undefined;
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });

/** Distances from `start` by Dijkstra with a linear scan for the nearest open cell: no heap. */
function scanDijkstra(t: Terrain, start: number): Float64Array {
  const n = t.w * t.h;
  const d = new Float64Array(n).fill(Infinity);
  const done = new Uint8Array(n);
  d[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && Number.isFinite(d[i]) && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) return d;
    done[u] = 1;
    const x = u % t.w; const y = Math.floor(u / t.w);
    for (const j of [x > 0 ? u - 1 : -1, x < t.w - 1 ? u + 1 : -1, y > 0 ? u - t.w : -1, y < t.h - 1 ? u + t.w : -1]) {
      if (j >= 0 && Number.isFinite(t.cost[j]) && d[u] + t.cost[j] < d[j]) d[j] = d[u] + t.cost[j];
    }
  }
}

/** The optimum of the map the plate draws at this wall level: its first attempt with a path. */
function optimum(seed: number, wall: number): number {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 20; attempt++) {
    const { terrain: t } = terrain(W, H, rnd, 1.2, wall);
    const pick = (x: number) => {
      let best = -1;
      for (let y = 1; y < H - 1; y++) {
        const i = y * W + x;
        if (Number.isFinite(t.cost[i]) && (best < 0 || t.cost[i] < t.cost[best])) best = i;
      }
      return best;
    };
    const [start, goal] = [pick(1), pick(W - 2)];
    if (start < 0 || goal < 0) continue;
    const d = scanDijkstra(t, start);
    if (Number.isFinite(d[goal])) return d[goal];
  }
  throw new Error(`no map at seed ${seed}, wall ${wall}`);
}

/** Every draw call and readout of 200 live frames and two thumbnail frames at the defaults. */
function calls(plate: PlateCode): string[] {
  const out: string[] = [];
  for (const thumbnail of [false, true]) {
    const params: Params = Object.fromEntries(plate.params.map((d) => [d.key, d.value]));
    const rec = drawRecorder();
    const c = rec.calls;
    // the recorder records every call; the raster's blit also needs a 2D context to draw on
    const blit = { save() {}, restore() {}, drawImage() { c.push('drawImage'); } };
    const p = new Proxy(rec.p as object, { get: (t, k) => (k === 'drawingContext' ? blit : Reflect.get(t, k)) }) as never;
    const ctx: PlateContext = {
      width: 800, height: 500, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
      bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail, palette: () => lookupPalette('phosphor'),
      stats(r: Stat[]) { out.push(JSON.stringify(r)); }, chart(x: Chart) { out.push(JSON.stringify(x)); },
    };
    const sim = plate.create(p, ctx);
    sim.setup();
    for (let f = 0; f < (thumbnail ? 2 : 200); f++) {
      sim.draw();
      out.push(c.join('\n'), ...pixels); c.length = 0; pixels.length = 0;
    }
  }
  return out;
}

describe('pathfinding-terrain: wall height', () => {
  it('is a range control from where map attempts start failing to 1, the old constant 0.8 its default', () => {
    expect(defOf()).toMatchObject({ kind: 'range', min: 0.55, max: 1, step: 0.05, value: 0.8, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateCode.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.55, 0.7, 1]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('draws at its default exactly what the plate drew with the constant 0.8', async () => {
    const now = calls(plateCode);
    vi.resetModules();
    vi.doMock(SEARCH, async (importOriginal) => {
      const real = await importOriginal<typeof import('../src/plates/pathfinding-terrain/search')>();
      // the plate before the control: the wall level 0.8 whatever it is given
      return { ...real, terrain: (w: number, h: number, rnd: () => number, rough: number) => real.terrain(w, h, rnd, rough, 0.8) };
    });
    try {
      const before = (await import('../src/plates/pathfinding-terrain/plate')).default as PlateCode;
      expect(before).not.toBe(plateCode);
      expect(now).toEqual(calls(before));
    } finally {
      vi.doUnmock(SEARCH);
      vi.resetModules();
    }
  });

  it('drives the readouts: optimal at both ends, at a heap-free Dijkstra\'s cost', async () => {
    for (const wall of [defOf()?.min ?? 0.55, 1]) {
      const vs = await read(ID, claim('vs optimum', { [KEY]: wall }));
      expect(vs.reason, `${wall}`).toBeUndefined();
      expect(vs.value, `${wall}`).toBe(0);
      const cost = await read(ID, claim('path cost', { [KEY]: wall }));
      expect(cost.value, `${wall}`).toBe(Number(optimum(4242, wall).toFixed(1)));
    }
    // and the walls move the optimum: a lower wall level walls more of the map off
    expect(optimum(4242, 0.55)).not.toBe(optimum(4242, 1));
  });
});
