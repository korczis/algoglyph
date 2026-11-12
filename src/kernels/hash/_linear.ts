import { EMPTY, slotOf, type Expected, type HashOps } from '../../engines/hash/table';

// Linear probing on the table as it stands: look at the home slot, then the next ones, wrapping.

/** Knuth's estimates for linear probing at load factor a (uniform keys, large tables). */
export const LINEAR_EXPECTED: Expected = {
  label: "Knuth's formula for linear probing",
  hit: (a) => 0.5 * (1 + 1 / (1 - a)),
  miss: (a) => 0.5 * (1 + 1 / (1 - a) ** 2),
};

/** The slot holding key, or -1 after reaching an empty slot (or every slot). */
export function find(t: HashOps, key: number): number {
  const m = t.m;
  let i = slotOf(t.hash(key), m);
  for (let d = 0; d < m; d++) {
    const v = t.read(i);
    if (v === key) return i;
    if (v === EMPTY) return -1;
    i = i + 1 === m ? 0 : i + 1;
  }
  return -1;
}

/** Insert a key known to be absent, or report it present. False also when the table is full. */
export function insert(t: HashOps, key: number): boolean {
  const m = t.m;
  let i = slotOf(t.hash(key), m);
  for (let d = 0; d < m; d++) {
    const v = t.read(i);
    if (v === key) return false;
    if (v === EMPTY) { t.write(i, 0, key, d); return true; }
    i = i + 1 === m ? 0 : i + 1;
  }
  return false;
}

/**
 * Delete without tombstones (Knuth's Algorithm R): empty the slot, then walk the rest of the
 * cluster and move back every key whose home no longer lies between the hole and its slot.
 */
export function remove(t: HashOps, key: number): boolean {
  let i = find(t, key);
  if (i < 0) return false;
  const m = t.m;
  t.write(i, 0, EMPTY);
  let j = i;
  for (;;) {
    j = j + 1 === m ? 0 : j + 1;
    const v = t.read(j);
    if (v === EMPTY) return true;
    const r = slotOf(t.hash(v), m);
    const stays = i <= j ? i < r && r <= j : i < r || r <= j;
    if (!stays) {
      t.write(i, 0, v, (i - r + m) % m);
      t.write(j, 0, EMPTY);
      i = j;
    }
  }
}
