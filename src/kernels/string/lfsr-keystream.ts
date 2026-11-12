import { S, type StringKernel } from '../../engines/string/trace';

/** Feedback taps of maximal-length Fibonacci registers, x^w + … + 1, for each width. */
export const TAPS: Record<number, number[]> = {
  3: [3, 2], 4: [4, 3], 5: [5, 3], 6: [6, 5], 7: [7, 6], 8: [8, 6, 5, 4], 9: [9, 5], 10: [10, 7],
  11: [11, 9], 12: [12, 6, 4, 1], 13: [13, 4, 3, 1], 14: [14, 5, 3, 1], 15: [15, 14], 16: [16, 15, 13, 4],
};

/** One step of the register: returns [output bit, next state]. */
export function step(state: number, w: number, taps: number[]): [number, number] {
  let bit = 0;
  for (const t of taps) bit ^= (state >>> (w - t)) & 1;
  return [state & 1, (state >>> 1) | (bit << (w - 1))];
}

// A w-bit register shifts right once per step; the bit leaving is the keystream bit, the bit
// entering is the XOR of the tapped bits. With taps from a primitive polynomial every non-zero
// state is visited once before the first repeats: period 2^w − 1. The keystream XORed with the
// message bits is the ciphertext, and XORing again recovers the message.
export const kernel: StringKernel<'register', { keystream: number[]; period: number; cipher: number[] }> = {
  input: 'register',
  counters: { shift: 'Shifts', xor: 'Tap XORs' },
  params: [{ kind: 'range', key: 'width', label: 'Register bits', min: 3, max: 16, step: 1, value: 8, rebuild: true }],
  *run(ops, { fill, message }, params) {
    const w = Math.max(3, Math.min(16, Number(params.width ?? 8) || 8));
    const taps = TAPS[w];
    const mask = 2 ** w - 1;
    const start = (fill & mask) || 1;
    const bitsOf = (s: number) => Array.from({ length: w }, (_, k) => String((s >>> (w - 1 - k)) & 1));
    const msg: number[] = [];
    for (const ch of message) for (let k = 7; k >= 0; k--) msg.push((ch.charCodeAt(0) >> k) & 1);
    const shown = Math.min(msg.length, 128);
    ops.row('reg', bitsOf(start), { label: 'Register' });
    for (const t of taps) ops.mark('reg', t - 1, S.alt);
    ops.row('msg', msg.slice(0, shown).map(String), { label: 'Message bits' });
    ops.row('ks', new Array<string>(shown).fill(''), { label: 'Keystream', align: 'msg' });
    ops.row('ct', new Array<string>(shown).fill(''), { label: 'Ciphertext', align: 'msg' });
    const keystream: number[] = []; const cipher: number[] = [];
    let s = start;
    let period = 0;
    const limit = 2 ** w + 1;
    for (let t = 0; t < Math.max(limit, msg.length); t++) {
      yield null;
      if (period && t >= msg.length) break;
      ops.tick('shift');
      ops.tick('xor', taps.length - 1);
      const [out, next] = step(s, w, taps);
      s = next;
      if (t < msg.length) { keystream.push(out); cipher.push(out ^ msg[t]); }
      if (t < shown) {
        ops.row('reg', bitsOf(s), { label: 'Register' });
        for (const k of taps) ops.mark('reg', k - 1, S.alt);
        ops.mark('reg', 0, S.hit);
        ops.set('ks', t, String(out));
        ops.set('ct', t, String(out ^ msg[t]));
        ops.mark('ct', t, out ? S.hit : S.none);
        ops.note(`step ${t + 1}: out ${out}, feedback enters on the left`);
      } else if (t === shown) ops.note('stepping on until the starting state returns');
      if (!period && s === start) period = t + 1;
    }
    ops.stat('Period', period ? String(period) : 'not reached');
    ops.note(`period ${period} of ${mask} non-zero states`);
    return { keystream, period, cipher };
  },
};
