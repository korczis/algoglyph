import type { HashKernel } from '../../engines/hash/table';
import { find, insert, LINEAR_EXPECTED, remove } from './_linear';

// Open addressing with linear probing in a table of fixed size; deletion moves keys back.
export const kernel: HashKernel = {
  layout: 'slots',
  maxLoad: 95,
  init(t, size) { t.resize(size.m); },
  insert,
  search: (t, key) => find(t, key) >= 0,
  remove,
  expected: LINEAR_EXPECTED,
};
