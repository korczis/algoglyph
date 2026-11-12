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
