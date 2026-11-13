// ach-matrix's share of bland evidence becomes a control (S4 C1): the synthetic case made an item
// fit every hypothesis alike (all N or all C) with probability 0.2, a default the plate never
// passed; it now passes `bland`, with the same draws in the same order, so 0.2 is the old case.
// Checked: the control exists with the old constant as its default, it travels in a shared link,
// it drives what the plate reads (at noise 0 a bland row is rated 0 or +1 for every hypothesis
// and every other row rates the true hypothesis 0, 1 or 2, so the true hypothesis scores 0 and
// ranks first at every setting; at bland 1 every row is bland, every score is 0 and all tie),
// and the default case is the one drawn before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { diagnosticity, inconsistency, standing, synthetic } from '../src/plates/ach-matrix/ach';
import { achMatrix } from '../src/plates/ach-matrix/plate';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const KEY = 'bland';
const ID = 'ach-matrix';
const SEEDS = [1, 7, 42, 4242];

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) =>
  Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => +(d.min + i * d.step).toFixed(10));
const defOf = () => achMatrix.params.find((d) => d.key === KEY) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

describe('ach-matrix: evidence that fits every hypothesis', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'Evidence that fits every hypothesis', min: 0, max: 1, step: 0.05, value: 0.2, rebuild: true,
    });
  });

  it('round-trips through a shared link', () => {
    const defs = achMatrix.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 0.35, 0.8, 1]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('at noise 0 the true hypothesis scores 0 and ranks first at every setting; at 1 all tie at 0', () => {
    expect(defOf(), 'the plate declares the control').toBeDefined();
    for (const b of settings(defOf()!)) {
      for (const seed of SEEDS) {
        for (const [k, e] of [[2, 3], [4, 12], [6, 24]]) {
          const rnd = mulberry32(seed);
          const truth = Math.floor(rnd() * k);
          const m = synthetic(rnd, k, e, truth, 0, b);
          const s = inconsistency(m);
          expect(s[truth], `b=${b} seed=${seed}`).toBe(0);
          expect(standing(s, truth).place).toBe(1);
          if (b === 1) {
            expect(s.every((x) => x === 0)).toBe(true);
            expect(m.cells.every((row) => diagnosticity(row) === 0)).toBe(true);
          }
          // a bland row is all 0 or all +1: it never adds to any score
          for (const row of m.cells) if (diagnosticity(row) === 0) expect(row[0]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('drives the readouts', async () => {
    for (const b of [0, 0.5, 1]) {
      const r = await read(ID, claim('Rank of the hypothesis the case was built on', { noise: 0, [KEY]: b }));
      expect(r.reason).toBeUndefined();
      expect(r.value, `rank at bland ${b}`).toBe(1);
    }
    const flat = await read(ID, claim('Items that fit every hypothesis alike', { [KEY]: 1 }));
    expect(flat.reason).toBeUndefined();
    expect(flat.value).toBe(12);
    const lead = await read(ID, claim('Lead over the runner-up', { [KEY]: 1 }));
    expect(lead.value).toBe(0);
    const none = await read(ID, claim('Items that fit every hypothesis alike', { [KEY]: 0 }));
    expect(none.value!).toBeLessThan(flat.value!);
  });
});

describe('ach-matrix at the default is the case it was before the control', () => {
  // strings only, recorded on the code before the control existed (5f091c7)
  const READOUTS = '65d3784037801857';
  const LABELS = ['Least contradicted', 'Lead over the runner-up', 'Items that fit every hypothesis alike',
    'Rank of the hypothesis the case was built on'];

  it('reads the same readouts at its default, and with the default passed explicitly', async () => {
    for (const seed of [1, 4242]) {
      const plain: (string | undefined)[] = [];
      const explicit: (string | undefined)[] = [];
      for (const readout of LABELS) {
        plain.push((await read(ID, { ...claim(readout, {}), setup: { seed } })).text);
        if (defOf()) explicit.push((await read(ID, { ...claim(readout, { [KEY]: 0.2 }), setup: { seed, params: { [KEY]: 0.2 } } })).text);
      }
      if (seed === 4242) expect(hash(plain), JSON.stringify(plain)).toBe(READOUTS);
      if (defOf()) expect(explicit).toEqual(plain);
    }
  });

  it('draws the same case with the default passed explicitly', () => {
    for (const seed of SEEDS) {
      const a = synthetic(mulberry32(seed), 4, 12, 1, 0.15);
      const b = synthetic(mulberry32(seed), 4, 12, 1, 0.15, 0.2);
      expect(b).toEqual(a);
    }
  });
});
