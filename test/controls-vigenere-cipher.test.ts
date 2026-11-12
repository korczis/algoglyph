// The Vigenère attack's longest key tried becomes a control (S2 B10): candidate key lengths ran
// from 1 to 16 (and Kasiski's factors from 2 to 16); now to the control lmax (2 to 16, default
// 16). Checked: the control exists, it travels in a shared link, it drives the readouts (n
// letters tallied per candidate length and n more for the key's columns, so
// n · min(lmax, ⌊n/4⌋) + n exactly; the key length found is at most lmax), and the kernel's
// default trace is what it was before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS } from '../src/engines/string/inputs';
import { trace } from '../src/engines/string/trace';
import { kernel } from '../src/kernels/string/vigenere-cipher';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'vigenere-cipher';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.cipher.size.value;
type R = { ciphertext: string; length: number; key: string };

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => Number((d.min + i * d.step).toFixed(10)));
const defOf = (key: string) => plate().params.find((x) => x.key === key) as RangeParam | undefined;
const inputs = () => [60, N, 1500].flatMap((n) => [1, 2, 3, SEED].map((seed) => input('cipher', n, '', seed)));

describe('vigenere-cipher: longest key tried', () => {
  it('is a range control with the old constant 16 as its default', () => {
    expect(defOf('lmax')).toMatchObject({ kind: 'range', label: 'Longest key tried', min: 2, max: 16, step: 1, value: 16, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const l of [2, 7, 15]) expect(parse(defs, serialise(defs, { ...d, lmax: l }, 7)), `${l}`).toEqual({ seed: 7, params: { lmax: l } });
  });

  it('tallies n · min(lmax, ⌊n/4⌋) + n letters and finds a length of at most lmax, at every setting', () => {
    const d = defOf('lmax');
    expect(d, 'the plate declares the control').toBeDefined();
    for (const lmax of settings(d!)) {
      for (const x of inputs()) {
        const n = x.plaintext.length;
        const t = trace(kernel, x, { lmax });
        const r = t.result as R;
        const at = `lmax=${lmax} n=${n}`;
        expect(t.counts[0], at).toBe(n);
        expect(t.counts[1], at).toBe(n * Math.min(lmax, Math.floor(n / 4)) + n);
        expect(r.length, at).toBeGreaterThanOrEqual(1);
        expect(r.length, at).toBeLessThanOrEqual(lmax);
        // the encryption does not depend on the attack
        expect(r.ciphertext, at).toBe((trace(kernel, x, {}).result as R).ciphertext);
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const n = input('cipher', N, '', SEED).plaintext.length;
    for (const lmax of [4, 8]) {
      const c = await read(ID, claim('Letters tallied', { lmax }));
      expect(c.reason).toBeUndefined();
      expect(c.value, `lmax=${lmax}`).toBe(n * Math.min(lmax, Math.floor(n / 4)) + n);
      const L = await read(ID, claim('Key length found', { lmax }));
      expect(L.value!, `lmax=${lmax}`).toBeLessThanOrEqual(lmax);
    }
  });
});

describe('vigenere-cipher at its defaults is what it was before the controls', () => {
  // recorded on the code before the controls existed (779097a): every event and count
  const TRACES = 'ed285e0eb5485cfd';
  const runs = (extra: Params) => inputs().map((x) => {
    const t = trace(kernel, x, extra);
    return [t.counts, hash(t.events.toArray())];
  });

  it('records the same trace, with the defaults passed or absent', () => {
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ lmax: 16 })).toEqual(absent);
  });
});
