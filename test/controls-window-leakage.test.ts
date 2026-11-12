// The window-leakage plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'window-leakage';

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

// The oracle: Harris (1978), the highest side lobe and −3 dB width of the classic windows. The
// tolerances: the 16× zero-padded grid misses a lobe's top by at most 1/32 bin (≤ 0.03 dB, and
// ≤ 0.002 bin on the −3 dB crossing), the finite-N Dirichlet kernel departs from the table's
// large-N value as 1/N² (0.06 dB for Hamming at N = 128, 0.23 dB at N = 64), and both the
// readout (0.1 dB, 0.01 bin) and the table (0.01 dB, 0.01 bin) are rounded.
const SIDE_TOL = 0.2;
const WIDTH_TOL = 0.015;

describe('window-leakage: n, "Window length N"', () => {
  it('is a select of 64 and 128 samples, 64 by default', async () => {
    const d = (await defs()).find((x) => x.key === 'n');
    expect(d).toMatchObject({ kind: 'select', label: 'Window length N', value: '64' });
    expect(d?.kind === 'select' ? d.options.map((o) => o.value) : []).toEqual(['64', '128']);
  });

  it('round-trips through the URL', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.n = '128';
    expect(parse(all, serialise(all, params, 7)).params.n).toBe('128');
  });

  it('reads the published lobes at N = 128, and Hamming’s side lobe moves onto the table', async () => {
    expect(Math.abs(await reading('Highest side lobe (measured)', { n: '128', window: 'hann' }) + 31.47)).toBeLessThanOrEqual(SIDE_TOL);
    expect(Math.abs(await reading('Main lobe −3 dB width', { n: '128', window: 'hann' }) - 1.44)).toBeLessThanOrEqual(WIDTH_TOL);
    expect(Math.abs(await reading('Main lobe −3 dB width', { n: '128', window: 'blackman-harris' }) - 1.9)).toBeLessThanOrEqual(WIDTH_TOL);
    const at128 = await reading('Highest side lobe (measured)', { n: '128', window: 'hamming' });
    const at64 = await reading('Highest side lobe (measured)', { window: 'hamming' });
    expect(Math.abs(at128 + 42.68)).toBeLessThanOrEqual(SIDE_TOL);
    expect(Math.abs(at64 + 42.68)).toBeGreaterThan(Math.abs(at128 + 42.68));
  });
});
