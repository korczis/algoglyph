import { S, type StringOps } from '../../engines/string/trace';

export const SEARCH_COUNTERS = { compare: 'Character comparisons' };
export const SEARCH_CHART = { title: 'Work along the text', x: 'text position', y: 'count so far' };

/** The text, the pattern lined up under it, and the matches found so far. */
export function board(ops: StringOps, text: string, pattern: string): void {
  ops.row('text', [...text], { label: 'Text' });
  ops.row('pat', [...pattern], { label: 'Pattern', align: 'text' });
  ops.list('found', [], { label: 'Matches at', lines: 1 });
}

/** One counted comparison of text[i] with pattern[j], marked on both rows. */
export function compare(ops: StringOps, text: string, pattern: string, i: number, j: number): boolean {
  const ok = ops.eq('compare', text[i], pattern[j]);
  ops.mark('text', i, ok ? S.hit : S.miss);
  ops.mark('pat', j, ok ? S.hit : S.miss);
  return ok;
}

/** Slide the pattern so that its first character lies under text[s]. */
export function align(ops: StringOps, s: number): void {
  ops.clear('text');
  ops.clear('pat');
  ops.offset('pat', s);
  ops.plot('Character comparisons', s, ops.count('compare'));
}

export function found(ops: StringOps, s: number, m: number, out: number[]): void {
  out.push(s);
  ops.push('found', String(s), S.done);
  for (let k = s; k < s + m; k++) ops.mark('text', k, S.done);
  ops.stat('Matches', String(out.length));
  ops.note(`match at ${s}`);
}

/**
 * The empty pattern occurs at every position 0..n, as String.prototype.indexOf finds it, and
 * costs no comparison. Every search kernel answers it here before it searches.
 */
export function everywhere(ops: StringOps, n: number): number[] {
  const out = Array.from({ length: n + 1 }, (_, s) => s);
  ops.list('found', out.map(String), { label: 'Matches at', lines: 1 });
  ops.stat('Matches', String(out.length));
  ops.note(`the empty pattern occurs at every position, 0 to ${n}`);
  return out;
}
