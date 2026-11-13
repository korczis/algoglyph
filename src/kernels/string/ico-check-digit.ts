import { S, type StringKernel } from '../../engines/string/trace';

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2];

/** The check digit the first seven digits imply: (11 − Σ wᵢdᵢ mod 11) mod 10. */
export function checkDigit(digits: number[]): number {
  let s = 0;
  for (let i = 0; i < 7; i++) s += WEIGHTS[i] * digits[i];
  return (11 - (s % 11)) % 10;
}

// Each of the first seven digits is weighted 8, 7, …, 2; the sum modulo 11 fixes the eighth.
// Remainders 0 and 10 both give check digit 1, so a corruption that moves the sum between them
// slips through; every other single-digit substitution and every adjacent transposition of
// distinct digits among the first seven changes the remainder and is caught.
export const kernel: StringKernel<'ico', boolean[]> = {
  input: 'ico',
  counters: { mul: 'Digits weighted', check: 'Numbers checked' },
  // the share of seeded numbers corrupted (src/engines/string/inputs.ts)
  params: [{ kind: 'range', key: 'corrupt', label: 'Share corrupted', min: 0, max: 1, step: 0.05, value: 0.4, rebuild: true }],
  run(ops, { numbers, corrupted }) {
    ops.list('done', [], { label: 'Checked', lines: 3 });
    const out: boolean[] = [];
    let caught = 0; let slipped = 0; let falseAlarm = 0;
    numbers.forEach((num, k) => {
      const d = [...num].map(Number);
      ops.row('digits', [...num], { label: 'Number' });
      ops.row('w', [...WEIGHTS.map(String), '='], { label: 'Weight', align: 'digits' });
      ops.row('prod', new Array<string>(8).fill(''), { label: 'Product', align: 'digits' });
      let s = 0;
      for (let i = 0; i < 7; i++) {
        ops.tick('mul');
        s += WEIGHTS[i] * d[i];
        ops.set('prod', i, String(WEIGHTS[i] * d[i]));
        ops.mark('digits', i, S.focus);
        ops.mark('w', i, S.alt);
      }
      const r = s % 11;
      const c = (11 - r) % 10;
      ops.tick('check');
      const ok = c === d[7];
      ops.set('prod', 7, String(c));
      ops.mark('prod', 7, ok ? S.hit : S.miss);
      ops.mark('digits', 7, ok ? S.hit : S.miss);
      ops.note(`sum ${s}, mod 11 = ${r}, check digit ${c}: ${ok ? 'valid' : `invalid, the number ends in ${d[7]}`}`);
      out.push(ok);
      ops.push('done', `${num} ${ok ? '✓' : '✗'}`, ok ? S.hit : S.miss);
      if (corrupted[k] && !ok) caught++;
      else if (corrupted[k] && ok) slipped++;
      else if (!ok) falseAlarm++;
      ops.stat('Corrupted and caught', String(caught));
      ops.stat('Corrupted but valid', String(slipped));
      ops.stat('Intact but invalid', String(falseAlarm));
    });
    return out;
  },
};
