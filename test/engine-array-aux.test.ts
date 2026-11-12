// The array engine's auxiliary row: reserveAux widens it, clearAux empties cells for free, and
// both are recorded so a replay draws the row the kernel left, cell by cell.
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, PlateContext } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine, Replay } from '../src/engines/array';
import { apply, AUX_CAP, OP, trace, type ArrayKernel, type ArrayOps } from '../src/engines/array/trace';
import { drawRecorder } from './support/draw-recorder';

/** The auxiliary row a replay of a trace ends on (what Replay draws). */
function replayedAux(t: ReturnType<typeof trace>): number[] {
  const a = t.input.slice();
  const aux = new Array<number>(t.auxN).fill(0);
  for (let e = 0; e < t.length; e++) apply(a, aux, t.events, e);
  return aux;
}

describe('array engine auxiliary row', () => {
  it('is n cells unless a kernel reserves more, and never narrows', () => {
    expect(trace({ run() {} }, [3, 1, 2]).auxN).toBe(3);
    const t = trace({ run(a: ArrayOps) { a.reserveAux(10); a.reserveAux(4); a.setAux(9, 7); } }, [3, 1, 2]);
    expect(t.auxN).toBe(10);
    expect(replayedAux(t)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 7]);
  });

  it('refuses a cell outside the row, and a row past its cap', () => {
    expect(() => trace({ run(a: ArrayOps) { a.setAux(3, 1); } }, [3, 1, 2])).toThrow(RangeError);
    expect(() => trace({ run(a: ArrayOps) { a.reserveAux(5); a.clearAux(2, 5); } }, [3, 1, 2])).toThrow(RangeError);
    expect(() => trace({ run(a: ArrayOps) { a.reserveAux(AUX_CAP + 1); } }, [1])).toThrow(RangeError);
    expect(() => trace({ run(a: ArrayOps) { a.clearAux(2, 1); } }, [3, 1, 2])).toThrow(RangeError);
  });

  it('empties cells for free: recorded for the replay, not counted as writes', () => {
    const t = trace({
      run(a: ArrayOps) {
        a.reserveAux(6);
        for (let k = 0; k < 6; k++) a.setAux(k, k + 1);
        a.clearAux(1, 3);
      },
    }, [5, 4, 3, 2, 1]);
    expect(t.counts.auxWrites).toBe(6);
    expect(t.events[3 * (t.length - 1)]).toBe(OP.auxClear);
    expect(replayedAux(t)).toEqual([1, 0, 0, 0, 5, 6]);
  });
});

describe('array engine auxiliary row wider than its pixels', () => {
  /** The tallest key of each of `cols` columns, by brute force over the replayed row. */
  const columns = (aux: number[], cols: number) => {
    const out = new Array<number>(cols).fill(0);
    aux.forEach((v, k) => { const c = Math.floor((k * cols) / aux.length); out[c] = Math.max(out[c], v); });
    return out;
  };

  it('folds into one column per pixel, kept true as cells are written, overwritten and emptied', () => {
    const rnd = mulberry32(5);
    const cells = 5000;
    const t = trace({
      run(a: ArrayOps) {
        a.reserveAux(cells);
        for (let s = 0; s < 4000; s++) {
          const k = Math.floor(rnd() * cells);
          if (rnd() < 0.15) a.clearAux(k, Math.min(cells - 1, k + Math.floor(rnd() * 40)));
          else a.setAux(k, 1 + Math.floor(rnd() * 9));
        }
      },
    }, [1, 2, 3]);
    for (const cols of [7, 333, 1440]) {
      const r = new Replay(t);
      r.auxColumns(cols);
      while (!r.done) {
        r.advance(97);
        expect([...r.auxColumns(cols)], `${cols} columns at ${r.at}`).toEqual(columns(r.aux, cols));
      }
    }
  });

  it('draws at most one auxiliary bar per pixel column, however wide the row', () => {
    const wide: ArrayKernel = { run(a: ArrayOps) { a.reserveAux(AUX_CAP); for (let k = 0; k < AUX_CAP; k += 997) a.setAux(k, 1 + (k % 8)); } };
    const plate = engine.plate({ id: 'wide', title: 'wide', group: 'g' }, wide);
    const params: Params = {};
    for (const d of plate.params) params[d.key] = d.value;
    Object.assign(params, { n: 8, speed: 2000 });
    const { p, calls } = drawRecorder();
    const ctx: PlateContext = {
      width: 390, height: 220, params, seed: 3, rnd: mulberry32(3), theme: 'dark', bg: GROUNDS.dark.bg,
      fg: GROUNDS.dark.fg, thumbnail: false, palette: () => lookupPalette('spectral'), stats() {}, chart() {},
    };
    const sim = plate.create(p, ctx);
    sim.setup();
    for (let f = 0; f < 3; f++) sim.draw();
    calls.length = 0;
    sim.draw();
    const rects = calls.filter((c) => c.startsWith('rect(')).length;
    // the bars, the range and the row's ground, and no more auxiliary bars than pixels
    expect(rects).toBeLessThanOrEqual(8 + 2 + 390);
    expect(rects).toBeGreaterThan(8 + 100);
  });
});
