// bin-packing's largest crumb becomes a control (S3 C3): the halves stream alternates a half of a
// bin (50) with a crumb of 1..crumb, the old constant 3. Checked: the control exists with the old
// constant as its default, it travels in a shared link, it drives what the plate reads (next fit
// one bin per half at every crumb, first fit decreasing n/4 + 1 while the crumbs fit one bin and
// never below n/4 + ⌈Σ crumbs / 100⌉), and every stream at the defaults is what it was.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { ALGORITHMS, CAPACITY, items, pack, SHAPES } from '../src/plates/bin-packing/packing';
import { binPacking } from '../src/plates/bin-packing/plate';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const KEY = 'crumb';
const SEEDS = [1, 7, 42, 4242];
/** The plate's step of n: every size it offers. */
const SIZES = Array.from({ length: (256 - 8) / 4 + 1 }, (_, i) => 8 + 4 * i);

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = () => binPacking.params.find((d) => d.key === KEY) as RangeParam | undefined;
const halves = (n: number, seed: number, crumb: number) =>
  (items as (s: string, n: number, seed: number, c?: number) => number[])('halves', n, seed, crumb);

const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

describe('bin-packing: largest crumb', () => {
  it('is a range control with the old constant as its default, shown for the halves', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'Largest crumb (halves)', min: 1, max: 49, step: 1, value: 3, rebuild: true,
      when: { key: 'shape', values: ['halves'] },
    });
  });

  it('round-trips through a shared link', () => {
    const defs = binPacking.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const c of [1, 4, 25, 49]) {
      expect(parse(defs, serialise(defs, { ...d, shape: 'halves', [KEY]: c }, 7)))
        .toEqual({ seed: 7, params: { shape: 'halves', [KEY]: c } });
    }
  });

  it('sets the crumbs, and the bins follow the oracle, at every setting and size', () => {
    expect(defOf(), 'the plate declares the control').toBeDefined();
    for (const c of settings(defOf()!)) {
      for (const n of SIZES) {
        for (const seed of SEEDS) {
          const s = halves(n, seed, c);
          s.forEach((x, i) => {
            if (i % 2 === 0) expect(x).toBe(CAPACITY / 2);
            else { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(c); }
          });
          const crumbs = s.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
          // a half plus a crumb fits (50 + c ≤ 99), the next half never does (≥ 101): one bin per half
          expect(pack('next-fit', s).loads.length, `next fit c=${c} n=${n}`).toBe(n / 2);
          const ffd = pack('first-fit-decreasing', s).loads.length;
          // the halves pair into n/4 full bins no crumb enters; the crumbs need ⌈Σ / 100⌉ more
          expect(ffd, `ffd c=${c} n=${n}`).toBeGreaterThanOrEqual(n / 4 + Math.ceil(crumbs / CAPACITY));
          if ((n / 2) * c <= CAPACITY) expect(ffd, `ffd c=${c} n=${n}`).toBe(n / 4 + 1);
        }
      }
    }
    // the control reaches past the old constant: some crumb above 3 at 49
    expect(Math.max(...halves(48, 4242, 49))).toBeGreaterThan(3);
  });

  it('drives the readouts', async () => {
    for (const c of [1, 4, 49]) {
      const nf = await read('bin-packing', claim('Next fit', { shape: 'halves', [KEY]: c }));
      expect(nf.reason).toBeUndefined();
      expect(nf.value, `next fit c=${c}`).toBe(24);
    }
    // 24 crumbs of at most 4 weigh at most 96: one bin after the 12 pairs of halves
    const ffd = await read('bin-packing', claim('First fit decreasing', { shape: 'halves', [KEY]: 4 }));
    expect(ffd.reason).toBeUndefined();
    expect(ffd.value).toBe(13);
    // here the lower bound is n/4 + ⌈Σ crumbs / 100⌉ exactly, since the halves weigh 25 n
    const lb = await read('bin-packing', claim('First fit decreasing', { shape: 'halves', [KEY]: 49 },
      { against: 'Lower bound ⌈Σ size / capacity⌉', above: -1 }));
    expect(lb.reason).toBeUndefined();
    expect(lb.value!).toBeGreaterThanOrEqual(0);
    const items49 = await read('bin-packing', claim('Items', { shape: 'halves', [KEY]: 49 }));
    expect(items49.reason).toBeUndefined();
    // the total size: 24 halves of 50 and the crumbs the stream draws at the claims' seed
    const total = halves(48, 4242, 49).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(24 * 51);
    expect(Number(items49.text!.match(/total size ([\d,]+)/)![1].replace(/,/g, ''))).toBe(total);
  });
});

describe('bin-packing at its defaults is what it was before the control', () => {
  // integers only (every stream's sizes and every heuristic's packing), recorded on the code
  // before the control existed (main 23b65ad)
  const STREAMS = 'c05c5d39a3b5736f';
  const record = (crumb?: number) => SHAPES.flatMap((shape) => [8, 12, 48, 256].flatMap((n) => SEEDS.map((seed) => {
    const s = crumb === undefined ? items(shape, n, seed)
      : (items as (s: string, n: number, seed: number, c?: number) => number[])(shape, n, seed, crumb);
    return [shape, n, seed, s, ALGORITHMS.map((a) => { const p = pack(a, s); return [p.loads, p.tests, p.compares]; })];
  })));

  it('draws the same items and packs them the same', () => {
    expect(hash(record())).toBe(STREAMS);
  });

  it('the explicit default draws as no param does', () => {
    expect(record(3)).toEqual(record());
  });
});
