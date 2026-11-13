// The share of corrupted IČO numbers becomes a control (S2 A5): each seeded number was corrupted
// with probability 0.4 (one digit changed, or two adjacent digits swapped); now the probability
// is 0 to 1 in steps of 0.05, 0.4 the default, the same random number drawn for it at any rate.
// Checked: the control exists with its old default, it travels in a shared link, and at every
// rate no intact number fails (the generator's check digit is computed apart from the kernel's),
// a rate of 0 corrupts nothing, and the caught count is what an independent check digit finds.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/ico-check-digit';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'ico-check-digit';
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel as StringKernel as never);
};
const SEED = 4242;
const RATES = Array.from({ length: 21 }, (_, i) => Math.round(i * 5) / 100);

/** The IČO check, written here from its definition: weights 8..2, (11 − Σ mod 11) mod 10. */
const valid = (num: string) => {
  const d = [...num].map(Number);
  const s = d.slice(0, 7).reduce((a, x, i) => a + x * (8 - i), 0);
  return (11 - (s % 11)) % 10 === d[7];
};
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params } });

describe('ico-check-digit: share corrupted', () => {
  it('is a range control, the old 0.4 its default', () => {
    const d = plate().params.find((x) => x.key === 'corrupt') as RangeParam | undefined;
    expect(d).toMatchObject({ kind: 'range', label: 'Share corrupted', min: 0, max: 1, step: 0.05, value: 0.4, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 0.15, 0.85, 1]) expect(parse(defs, serialise(defs, { ...d, corrupt: v }, 7))).toEqual({ seed: 7, params: { corrupt: v } });
  });

  it('never fails an intact number, and corrupts none at 0, at every rate', () => {
    for (const rate of RATES) {
      for (const n of [4, 12, 48]) {
        for (const seed of [1, 2, 3, SEED]) {
          const x = input('ico', n, '', seed, { corrupt: rate });
          const tag = `rate ${rate} n=${n} seed=${seed}`;
          const ok = trace(kernel, x, { corrupt: rate }).result as boolean[];
          expect(ok, tag).toEqual(x.numbers.map(valid));
          x.corrupted.forEach((bad, k) => { if (!bad) expect(ok[k], `${tag} #${k}`).toBe(true); });
          if (rate === 0) expect(x.corrupted.some(Boolean), tag).toBe(false);
        }
      }
    }
    // the share drawn follows the rate: none at 0, most at 1 (a swap of equal digits stays intact)
    const share = (rate: number) => [1, 2, 3, SEED].reduce((s, seed) => s + input('ico', 48, '', seed, { corrupt: rate }).corrupted.filter(Boolean).length, 0) / (4 * 48);
    expect(share(0)).toBe(0);
    expect(share(1)).toBeGreaterThan(0.8);
  });

  it('drives the plate\'s readouts', async () => {
    const n = KINDS.ico.size.value;
    for (const rate of [0, 1]) {
      const x = input('ico', n, '', SEED, { corrupt: rate });
      const caught = x.numbers.filter((num, k) => x.corrupted[k] && !valid(num)).length;
      const r = await read(ID, claim('Corrupted and caught', { corrupt: rate }));
      expect(r.reason).toBeUndefined();
      expect(r.value, `rate ${rate}`).toBe(caught);
      if (rate === 0) expect(caught).toBe(0);
      const f = await read(ID, claim('Intact but invalid', { corrupt: rate }));
      expect(f.value, `rate ${rate}`).toBe(0);
    }
  });
});
