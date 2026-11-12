import { S, type StringKernel } from '../../engines/string/trace';
import { myers, type Edit } from './_myers';

// The edit graph has a point for every pair of prefixes; a step right deletes a token of the
// old version, a step down inserts one of the new, and a diagonal is free where the tokens are
// equal. Round d extends, on each diagonal k = x − y from −d to d, the furthest-reaching path
// with d edits, then slides it down its diagonal as far as the tokens agree. The first round to
// reach the far corner gives the length of the shortest edit script.
export const kernel: StringKernel<'versions', { d: number; script: Edit[] }> = {
  input: 'versions',
  counters: { compare: 'Token comparisons', reach: 'Paths extended' },
  chart: { title: 'Furthest reach per round', x: 'edits d', y: 'tokens of the old version consumed' },
  // one edit of the new version per `every` tokens (src/engines/string/inputs.ts); fewer than 5
  // would make the plate heavier than its default at its largest input
  params: [{ kind: 'range', key: 'every', label: 'Tokens per edit', min: 5, max: 12, step: 1, value: 5, rebuild: true }],
  run(ops, { a, b }) {
    const N = a.length; const M = b.length;
    const cut = (s: string) => (s.length > 6 ? s.slice(0, 6) : s);
    ops.table('g', M + 1, N + 1, { label: 'Edit graph', colHead: ['', ...a.map(cut)], rowHead: ['', ...b.map(cut)] });
    const scale = Math.max(1, Math.ceil((N + M) / 2));
    let round = -1; let best = 0;
    const r = myers(a, b, {
      eq: (x, y) => ops.eq('compare', a[x], b[y]),
      reach(d, k, x, y) {
        if (d !== round) {
          if (round >= 0) ops.plot('Furthest x', round, best);
          round = d; best = 0;
          ops.note(`round d = ${d}: diagonals ${-d} to ${d}`);
        }
        ops.tick('reach');
        if (y <= M && x <= N) ops.heat('g', y * (N + 1) + x, Math.min(1, d / scale) * 0.85);
        best = Math.max(best, x);
        void k;
      },
      snake(x, y) {
        if (y <= M && x <= N) { ops.heat('g', y * (N + 1) + x, Math.min(1, round / scale) * 0.85); ops.markCell('g', y, x, S.alt); }
        best = Math.max(best, x);
      },
    });
    ops.plot('Furthest x', round, best);
    let x = 0; let y = 0;
    ops.markCell('g', 0, 0, S.done);
    for (const [op] of r.script) {
      if (op !== '+') x++;
      if (op !== '-') y++;
      ops.markCell('g', y, x, S.done);
    }
    ops.list('script', r.script.map(([op, t]) => `${op}${t}`), { label: 'Edit script', lines: 2 });
    r.script.forEach(([op], i) => ops.mark('script', i, op === '=' ? S.none : op === '-' ? S.miss : S.hit));
    ops.note(`shortest edit script: ${r.d} edits, ${(N + M - r.d) / 2} tokens kept`);
    ops.stat('Edit distance D', String(r.d));
    ops.stat('Longest common subsequence', String((N + M - r.d) / 2));
    return r;
  },
};
