// recurrence-plot's shortest line counted becomes a control: recurrence quantification counted
// diagonal and vertical lines of two points or more, a fixed 2 (catalogue/entries/recurrence-plot.md:
// "diagonal lines of length two or more"). The control changes only which lines the quantification
// counts, never the series, the threshold or the matrix, so the default is the old run. Checked:
// the control exists with the old constant as its default, travels in a shared link, and drives
// the readouts: on the sine of period 23, counting lines of 23 points or more keeps exactly the
// full lines at the multiples of the period, 1,806 of the 3,588 recurrent pairs, and counting lines
// longer than the longest (277) keeps none.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { kernel, rqa } from '../src/kernels/numeric/recurrence-plot';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'recurrence-plot';
const defOf = (key: string) => kernel.params?.find((d) => d.key === key);
const probe = (readout: string, params: Params, seed = 4242): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { above: -1 }, setup: { params: params as Record<string, number>, seed } });

async function roundTrip(key: string, values: number[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

/** The sine's matrix as the plate draws it, recomputed by the kernel's own rqa at a given lmin. */
function sineMatrix(): { R: Uint8Array; n: number } {
  const run = kernel.run({ seed: 4242, params: { series: 'sine' } } as never);
  const grid = run.steps[run.steps.length - 1].layers[0] as unknown as { values: Float64Array; rows: number };
  const R = new Uint8Array(grid.values.length);
  grid.values.forEach((v, i) => { R[i] = v > 0 ? 1 : 0; });
  return { R, n: grid.rows };
}

describe('recurrence-plot: shortest line counted', () => {
  const KEY = 'lmin';

  it('is a range control with the old constant as its default', () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'range', min: 2, max: 399, step: 1, value: 2, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    await roundTrip(KEY, [3, 23, 399]);
  });

  it('leaves the default run as it was: an explicit 2 is the run without the parameter', () => {
    for (const series of ['regime', 'sine', 'noise']) {
      const a = kernel.run({ seed: 4242, params: { series } } as never);
      const b = kernel.run({ seed: 4242, params: { series, [KEY]: 2 } } as never);
      expect(b.steps.map((s) => s.stats)).toEqual(a.steps.map((s) => s.stats));
    }
  });

  it('drives the readouts: lines of 23 points or more on the sine are the period\'s full lines', async () => {
    const { R, n } = sineMatrix();
    // offsets 23, 46, …, 276 carry full lines of 300 − 23j points; offset 299 holds a single point
    let full = 0;
    for (let j = 1; 23 * j < n; j++) if (n - 23 * j >= 23) full += n - 23 * j;
    expect(full).toBe(1806);
    const q = rqa(R, n, n, 23);
    expect(q.det).toBeCloseTo(full / 3588, 12);
    const det = await read(ID, probe('Determinism', { series: 'sine', [KEY]: 23 }));
    expect(det.reason).toBeUndefined();
    expect(det.value).toBe(Number((100 * full / 3588).toPrecision(3)));
    const none = await read(ID, probe('Determinism', { series: 'sine', [KEY]: 278 }));
    expect(none.value).toBe(0);
  });
});
