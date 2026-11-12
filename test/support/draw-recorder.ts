// A p5 that records every call a plate makes (name and arguments, numbers rounded to 1e-3)
// instead of drawing, so a test can prove two versions of an engine draw the same picture.
// Constants (p.LEFT, p.TOP, ...) read back as their names.
import { createHash } from 'node:crypto';
import { GROUNDS, palette as lookupPalette } from '../../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../../src/core/plate';
import { mulberry32 } from '../../src/core/random';

const arg = (a: unknown) => (typeof a === 'number' ? String(Math.round(a * 1000) / 1000) : String(a));

export function drawRecorder() {
  const calls: string[] = [];
  const p = new Proxy({}, {
    get(_t, key) {
      if (typeof key !== 'string') return undefined;
      if (/^[A-Z_]+$/.test(key)) return key;
      return (...args: unknown[]) => { calls.push(`${key}(${args.map(arg).join(',')})`); };
    },
  });
  return { p: p as never, calls };
}

/**
 * Every draw call, readout and chart of `frames` frames of a plate (live, then a thumbnail),
 * as one SHA-256: what a plate showed, in order.
 */
export function drawHash(plate: PlateCode, over: Params, frames: number, width = 1440): string {
  const h = createHash('sha256');
  for (const thumbnail of [false, true]) {
    const params: Params = {};
    for (const d of plate.params) params[d.key] = d.value;
    Object.assign(params, over);
    const { p, calls } = drawRecorder();
    const out: string[] = [];
    const ctx: PlateContext = {
      width, height: Math.round(width / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
      theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail,
      palette: () => lookupPalette(String(params.palette ?? 'spectral')),
      stats(rows: Stat[]) { out.push(JSON.stringify(rows)); },
      chart(c: Chart) { out.push(JSON.stringify(c)); },
    };
    const sim = plate.create(p, ctx);
    sim.setup();
    for (let f = 0; f < (thumbnail ? 2 : frames); f++) {
      sim.draw();
      h.update(calls.join('\n'));
      h.update(out.join('\n'));
      calls.length = 0;
      out.length = 0;
    }
  }
  return h.digest('hex');
}
