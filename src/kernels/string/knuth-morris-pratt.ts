import { S, type StringKernel } from '../../engines/string/trace';
import { align, board, compare, everywhere, found, SEARCH_CHART, SEARCH_COUNTERS, searchParams } from './_search';

// The prefix function pi[q] is the length of the longest proper border of pattern[0..q]. After
// a mismatch with q characters matched, the pattern slides so that pi[q-1] of them still match;
// the text index never moves back.
export const kernel: StringKernel<'search', number[]> = {
  input: 'search',
  counters: SEARCH_COUNTERS,
  chart: SEARCH_CHART,
  params: searchParams(),
  *run(ops, { text, pattern }) {
    const n = text.length; const m = pattern.length;
    const out: number[] = [];
    board(ops, text, pattern);
    if (!m) return everywhere(ops, n);
    ops.row('pi', pattern.split('').map(() => ''), { label: 'Prefix function' });
    const pi = new Array<number>(m).fill(0);
    ops.note('prefix function: the pattern matched against itself');
    for (let q = 1, k = 0; q < m; q++) {
      while (k > 0 && !ops.eq('compare', pattern[q], pattern[k])) k = pi[k - 1];
      if (k === 0 ? ops.eq('compare', pattern[q], pattern[0]) : true) k++;
      pi[q] = k;
      ops.set('pi', q, String(k));
      ops.mark('pi', q, S.focus);
    }
    ops.set('pi', 0, '0');
    ops.clear('pi');
    let q = 0;
    let shift = -1;
    for (let i = 0; i < n; i++) {
      yield null;
      for (;;) {
        if (i - q !== shift) { shift = i - q; align(ops, shift); }
        if (compare(ops, text, pattern, i, q)) { q++; break; }
        if (q === 0) break;
        ops.mark('pi', q - 1, S.alt);
        ops.note(`mismatch after ${q} matched: keep pi[${q - 1}] = ${pi[q - 1]}`);
        q = pi[q - 1];
      }
      if (q === m) {
        found(ops, i - m + 1, m, out);
        q = pi[m - 1];
      }
    }
    ops.stat('Matches', String(out.length));
    return out;
  },
};
