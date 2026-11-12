import { slotOf, type HashKernel } from '../../engines/hash/table';

// Each bucket is an unordered list; a key is appended after the search that proves it absent.
export const kernel: HashKernel = {
  layout: 'chains',
  maxLoad: 400,
  init(t, size) { t.resize(size.m); },
  insert(t, key) {
    const b = slotOf(t.hash(key), t.m);
    const n = t.len(b);
    for (let i = 0; i < n; i++) if (t.read(b, i) === key) return false;
    t.write(b, n, key, n);
    return true;
  },
  search(t, key) {
    const b = slotOf(t.hash(key), t.m);
    for (let i = 0; i < t.len(b); i++) if (t.read(b, i) === key) return true;
    return false;
  },
  remove(t, key) {
    const b = slotOf(t.hash(key), t.m);
    for (let i = 0; i < t.len(b); i++) {
      if (t.read(b, i) === key) { t.remove(b, i); return true; }
    }
    return false;
  },
  // keys compared: a hit looks at half the other keys of its chain, a miss at the whole chain
  expected: {
    label: "Knuth's formula for chaining",
    hit: (a) => 1 + a / 2,
    miss: (a) => a,
  },
};
