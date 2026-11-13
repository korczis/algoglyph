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

/** Mean index of coincidence of the columns i mod L for L = 1 … top, from the ciphertext alone,
 * written here (index 0 unused, 0, as on the plate's chart). */
function ioc(ct: string, top: number): number[] {
  const out = [0];
  for (let L = 1; L <= top; L++) {
    let s = 0;
    for (let c = 0; c < L; c++) {
      const f = new Array<number>(26).fill(0);
      let m = 0;
      for (let i = c; i < ct.length; i += L) { f[ct.charCodeAt(i) - 65]++; m++; }
      s += m > 1 ? f.reduce((t, x) => t + x * (x - 1), 0) / (m * (m - 1)) : 0;
    }
    out.push(s / L);
  }
  return out;
}
/** The oracle's choice: the smallest L whose mean IoC is at least `within` of the best. */
const choose = (v: number[], within: number) => { const best = Math.max(...v); return v.findIndex((x, L) => L > 0 && x >= within * best); };

describe('vigenere-cipher: share of the best index of coincidence', () => {
  it('is a range control with the old constant 0.9 as its default', () => {
    expect(defOf('within')).toMatchObject({ kind: 'range', label: 'Take L within (share of best)', min: 0.5, max: 1, step: 0.05, value: 0.9, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const w of [0.5, 0.75, 1]) expect(parse(defs, serialise(defs, { ...d, within: w }, 7)), `${w}`).toEqual({ seed: 7, params: { within: w } });
  });

  it('takes the smallest length within that share of the best, never longer at a smaller share', () => {
    const d = defOf('within');
    expect(d, 'the plate declares the control').toBeDefined();
    for (const x of inputs()) {
      const n = x.plaintext.length;
      const v = ioc((trace(kernel, x, {}).result as R).ciphertext, Math.min(16, Math.floor(n / 4)));
      let last = 0;
      for (const within of settings(d!)) {
        const t = trace(kernel, x, { within });
        const r = t.result as R;
        const at = `within=${within} n=${n}`;
        expect(r.length, at).toBe(choose(v, within));
        expect(r.length, `${at}: a larger share never takes a shorter length`).toBeGreaterThanOrEqual(last);
        last = r.length;
        if (within === 1) expect(v[r.length], at).toBe(Math.max(...v));
        // the tallies do not depend on which length is taken
        expect(t.counts[1], at).toBe(n * Math.min(16, Math.floor(n / 4)) + n);
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const x = input('cipher', N, '', SEED);
    const v = ioc((trace(kernel, x, {}).result as R).ciphertext, Math.min(16, Math.floor(N / 4)));
    for (const within of [0.5, 1]) {
      const L = await read(ID, claim('Key length found', { within }));
      expect(L.reason).toBeUndefined();
      expect(L.value, `within=${within}`).toBe(choose(v, within));
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
    expect(runs({ lmax: 16, within: 0.9 })).toEqual(absent);
  });
});
