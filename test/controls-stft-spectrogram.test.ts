// The stft-spectrogram plate's controls (S5): each exists with its default, travels in a shared
// link, and drives the readouts the way the oracle predicts. Counted and read, never timed.
import { describe, expect, it } from 'vitest';
import type { ParamDef, Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'stft-spectrogram';

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

/** The oracle: frames of M samples at hop H fit ⌊(n − M)/H⌋ + 1 times in n samples, no padding. */
const frames = (n: number, m: number, h: number) => Math.floor((n - m) / h) + 1;

describe('stft-spectrogram: len, "Signal length (samples)"', () => {
  it('is a select of 4000, 8000 and 16000 samples, 16000 by default', async () => {
    const d = (await defs()).find((x) => x.key === 'len');
    expect(d).toMatchObject({ kind: 'select', label: 'Signal length (samples)', value: '16000' });
    expect(d?.kind === 'select' ? d.options.map((o) => o.value) : []).toEqual(['4000', '8000', '16000']);
  });

  it('round-trips through the URL', async () => {
    const all = await defs();
    const params: Params = Object.fromEntries(all.map((d) => [d.key, d.value]));
    params.len = '4000';
    expect(parse(all, serialise(all, params, 7)).params.len).toBe('4000');
  });

  it('transforms exactly ⌊(n − M)/H⌋ + 1 frames', async () => {
    expect(await reading('Frames', { len: '4000' })).toBe(frames(4000, 256, 128));
    expect(await reading('Frames', { len: '8000' })).toBe(frames(8000, 256, 128));
    expect(await reading('Frames', { len: '4000', frame: '1024', overlap: '0.75' })).toBe(frames(4000, 1024, 256));
  });
});
