import { S, type StringKernel } from '../../engines/string/trace';
import { align, board, compare, everywhere, found, SEARCH_CHART } from './_search';

const R = 256;

// The hash of a window is its characters read as a base-256 number modulo a prime q. Sliding
// one position removes the leading character and appends the next in constant time; only when
// the window's hash equals the pattern's are the characters compared (so no false match is
// reported, and a small q shows the spurious hits it causes).
export const kernel: StringKernel<'search', number[]> = {
  input: 'search',
  counters: { compare: 'Character comparisons', hash: 'Hash updates' },
  chart: SEARCH_CHART,
  params: [{
    kind: 'select', key: 'q', label: 'Modulus q', value: '1000003', rebuild: true,
    options: [{ value: '1000003', label: '1 000 003' }, { value: '997', label: '997' }, { value: '13', label: '13 (collisions)' }],
  }],
  run(ops, { text, pattern: p }, params) {
    const q = Number(params.q ?? 1000003) || 1000003;
    const n = text.length; const m = p.length;
    const out: number[] = [];
    board(ops, text, p);
    if (!m) return everywhere(ops, n);
    ops.list('hash', [], { label: 'Hashes', lines: 1 });
    if (m > n) return out;
    let rm = 1;
    for (let k = 1; k < m; k++) rm = (rm * R) % q;
    let hp = 0; let ht = 0;
    for (let k = 0; k < m; k++) {
      hp = (hp * R + p.charCodeAt(k)) % q;
      ht = (ht * R + text.charCodeAt(k)) % q;
      ops.tick('hash', 2);
    }
    ops.list('hash', [`pattern ${hp}`, `window ${ht}`], { label: 'Hashes', lines: 1 });
    let spurious = 0;
    let wasted = 0;
    for (let s = 0; ; s++) {
      align(ops, s);
      ops.plot('Hash updates', s, ops.count('hash'));
      ops.set('hash', 1, `window ${ht}`);
      ops.mark('hash', 1, ht === hp ? S.hit : S.none);
      if (ht === hp) {
        let j = 0;
        while (j < m && compare(ops, text, p, s + j, j)) j++;
        if (j === m) found(ops, s, m, out);
        else {
          spurious++;
          wasted += j + 1;
          ops.stat('Spurious hash hits', String(spurious));
          ops.stat('Comparisons spent on spurious hits', String(wasted));
          ops.note(`hash ${ht} matched but the characters differ`);
        }
      }
      if (s + m >= n) break;
      ht = (ht + q - (rm * text.charCodeAt(s)) % q) % q;
      ht = (ht * R + text.charCodeAt(s + m)) % q;
      ops.tick('hash');
    }
    ops.stat('Spurious hash hits', String(spurious));
    ops.stat('Comparisons spent on spurious hits', String(wasted));
    ops.stat('Matches', String(out.length));
    return out;
  },
};
