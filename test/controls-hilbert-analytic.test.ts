// The hilbert-analytic plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'hilbert-analytic';

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

describe('hilbert-analytic: periodic, "Carrier on a whole bin"', () => {
  it('is a toggle, on by default', async () => {
    const d = (await defs()).find((x) => x.key === 'periodic');
    expect(d).toMatchObject({ kind: 'toggle', label: 'Carrier on a whole bin', value: true });
  });

  it('round-trips through the URL when off', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.periodic = false;
    expect(parse(all, serialise(all, params, 7)).params.periodic).toBe(false);
  });

  it('snaps the carrier to a whole bin only when on', async () => {
    // one bin is 8000/4096 = 1.953125 Hz: 600 Hz rounds to bin 307, 599.609375 Hz
    expect(await reading('Carrier, AM and FM rates', {})).toBe(599.61);
    expect(await reading('Carrier, AM and FM rates', { periodic: false })).toBe(600);
  });

  it('keeps |z| on the envelope to rounding when on, and not when off', async () => {
    // the rounding bound of the claims: 4.0e-12 at 600 Hz (catalogue/entries/hilbert-analytic.md)
    expect(await reading('Envelope RMS error', {})).toBeLessThan(4.0e-12);
    expect(await reading('Envelope RMS error', { periodic: false })).toBeGreaterThan(4.0e-12);
  });
});
