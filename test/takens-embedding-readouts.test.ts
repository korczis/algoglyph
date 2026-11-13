// takens-embedding (catalogue/entries/takens-embedding.md): "for white noise it never does". The
// smallest dimension under 5% false neighbours is a number only when one is found: the plate once
// wrote "none up to 5 (…)", which a claim reads as 5, the same as finding m = 5.
import { describe, expect, it } from 'vitest';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'takens-embedding';
const LIST = 'False nearest neighbours, m = 1 … 5';
const probe = (readout: string, params: Record<string, string>, seed: number): Claim =>
  ({ id: 'probe', statement: 'a readout test reading', readout, expect: { above: -1 }, setup: { params, seed } });

describe('takens-embedding: no dimension found reads as no number', () => {
  it('on white noise the smallest dimension carries no digit, so no claim reads it as m = 5', async () => {
    for (const seed of [4242, 7, 1]) {
      const r = await read(ID, probe('Smallest m under 5% false neighbours', { signal: 'noise' }, seed));
      expect(r.value, `seed ${seed}: ${r.text}`).toBeUndefined();
      expect(r.reason, `seed ${seed}`).toMatch(/shows no number/);
      expect(r.text ?? '').not.toMatch(/\d/);
    }
  });

  it('on the Lorenz signal it reads the first dimension whose fraction is under 5%', async () => {
    for (const seed of [4242, 7]) {
      const list = await read(ID, probe(LIST, { signal: 'lorenz' }, seed));
      const fractions = [1, 2, 3, 4, 5].map((k) => nthNumber(list.text ?? '', k) as number);
      const dim = await read(ID, probe('Smallest m under 5% false neighbours', { signal: 'lorenz' }, seed));
      expect(dim.value, `seed ${seed}: ${list.text}`).toBe(fractions.findIndex((f) => f < 5) + 1);
    }
  });
});

