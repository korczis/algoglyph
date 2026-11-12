import type { HashKernel, HashOps } from '../../engines/hash/table';
import { find, insert, LINEAR_EXPECTED, remove } from './_linear';

// Linear probing in a table that doubles as soon as it is more than half full and halves when
// it falls below one eighth full, rehashing every key into the new table.
const MIN = 4;

function rebuild(t: HashOps, m: number): void {
  for (const k of t.resize(m)) insert(t, k);
}

export const kernel: HashKernel = {
  layout: 'slots',
  init(t) { t.resize(MIN); },
  insert(t, key) {
    if (!insert(t, key)) return false;
    if (2 * t.count > t.m) rebuild(t, 2 * t.m);
    return true;
  },
  search: (t, key) => find(t, key) >= 0,
  remove(t, key) {
    if (!remove(t, key)) return false;
    if (t.m > MIN && 8 * t.count < t.m) rebuild(t, t.m / 2);
    return true;
  },
  expected: LINEAR_EXPECTED,
};
