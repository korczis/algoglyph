// LZW's code width becomes a control and its text grows long enough to fill the dictionary (S2 A2,
// the owner's decision F1: the article's 12-bit cap must be reachable). The text input stopped at
// 1024 characters, where English prose learns about 700 phrases and the 4096 codes of 12 bits
// were never used up; the plate now offers up to 16384 characters, where prose fills them, and a
// code width of 9 to 12 bits (a dictionary of at most 2^w codes). The default stays 12 bits and
// 120 characters. Checked: both controls exist with their old defaults, they travel in a shared
// link, and at every width the codes are an independent encoder's, the dictionary holds
// min(2^w, 256 + phrases learned) codes, and a full dictionary shows exactly 2^w entries.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { kernel as bpe } from '../src/kernels/string/bpe-tokenisation';
import { kernel } from '../src/kernels/string/lzw-compression';
import { kernel as rle } from '../src/kernels/string/run-length-encoding';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'lzw-compression';
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel as StringKernel as never);
};
const WIDTHS = ['9', '10', '11', '12'];
const SEED = 4242;

/** LZW written here from its definition, never imported: the codes of `text`'s UTF-8 bytes and
 * the dictionary's final size, at most `cap` codes. */
function encode(text: string, cap: number): { codes: number[]; size: number; bits: number } {
  const bytes = Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b));
  const dict = new Map<string, number>();
  for (let c = 0; c < 256; c++) dict.set(String.fromCharCode(c), c);
  const codes: number[] = [];
  let bits = 0;
  // each code at the width of the largest code the decoder may see next, 9 bits at least
  const put = (code: number) => { codes.push(code); bits += Math.max(9, Math.ceil(Math.log2(Math.min(cap, dict.size + 1)))); };
  let w = '';
  for (const c of bytes) {
    if (dict.has(w + c)) { w += c; continue; }
    put(dict.get(w)!);
    if (dict.size < cap) dict.set(w + c, dict.size);
    w = c;
  }
  if (w) put(dict.get(w)!);
  return { codes, size: dict.size, bits };
}
/** The decoder, one step behind the encoder, with the same cap. */
function decode(codes: number[], cap: number): string {
  const dict: string[] = Array.from({ length: 256 }, (_, c) => String.fromCharCode(c));
  if (!codes.length) return '';
  let w = dict[codes[0]]; let out = w;
  for (const c of codes.slice(1)) {
    const e = c < dict.length ? dict[c] : w + w[0];
    out += e;
    if (dict.length < cap) dict.push(w + e[0]);
    w = e;
  }
  return out;
}
const latin1 = (text: string) => Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join('');
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params } });

describe('lzw-compression: code width', () => {
  it('is a select control, 12 bits its default', () => {
    const d = plate().params.find((x) => x.key === 'width') as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Code width', value: '12', rebuild: true });
    expect(d!.options.map((o) => o.value)).toEqual(WIDTHS);
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const w of ['9', '10', '11']) {
      expect(parse(defs, serialise(defs, { ...d, width: w }, 7))).toEqual({ seed: 7, params: { width: w } });
    }
  });

  it('caps the dictionary at 2^w codes, the codes an independent encoder\'s', () => {
    for (const w of WIDTHS) {
      const cap = 2 ** Number(w);
      for (const shape of ['prose', 'repetitive', 'runs']) {
        for (const n of [120, 1024, 4096, 16384]) {
          const x = input('text', n, shape, SEED);
          const t = trace(kernel, x, { width: w });
          const want = encode(x.text, cap);
          const tag = `${w} bits ${shape} n=${n}`;
          expect(t.result, tag).toEqual(want.codes);
          expect(decode(t.result as number[], cap), tag).toBe(latin1(x.text));
          expect(Math.max(...(t.result as number[])), tag).toBeLessThan(cap);
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    // English prose fills 9 bits within 1024 characters and 12 bits within 16384
    for (const [w, n] of [[9, 1024], [10, 4096], [12, 16384]]) {
      const p = { shape: 'prose', n, width: String(w) };
      const r = await read(ID, claim('Dictionary entries', p));
      expect(r.reason, `${w} bits`).toBeUndefined();
      expect(r.value, `${w} bits n=${n}: full`).toBe(2 ** w);
      const want = encode(input('text', n, 'prose', SEED).text, 2 ** w);
      expect(want.size).toBe(2 ** w);
      const bits = await read(ID, claim('Output / input', p));
      expect(bits.value, `${w} bits n=${n}`).toBe(want.bits);
      // at 9 bits every code is 9 bits wide
      if (w === 9) expect(bits.value).toBe(9 * want.codes.length);
    }
  }, 120_000);
});

describe('lzw-compression: text length', () => {
  it('reaches 16384 characters on this plate only, the default unchanged', () => {
    const d = plate().params.find((x) => x.key === 'n') as RangeParam | undefined;
    expect(d).toMatchObject({ kind: 'range', min: 16, max: 16384, step: 8, value: 120 });
    // the other plates of the text input keep its 1024
    for (const [id, k] of [['run-length-encoding', rle], ['bpe-tokenisation', bpe]] as const) {
      const e = ENTRIES.find((x) => x.id === id)!;
      const defs = engine.plate({ id, title: e.title, group: e.taxonomy }, k as StringKernel as never).params;
      expect(defs.find((x) => x.key === 'n'), id).toMatchObject({ max: 1024 });
    }
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, n: 16384 }, 7))).toEqual({ seed: 7, params: { n: 16384 } });
  });
});
