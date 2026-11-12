// The xcorr-alignment plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'xcorr-alignment';

async function defs(): Promise<ParamDef[]> {
  const plate = await loadPlate(ID);
  if (!plate) throw new Error(`${ID} has no plate`);
  return plate.params;
}

async function reading(readout: string, params: Params, seed?: number, against?: string): Promise<number> {
  const claim: Claim = { id: 'probe', statement: 'a control probe', readout, setup: { params, seed },
    expect: against ? { against, tolerance: 0 } : { value: 0 } };
  const r = await read(ID, claim);
  expect(r.reason).toBeUndefined();
  return r.value as number;
}

/**
 * The oracle, counted from the code: lags −L … L cost Σ (N − |l|) = (2L + 1)N − L(L + 1) multiplies
 * for N = 512, and the golden-section search evaluates the sinc interpolation 2 + 48 times at
 * 2(2L + 1) multiplies each, 100(2L + 1) more: (2L + 1)(N + 100) − L(L + 1) in all.
 */
const multiplies = (L: number) => (2 * L + 1) * (512 + 100) - L * (L + 1);

describe('xcorr-alignment: maxlag, "Largest lag searched"', () => {
  it('is a range 8 … 64 by 8, 64 by default', async () => {
    const d = (await defs()).find((x) => x.key === 'maxlag');
    expect(d).toMatchObject({ kind: 'range', label: 'Largest lag searched', min: 8, max: 64, step: 8, value: 64 });
  });

  it('round-trips through the URL', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.maxlag = 24;
    expect(parse(all, serialise(all, params, 7)).params.maxlag).toBe(24);
  });

  it('costs exactly (2L + 1)(N + 100) − L(L + 1) multiplies', async () => {
    expect(await reading('Real multiplies', {})).toBe(multiplies(64));
    for (const L of [8, 32]) expect(await reading('Real multiplies', { maxlag: L }), `L = ${L}`).toBe(multiplies(L));
  });

  it('finds the delay while it is inside the search, and cannot reach it outside', async () => {
    // seed 20 draws a delay of 19.4005 samples
    expect(await reading('True delay', {}, 20)).toBe(19.4005);
    expect(Math.abs(await reading('Integer peak', { maxlag: 24 }, 20, 'True delay'))).toBeLessThanOrEqual(0.5);
    // at L = 16 the peak is one of the lags searched, at most 16: short of the delay by 3.4 or more
    expect(await reading('Integer peak', { maxlag: 16 }, 20)).toBeLessThanOrEqual(16);
    expect(await reading('Integer peak', { maxlag: 16 }, 20, 'True delay')).toBeLessThan(-3.4);
  });
});
