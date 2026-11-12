import { DELETED, EMPTY, slotOf, type HashKernel, type HashOps } from '../../engines/hash/table';

// Open addressing whose probe step comes from a second, unrelated hash. The table size is
// rounded up to a prime so that every step visits every slot. Deletion leaves a tombstone.

function prime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

interface Walk {
  /** The key's slot, or -1. */
  found: number;
  /** Where an insert would go (the first tombstone passed, else the empty slot), or -1. */
  free: number;
  /** The probe number of `free`. */
  d: number;
}

function walk(t: HashOps, key: number): Walk {
  const m = t.m;
  let i = slotOf(t.hash(key), m);
  let step = 0;
  let free = -1;
  let fd = 0;
  for (let d = 0; d < m; d++) {
    const v = t.read(i);
    if (v === key) return { found: i, free, d: fd };
    if (v === EMPTY) return free >= 0 ? { found: -1, free, d: fd } : { found: -1, free: i, d };
    if (v === DELETED && free < 0) { free = i; fd = d; }
    // the second hash is evaluated only on the first collision
    if (!step) step = 1 + (t.hash(key, 1) % (m - 1));
    i = (i + step) % m;
  }
  return { found: -1, free, d: fd };
}

export const kernel: HashKernel = {
  layout: 'slots',
  maxLoad: 95,
  init(t, size) {
    let m = Math.max(3, size.m);
    while (!prime(m)) m++;
    t.resize(m);
  },
  insert(t, key) {
    const w = walk(t, key);
    if (w.found >= 0 || w.free < 0) return false;
    t.write(w.free, 0, key, w.d);
    return true;
  },
  search: (t, key) => walk(t, key).found >= 0,
  remove(t, key) {
    const w = walk(t, key);
    if (w.found < 0) return false;
    t.write(w.found, 0, DELETED);
    return true;
  },
  // uniform probing, which double hashing approaches
  expected: {
    label: "Knuth's formula for uniform probing",
    hit: (a) => (a > 0 ? Math.log(1 / (1 - a)) / a : 1),
    miss: (a) => 1 / (1 - a),
  },
};
