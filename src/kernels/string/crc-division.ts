import { S, type StringKernel } from '../../engines/string/trace';

/** CRC models (width, generator, initial register, reflection, final XOR); checks of "123456789". */
export const MODELS: Record<string, { label: string; w: number; poly: number; init: number; ref: boolean; xorout: number }> = {
  crc8: { label: 'CRC-8 (x⁸+x²+x+1)', w: 8, poly: 0x07, init: 0, ref: false, xorout: 0 },
  crc16: { label: 'CRC-16/CCITT-FALSE', w: 16, poly: 0x1021, init: 0xffff, ref: false, xorout: 0 },
  crc24: { label: 'CRC-24/OpenPGP', w: 24, poly: 0x864cfb, init: 0xb704ce, ref: false, xorout: 0 },
  crc32: { label: 'CRC-32 (zlib, Ethernet)', w: 32, poly: 0x04c11db7, init: 0xffffffff, ref: true, xorout: 0xffffffff },
};

const bitsOf = (v: number, w: number) => Array.from({ length: w }, (_, k) => Math.floor(v / 2 ** (w - 1 - k)) % 2);

// Long division over GF(2): the message bits (each byte least significant bit first when the
// model reflects) followed by w zero bits, with the initial register XORed into the first w
// bits, are divided by the generator x^w + poly. Wherever the leading bit is 1 the generator is
// XORed in below it; the last w bits left are the remainder, then reflected and XORed out.
export const kernel: StringKernel<'message', number> = {
  input: 'message',
  counters: { step: 'Division steps', xor: 'Bit XORs' },
  params: [{
    kind: 'select', key: 'model', label: 'CRC', value: 'crc8', rebuild: true,
    options: Object.entries(MODELS).map(([value, m]) => ({ value, label: m.label })),
  }],
  run(ops, { bytes }, params) {
    const m = MODELS[String(params.model ?? 'crc8')] ?? MODELS.crc8;
    const msg: number[] = [];
    for (const b of bytes) for (let k = 0; k < 8; k++) msg.push(m.ref ? (b >> k) & 1 : (b >> (7 - k)) & 1);
    const L = msg.length;
    const d = [...msg, ...new Array<number>(m.w).fill(0)];
    const init = bitsOf(m.init, m.w);
    for (let k = 0; k < m.w; k++) d[k] ^= init[k];
    const gen = [1, ...bitsOf(m.poly, m.w)];
    ops.row('div', d.map(String), { label: 'Dividend' });
    ops.row('gen', gen.map(String), { label: 'Generator', align: 'div' });
    for (let k = L; k < L + m.w; k++) ops.mark('div', k, S.dim);
    for (let i = 0; i < L; i++) {
      ops.tick('step');
      ops.clear('div');
      ops.mark('div', i, S.focus);
      if (d[i] === 0) { ops.note(`bit ${i} is 0: bring down the next bit`); ops.mark('div', i, S.done); continue; }
      ops.offset('gen', i);
      ops.note(`bit ${i} is 1: XOR the generator in below it`);
      for (let k = 0; k <= m.w; k++) {
        ops.tick('xor');
        d[i + k] ^= gen[k];
        ops.set('div', i + k, String(d[i + k]));
        ops.mark('div', i + k, gen[k] ? S.hit : S.none);
      }
      ops.mark('div', i, S.done);
    }
    let rem = 0;
    for (let k = 0; k < m.w; k++) rem = rem * 2 + d[L + k];
    let out = rem;
    if (m.ref) { out = 0; for (let k = 0; k < m.w; k++) out = out * 2 + d[L + m.w - 1 - k]; }
    out = (out ^ m.xorout) >>> 0;
    if (m.w < 32) out &= 2 ** m.w - 1;
    ops.clear('div');
    for (let k = L; k < L + m.w; k++) ops.mark('div', k, S.done);
    ops.row('rem', bitsOf(rem, m.w).map(String), { label: 'Remainder' });
    const hex = `0x${out.toString(16).toUpperCase().padStart(m.w / 4, '0')}`;
    ops.note(`remainder ${m.ref ? 'reflected, ' : ''}${m.xorout ? 'XORed out, ' : ''}gives ${hex}`);
    ops.stat('Check value', hex);
    return out;
  },
};
