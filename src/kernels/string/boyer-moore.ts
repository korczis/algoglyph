import { S, type StringKernel } from '../../engines/string/trace';
import { align, board, compare, everywhere, found, SEARCH_CHART, SEARCH_COUNTERS } from './_search';

// Compare right to left. On a mismatch at pattern[j] against text character c, slide by the
// larger of two rules: the bad-character rule (bring the last c of the pattern under it) and the
// good-suffix rule (bring the next occurrence of the matched suffix, or its longest border, under
// it). Both tables are built from the pattern alone, with their comparisons counted.
export const kernel: StringKernel<'search', number[]> = {
  input: 'search',
  counters: SEARCH_COUNTERS,
  chart: SEARCH_CHART,
  *run(ops, { text, pattern: p }) {
    const n = text.length; const m = p.length;
    const out: number[] = [];
    board(ops, text, p);
    if (!m) return everywhere(ops, n);
    const last = new Map<string, number>();
    for (let j = 0; j < m; j++) last.set(p[j], j);
    ops.list('bad', [...last].map(([c, j]) => `${c === ' ' ? '␣' : c}:${j}`), { label: 'Last occurrence', lines: 1 });
    // good suffix: shift[j] for a mismatch just before position j (strong rule, via borders)
    const shift = new Array<number>(m + 1).fill(0);
    const bpos = new Array<number>(m + 1).fill(0);
    let i = m; let j = m + 1;
    bpos[i] = j;
    while (i > 0) {
      while (j <= m && !ops.eq('compare', p[i - 1], p[j - 1])) {
        if (shift[j] === 0) shift[j] = j - i;
        j = bpos[j];
      }
      i--; j--;
      bpos[i] = j;
    }
    j = bpos[0];
    for (i = 0; i <= m; i++) {
      if (shift[i] === 0) shift[i] = j;
      if (i === j) j = bpos[j];
    }
    ops.row('gs', shift.slice(1).map(String), { label: 'Good-suffix shift' });
    let s = 0;
    let skipped = 0;
    // alignments passed over by a slide from s, counting only those up to the last one, n − m
    const passed = (d: number) => Math.min(d, n - m + 1 - s) - 1;
    while (s + m <= n) {
      yield null;
      align(ops, s);
      let k = m - 1;
      while (k >= 0 && compare(ops, text, p, s + k, k)) k--;
      if (k < 0) {
        found(ops, s, m, out);
        skipped += passed(shift[0]);
        s += shift[0];
        continue;
      }
      const c = text[s + k];
      const bad = k - (last.get(c) ?? -1);
      const good = shift[k + 1];
      ops.clear('gs');
      if (k < m - 1) ops.mark('gs', k, S.alt);
      ops.note(`mismatch at pattern[${k}]: bad character ${bad}, good suffix ${good}, slide ${Math.max(bad, good)}`);
      const d = Math.max(bad, good);
      skipped += passed(d);
      s += d;
    }
    ops.stat('Alignments skipped', String(skipped));
    ops.stat('Matches', String(out.length));
    return out;
  },
};
