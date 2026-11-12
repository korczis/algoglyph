// catalogue/entries/bin-packing.md: the plate searches for the optimum exactly "only on small
// inputs". Above that size the readout `Optimum (exact search)` must show no number at all: a
// claim reads a readout's first number, and "searched only up to 12 items" would read as an
// optimum of 12 bins.
import { describe, expect, it } from 'vitest';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const optimum = (n: number): Claim => ({
  id: `optimum-${n}`, statement: `the exact optimum readout for ${n} items`,
  readout: 'Optimum (exact search)', expect: { above: 0 }, setup: { params: { n } },
});

describe('bin-packing Optimum (exact search)', () => {
  it('shows no digit when there are too many items for the exact search', async () => {
    const r = await read('bin-packing', optimum(48));
    expect(r.value, `readout text: ${r.text}`).toBeUndefined();
    expect(r.text).toBeDefined();
    expect(r.text as string).not.toMatch(/\d/);
  }, 120_000);

  it('still shows the optimum as a bin count on 12 items', async () => {
    const r = await read('bin-packing', optimum(12));
    expect(r.reason).toBeUndefined();
    expect(r.text).toMatch(/^\d+$/);
    expect(r.value as number).toBeGreaterThan(0);
  }, 120_000);
});
