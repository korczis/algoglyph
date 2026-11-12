// Shared driver for the digital search structures: insert every key, then search for each
// search key, reporting what was found.
import type { ParamDef } from '../../core/plate';
import type { Key, TreeOps } from '../../engines/tree/trace';

/** The control the bit tries share, so they stay in step: keys of w = max(4, ⌈lg 4n⌉) + e bits
 * for e extra bits (src/engines/tree/trace.ts), drawn from a span 2^e times wider. */
export const keyBitsParams = (): ParamDef[] => [{
  kind: 'range', key: 'spare', label: 'Extra key bits', min: 0, max: 6, step: 1, value: 0,
  rebuild: true, hint: 'Key width w = max(4, ⌈lg 4n⌉) + this; every key is below 2^w.',
}];

/** The control the word tries share, so they stay in step: words over the first R letters of
 * 'abcdefghij' (src/engines/tree/trace.ts), and R links in every multiway-trie node. Two letters
 * spell only 62 words of 1 to 5 letters, fewer than the plates' 120, and the draw would run to
 * its guard; ten keeps a multiway node's fan-out legible in the drawing (judged, not measured). */
export const alphabetParams = (): ParamDef[] => [{
  kind: 'range', key: 'letters', label: 'Alphabet size R', min: 3, max: 10, step: 1, value: 5,
  rebuild: true, hint: 'Words are drawn from the first R letters, a to j at most.',
}];

export function drive(t: TreeOps, insert: (k: Key) => void, search: (k: Key) => boolean): void {
  for (const k of t.w.keys) {
    t.begin('insert', `insert ${k}`);
    insert(k);
  }
  for (const k of t.w.searches) {
    t.begin('search', `search ${k}`);
    t.found(k, search(k));
  }
}
