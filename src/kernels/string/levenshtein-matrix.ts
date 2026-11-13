import { S, type StringKernel } from '../../engines/string/trace';

// d[i][j] is the distance between the first i characters of a and the first j of b: the
// cheapest of deleting a[i−1] (d[i−1][j] + 1), inserting b[j−1] (d[i][j−1] + 1), and keeping or
// substituting (d[i−1][j−1] + 0 or the substitution cost, 1 by default). At cost 2 a substitution
// is never cheaper than a deletion and an insertion, and the distance becomes |a| + |b| − 2·LCS.
// The table fills row by row; walking back from the corner along cells that produced each
// minimum gives one cheapest edit script.
export const kernel: StringKernel<'pair', { distance: number; script: string[] }> = {
  input: 'pair',
  counters: { cell: 'Cells written', compare: 'Character comparisons' },
  params: [{
    kind: 'select', key: 'sub', label: 'Substitution cost', value: '1', rebuild: true,
    options: [{ value: '1', label: '1 (Levenshtein)' }, { value: '2', label: '2 (insertions and deletions only)' }],
  }],
  // a generator, a row of the table per step: the lab measures it up to long strings
  *run(ops, { a, b }, params) {
    const sub = Number(params.sub ?? 1) === 2 ? 2 : 1;
    const n = a.length; const m = b.length;
    ops.table('d', n + 1, m + 1, { label: 'Edit table', rowHead: ['', ...a], colHead: ['', ...b] });
    const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 0; i <= n; i++) { d[i][0] = i; ops.tick('cell'); ops.put('d', i, 0, String(i)); }
    for (let j = 1; j <= m; j++) { d[0][j] = j; ops.tick('cell'); ops.put('d', 0, j, String(j)); }
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const same = ops.eq('compare', a[i - 1], b[j - 1]);
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same ? 0 : sub));
        ops.tick('cell');
        ops.put('d', i, j, String(d[i][j]));
        ops.heat('d', i * (m + 1) + j, Math.min(1, d[i][j] / Math.max(1, n, m)) * 0.8);
      }
      ops.note(`row ${i}: '${a[i - 1]}' against every prefix of the second string`);
      yield null;
    }
    const script: string[] = [];
    let i = n; let j = m;
    ops.markCell('d', i, j, S.done);
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : sub)) {
        script.push(a[i - 1] === b[j - 1] ? `=${a[i - 1]}` : `~${a[i - 1]}${b[j - 1]}`);
        i--; j--;
      } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { script.push(`-${a[i - 1]}`); i--; } else { script.push(`+${b[j - 1]}`); j--; }
      ops.markCell('d', i, j, S.done);
    }
    script.reverse();
    const edits = script.filter((s) => s[0] !== '=').length;
    ops.list('script', script.map((s) => (s[0] === '~' ? `${s[1]}→${s[2]}` : s)), { label: 'Edit script', lines: 2 });
    script.forEach((s, k) => ops.mark('script', k, s[0] === '=' ? S.none : s[0] === '~' ? S.alt : s[0] === '-' ? S.miss : S.hit));
    ops.note(`distance ${d[n][m]}: ${edits} edits along the path`);
    ops.stat('Distance', String(d[n][m]));
    // the largest distance the cost allows: every character replaced, or deleted and inserted
    if (sub === 1) ops.stat('Similarity 1 − d / max length', (1 - d[n][m] / Math.max(1, n, m)).toFixed(3));
    else ops.stat('Similarity 1 − d / (|a| + |b|)', (1 - d[n][m] / Math.max(1, n + m)).toFixed(3));
    return { distance: d[n][m], script };
  },
};
