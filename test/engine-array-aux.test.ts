// The array engine's auxiliary row: reserveAux widens it, clearAux empties cells for free, and
// both are recorded so a replay draws the row the kernel left, cell by cell.
import { describe, expect, it } from 'vitest';
import { apply, AUX_CAP, OP, trace, type ArrayOps } from '../src/engines/array/trace';

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
