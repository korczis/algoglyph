// Interpolation search: instead of the middle of [lo, hi], probe where the key would sit if the
// keys between a[lo] and a[hi] were spread evenly.
import type { Result } from '../binary-search/search';

export function interpolationSearch(a: ArrayLike<number>, key: number): Result {
  const probes: number[] = [];
  const bounds: [number, number][] = [];
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi && key >= a[lo] && key <= a[hi]) {
    const span = a[hi] - a[lo];
    const mid = span === 0 ? lo : lo + Math.floor(((key - a[lo]) * (hi - lo)) / span);
    probes.push(mid);
    bounds.push([lo, hi]);
    if (a[mid] === key) return { index: mid, probes, bounds };
    if (a[mid] < key) lo = mid + 1;
    else hi = mid - 1;
  }
  return { index: -1, probes, bounds };
}
