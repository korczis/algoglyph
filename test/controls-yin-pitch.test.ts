// The yin-pitch plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'yin-pitch';

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
 * The oracle, counted from the code: 1.5 s at 16 kHz is n = 24000 samples, frames of W samples
 * plus τmax = 400 at hop 256 fit ⌊(n − W − τmax)/256⌋ + 1 times, and each costs W·τmax multiplies
 * for the difference function and 2τmax for its normalisation.
 */
const frames = (w: number) => Math.floor((24000 - w - 400) / 256) + 1;
const multiplies = (w: number) => frames(w) * (w * 400 + 2 * 400);

describe('yin-pitch: w, "Analysis window W"', () => {
  it('is a select of 256, 384 and 512 samples, 512 by default', async () => {
    const d = (await defs()).find((x) => x.key === 'w');
    expect(d).toMatchObject({ kind: 'select', label: 'Analysis window W', value: '512' });
    expect(d?.kind === 'select' ? d.options.map((o) => o.value) : []).toEqual(['256', '384', '512']);
  });

  it('round-trips through the URL', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.w = '256';
    expect(parse(all, serialise(all, params, 7)).params.w).toBe('256');
  });

  it('costs exactly W·τmax + 2τmax multiplies per frame', async () => {
    expect(await reading('Real multiplies', {})).toBe(multiplies(512));
    for (const w of [256, 384]) {
      expect(await reading('Frames', { w: String(w) }), `W = ${w}`).toBe(frames(w));
      expect(await reading('Real multiplies', { w: String(w) }), `W = ${w}`).toBe(multiplies(w));
    }
  });
});
