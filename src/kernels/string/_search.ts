import type { ParamDef } from '../../core/plate';
import { S, type StringOps } from '../../engines/string/trace';

export const SEARCH_COUNTERS = { compare: 'Character comparisons' };
export const SEARCH_CHART = { title: 'Work along the text', x: 'text position', y: 'count so far' };

/**
 * The pattern's length, one control every search plate shares (src/engines/string/inputs.ts
 * reads it): 'auto' is the old draw, 4 to 7 characters of English words, 6 of DNA, max(6, n/16)
 * on Repetitive input; a number fixes m, at most the text's length. 128 at most: brute force
 * then counts no more than it did on Repetitive input at n 2048, m(n − m + 1) at m = 128.
 */
export const searchParams = (): ParamDef[] => [{
  kind: 'select', key: 'm', label: 'Pattern length', value: 'auto', rebuild: true,
  options: [{ value: 'auto', label: 'As the input draws it' },
    ...[4, 6, 8, 16, 32, 64, 128].map((m) => ({ value: String(m), label: `${m} characters` }))],
}];

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
