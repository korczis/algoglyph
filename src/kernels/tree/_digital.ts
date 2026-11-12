// Shared driver for the digital search structures: insert every key, then search for each
// search key, reporting what was found.
import type { Key, TreeOps } from '../../engines/tree/trace';

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
