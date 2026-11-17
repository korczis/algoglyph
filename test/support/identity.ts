// "The same run, before and after": a plate driven headless from one seed with every observable
// recorded, so two versions of its code can be compared within one run (no recorded hash, no
// previous run). Recorded per frame: every p5 call with its arguments (numbers and strings exactly,
// objects by kind), the pixels of every Raster blit (a SHA-256 of the buffer, taken and compared in
// this process), and every readout row. Used by test/hot-loops/*.test.ts, where each plate whose
// hot loop was rewritten is run against a verbatim copy of its module from before the rewrite.
import { createHash } from 'node:crypto';
import { GROUNDS, palette } from '../../src/core/palette';
import type { Params, PlateCode, PlateContext } from '../../src/core/plate';
import { mulberry32 } from '../../src/core/random';
import { Raster } from '../../src/core/raster';
import { installBrowserStubs } from './p5-stub';

export interface Recording { frames: string[] }

const describe = (v: unknown): unknown => {
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v == null) return v;
  if (Array.isArray(v)) return v.map(describe);
  if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${(v as unknown as { length: number }).length})`;
  return typeof v === 'function' ? 'fn' : 'object';
};

/** A p5 that answers like the budget's stub (itself, for chaining) and records every call. */
function recordingP5(log: string[], width: number, height: number): never {
  const handler: ProxyHandler<() => void> = {
    get(_t, key) {
      if (key === Symbol.toPrimitive) return () => NaN;
      if (key === 'then') return undefined;
      if (key === 'width') return width;
      if (key === 'height') return height;
      if (key === 'pixels') return new Uint8ClampedArray(4);
      if (typeof key === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(key)) return key;
      return new Proxy(function call() {}, {
        apply(_f, _this, args) { log.push(JSON.stringify([String(key), ...args.map(describe)])); return proxy; },
        get: handler.get,
      });
    },
    apply() { return proxy; },
    set() { return true; },
  };
  const proxy: unknown = new Proxy(function p5() {}, handler);
  return proxy as never;
}

/** Drive `plate` for `frames` frames at `params` (over its defaults) and record what it does. */
export function record(plate: PlateCode, over: Params, frames: number, { width = 800, height = 500, seed = 4242 } = {}): Recording {
  installBrowserStubs();
  const params: Params = {};
  for (const d of plate.params) params[d.key] = d.value;
  Object.assign(params, over);
  const log: string[] = [];
  const blit = Raster.prototype.blit;
  // the pixels as each blit sends them, hashed here and compared in this same run
  Raster.prototype.blit = function recorded(this: Raster, ...a: Parameters<typeof blit>) {
    log.push(`blit ${createHash('sha256').update(this.data).digest('hex')}`);
    return blit.apply(this, a);
  };
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width, height, params, seed, rnd: mulberry32(seed), theme: 'dark', bg: ground.bg, fg: ground.fg,
    thumbnail: false, palette: () => palette(String(params.palette ?? 'ember')),
    stats(rows) { log.push(`stats ${JSON.stringify(rows)}`); },
    chart(c) { log.push(`chart ${JSON.stringify(c)}`); },
  };
  const out: string[] = [];
  // a clock that advances 0.01 ms a read: a plate that slices its work by wall time (a search run
  // for a few ms a frame) then does the same work each frame in both runs, whatever the machine
  const now = performance.now;
  let clock = 0;
  performance.now = () => (clock += 0.01);
  try {
    const sim = plate.create(recordingP5(log, width, height), ctx);
    sim.setup();
    out.push(log.splice(0).join('\n'));
    for (let f = 0; f < frames; f++) { sim.draw(); out.push(log.splice(0).join('\n')); }
  } finally {
    Raster.prototype.blit = blit;
    performance.now = now;
  }
  return { frames: out };
}

/** The first frame (0 is setup) at which two recordings differ, or -1. */
export function firstDifference(a: Recording, b: Recording): number {
  const n = Math.max(a.frames.length, b.frames.length);
  for (let i = 0; i < n; i++) if (a.frames[i] !== b.frames[i]) return i;
  return -1;
}
