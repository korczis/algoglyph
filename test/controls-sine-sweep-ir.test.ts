// The sine-sweep-ir plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'sine-sweep-ir';

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

/** The oracle: L = T / ln(f2/f1) with f1 = 20 Hz and f2 = 3.9 kHz (the kernel's sweep); the
 * second-order response leads the linear one by L·ln 2, here in milliseconds. */
const lead2 = (t: number) => (1000 * t * Math.log(2)) / Math.log(3900 / 20);

describe('sine-sweep-ir: sweepT, "Sweep length (s)"', () => {
  it('is a select of 0.5, 1 and 2 s, 2 by default', async () => {
    const d = (await defs()).find((x) => x.key === 'sweepT');
    expect(d).toMatchObject({ kind: 'select', label: 'Sweep length (s)', value: '2' });
    expect(d?.kind === 'select' ? d.options.map((o) => o.value) : []).toEqual(['0.5', '1', '2']);
  });

  it('round-trips through the URL', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.sweepT = '0.5';
    expect(parse(all, serialise(all, params, 7)).params.sweepT).toBe('0.5');
  });

  it('moves the second-order response to L·ln 2 = T·ln 2 / ln 195 early', async () => {
    for (const t of ['0.5', '1']) {
      const got = await reading('2nd-harmonic response: measured vs L·ln 2', { sweepT: t });
      // one sample at 8 kHz (0.125 ms) plus the readout's 0.1 ms rounding
      expect(Math.abs(got - lead2(Number(t))), `T = ${t}: read ${got}, predicted ${lead2(Number(t))}`).toBeLessThanOrEqual(0.25);
    }
  });
});
