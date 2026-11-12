// The noise-colours plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'noise-colours';

async function defs(): Promise<ParamDef[]> {
  const plate = await loadPlate(ID);
  if (!plate) throw new Error(`${ID} has no plate`);
  return plate.params;
}

async function reading(readout: string, params: Params): Promise<number> {
  const claim: Claim = { id: 'probe', statement: 'a control probe', readout, expect: { value: 0 }, setup: { params } };
  const r = await read(ID, claim);
  expect(r.reason).toBeUndefined();
  return r.value as number;
}

/**
 * The oracle: the AR(1) power |1/(1 − a e^{−iω})|² = 1/(1 − 2a cos ω + a²) at each bin of a
 * 1024-sample frame at 8 kHz, averaged over the plate's third-octave bands from 50 Hz to 1.6 kHz,
 * in dB, and fitted by least squares against log2 of the band centres.
 */
function arSlope(a: number): number {
  const fs = 8000; const m = 1024; const df = fs / m;
  const xs: number[] = []; const ys: number[] = [];
  for (let lo = 50; lo * 2 ** (1 / 3) <= 1600 * 1.0001; lo *= 2 ** (1 / 3)) {
    const hi = lo * 2 ** (1 / 3);
    let s = 0; let c = 0;
    for (let k = Math.ceil(lo / df); k * df < hi; k++, c++) s += 1 / (1 - 2 * a * Math.cos((2 * Math.PI * k) / m) + a * a);
    xs.push(Math.log2(Math.sqrt(lo * hi))); ys.push(10 * Math.log10(s / c));
  }
  const mx = xs.reduce((p, q) => p + q, 0) / xs.length;
  const my = ys.reduce((p, q) => p + q, 0) / ys.length;
  let sxy = 0; let sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  return sxy / sxx;
}

/** 5σ of the Welch fit (σ = 0.039 dB/octave over 191 frames), the window's bias and rounding. */
const TOLERANCE = 0.21;

describe('noise-colours: leak, "Brown noise leak a"', () => {
  it('is a range 0.9 … 0.999 by 0.001, 0.998 by default', async () => {
    const d = (await defs()).find((x) => x.key === 'leak');
    expect(d).toMatchObject({ kind: 'range', label: 'Brown noise leak a', min: 0.9, max: 0.999, step: 0.001, value: 0.998 });
  });

  it('round-trips through the URL', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.leak = 0.95;
    expect(parse(all, serialise(all, params, 7)).params.leak).toBe(0.95);
  });

  it('sets the brown slope the AR(1) spectrum predicts', async () => {
    for (const a of [0.9, 0.95]) {
      const got = await reading('brown slope (measured)', { leak: a });
      expect(Math.abs(got - arSlope(a)), `a = ${a}: read ${got}, predicted ${arSlope(a)}`).toBeLessThanOrEqual(TOLERANCE);
    }
    // the leak shallows the slope: at 0.9 the corner (1 − a)·fs/2π ≈ 127 Hz sits inside the fit
    expect(arSlope(0.9)).toBeGreaterThan(arSlope(0.998) + 1);
  });
});
