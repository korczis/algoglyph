// The avalanche matrix runs to a total-trials budget and then holds still, so its readouts settle
// and the claims instrument (ADR 0007) can read them: the trials readout is the budget exactly,
// also when the trials per frame do not divide it.
import { describe, expect, it } from 'vitest';
import { defaults } from '../src/core/plate';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const probe = (params: Record<string, string | number | boolean>): Claim => ({
  id: 'budget', statement: 'the trials readout at the budget', readout: 'trials',
  expect: { range: [0, Number.MAX_SAFE_INTEGER] }, setup: { params },
});

describe('hash-avalanche trials budget', () => {
  it('has a budget parameter with a default inside its range', async () => {
    const plate = await loadPlate('hash-avalanche');
    const def = plate?.params.find((d) => d.key === 'budget');
    expect(def?.kind).toBe('range');
    if (def?.kind !== 'range') return;
    expect(def.value).toBeGreaterThanOrEqual(def.min);
    expect(def.value).toBeLessThanOrEqual(def.max);
  });

  it('settles at the default budget, with the trials readout equal to it', async () => {
    const plate = await loadPlate('hash-avalanche');
    const budget = Number(defaults(plate!).budget);
    const r = await read('hash-avalanche', probe({}));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(budget);
  }, 120_000);

  it('stops exactly at a budget the trials per frame do not divide', async () => {
    for (const fn of ['sha256', 'fnv1a']) {
      const r = await read('hash-avalanche', probe({ fn, trials: 48, budget: 16_384 }));
      expect(r.reason, fn).toBeUndefined();
      expect(r.value, fn).toBe(16_384);
    }
  }, 120_000);
});
