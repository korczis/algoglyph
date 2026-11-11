import type { StringKernel } from '../../engines/string/trace';
import { align, board, compare, found, SEARCH_CHART, SEARCH_COUNTERS } from './_search';

// Try every alignment; compare left to right until a mismatch or the whole pattern matches.
export const kernel: StringKernel<'search', number[]> = {
  input: 'search',
  counters: SEARCH_COUNTERS,
  chart: SEARCH_CHART,
  run(ops, { text, pattern }) {
    const n = text.length; const m = pattern.length;
    const out: number[] = [];
    board(ops, text, pattern);
    let tried = 0;
    for (let s = 0; s + m <= n; s++) {
      align(ops, s);
      ops.stat('Alignments tried', String(++tried));
      let j = 0;
      while (j < m && compare(ops, text, pattern, s + j, j)) j++;
      if (j === m) found(ops, s, m, out);
    }
    ops.stat('Matches', String(out.length));
    return out;
  },
};
