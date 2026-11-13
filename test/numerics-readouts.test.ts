// The numerics readouts that claims read (ADR 0007), each checked here against an oracle computed
// independently of the plate: the plate runs headless through the claims instrument until it
// settles, and the readout's first number is compared with the oracle's value.
import { describe, expect, it } from 'vitest';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

/** The settled first number of `readout` on plate `id` with `params`, or a failed expectation. */
async function reading(id: string, readout: string, params: Record<string, unknown> = {}, seed?: number) {
  const c: Claim = {
    id: 'probe', statement: 'a probe of a numerics readout', readout, expect: { above: -Infinity },
    setup: { params: params as never, ...(seed === undefined ? {} : { seed }) },
  };
  const r = await read(id, c);
  expect(r.reason, `${id}: ${readout}`).toBeUndefined();
  return { value: r.value as number, text: r.text as string };
}

describe('horner-evaluation publishes its additions', () => {
  // Horner's rule b_k = b_{k+1}·x + a_k: one addition per coefficient below the leading one
  const hornerAdds = (d: number) => {
    let adds = 0;
    for (let k = d - 1; k >= 0; k--) adds++;
    return adds;
  };
  for (const d of [2, 9, 16]) {
    it(`counts ${d} additions for one evaluation at degree ${d}`, async () => {
      const r = await reading('horner-evaluation', 'Additions this evaluation', { degree: d });
      expect(r.value).toBe(hornerAdds(d));
    }, 120_000);
  }
});
