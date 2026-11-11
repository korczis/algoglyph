import type { StringKernel } from '../../engines/string/trace';
import { align, board, compare, everywhere, found, SEARCH_CHART, SEARCH_COUNTERS } from './_search';

// Try every alignment; compare left to right until a mismatch or the whole pattern matches. A
// generator: on Repetitive input its work grows as n², so it pauses every few alignments.
export const kernel: StringKernel<'search', number[]> = {
  input: 'search',
  counters: SEARCH_COUNTERS,
  chart: SEARCH_CHART,
  *run(ops, { text, pattern }) {
    const n = text.length; const m = pattern.length;
    const out: number[] = [];
    board(ops, text, pattern);
    if (!m) return everywhere(ops, n);
    let tried = 0;
    for (let s = 0; s + m <= n; s++) {
      align(ops, s);
      ops.stat('Alignments tried', String(++tried));
      let j = 0;
      while (j < m && compare(ops, text, pattern, s + j, j)) j++;
      if (j === m) found(ops, s, m, out);
      if (s % 16 === 15) yield null;
    }
    ops.stat('Matches', String(out.length));
    return out;
  },
};
