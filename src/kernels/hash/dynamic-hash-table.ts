import type { ParamDef } from '../../core/plate';
import type { HashKernel, HashOps } from '../../engines/hash/table';
import { find, insert, LINEAR_EXPECTED, remove } from './_linear';

// Linear probing in a table that doubles as soon as it is more than g full and halves when it
// falls below s full (1/2 and 1/8 by default), rehashing every key into the new table.
const MIN = 4;

/** A threshold option as the fraction it names: '3/4' is [3, 4]. */
const ratio = (v: unknown, fallback: string): [number, number] => {
  const [a, b] = String(v ?? fallback).split('/').map(Number);
  const ok = Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > a;
  return ok ? [a, b] : ratio(fallback, '1/2');
};

/** The thresholds a run uses. A shrink threshold s must stay below g / 2: a table halved below s
 * holds less than 2s, and at 2s ≥ g one insert would double it again, back and forth; one that
 * is not below g / 2 falls back to 1/8, so 1/4 takes effect only with g = 3/4. */
function thresholds(t: HashOps): { grow: [number, number]; shrink: [number, number] } {
  const grow = ratio(t.opts.grow, '1/2');
  let shrink = ratio(t.opts.shrink, '1/8');
  // s < g / 2, in integers: 2 · s_num · g_den < g_num · s_den
  if (!(2 * shrink[0] * grow[1] < grow[0] * shrink[1])) shrink = [1, 8];
  return { grow, shrink };
}

function rebuild(t: HashOps, m: number): void {
  for (const k of t.resize(m)) insert(t, k);
}

const params: ParamDef[] = [
  {
    kind: 'select', key: 'grow', label: 'Grow past load', value: '1/2', rebuild: true,
    options: [
      { value: '1/2', label: '1/2 (double once more than half full)' },
      { value: '3/4', label: '3/4' },
    ],
    hint: 'The table doubles on the insert that takes it past this load factor.',
  },
  {
    kind: 'select', key: 'shrink', label: 'Shrink below load', value: '1/8', rebuild: true,
    options: [{ value: '1/8', label: '1/8' }, { value: '1/4', label: '1/4 (with grow 3/4 only)' }],
    hint: 'The table halves on the delete that takes it below this load factor; it must stay '
      + 'below half the grow threshold, so 1/4 needs grow 3/4.',
  },
];

export const kernel: HashKernel = {
  layout: 'slots',
  params,
  init(t) { t.resize(MIN); },
  insert(t, key) {
    if (!insert(t, key)) return false;
    // past g = a/b full: b · count > a · m (at 1/2, 2 · count > m)
    const [a, b] = thresholds(t).grow;
    if (b * t.count > a * t.m) rebuild(t, 2 * t.m);
    return true;
  },
  search: (t, key) => find(t, key) >= 0,
  remove(t, key) {
    if (!remove(t, key)) return false;
    // below s = a/b full: b · count < a · m (at 1/8, 8 · count < m)
    const [a, b] = thresholds(t).shrink;
    if (t.m > MIN && b * t.count < a * t.m) rebuild(t, t.m / 2);
    return true;
  },
  expected: LINEAR_EXPECTED,
};
