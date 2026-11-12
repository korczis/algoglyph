// Sequential search in an unordered list, optionally self-organising: after a hit, move the
// key to the front, or swap it one place forward (transpose). Popular keys then drift to where
// the scan starts.

export type Strategy = 'static' | 'move-to-front' | 'transpose';

export interface Lookup {
  /** Where the key was found before reorganising, or −1. */
  index: number;
  /** Keys compared. */
  probes: number;
}

export class SequentialList {
  constructor(readonly keys: number[], public strategy: Strategy = 'static') {}

  search(key: number): Lookup {
    const a = this.keys;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== key) continue;
      if (this.strategy === 'move-to-front' && i > 0) {
        a.splice(i, 1);
        a.unshift(key);
      } else if (this.strategy === 'transpose' && i > 0) {
        [a[i - 1], a[i]] = [a[i], a[i - 1]];
      }
      return { index: i, probes: i + 1 };
    }
    return { index: -1, probes: a.length };
  }
}

/** Cumulative Zipf weights over ranks 1 … n (weight 1/r^s), normalised to end at 1. */
export function zipf(n: number, s: number): Float64Array {
  const cdf = new Float64Array(n);
  let total = 0;
  for (let r = 1; r <= n; r++) {
    total += 1 / r ** s;
    cdf[r - 1] = total;
  }
  for (let r = 0; r < n; r++) cdf[r] /= total;
  return cdf;
}

/** Draw a rank 0 … n − 1 from a cumulative distribution. */
export function draw(cdf: Float64Array, rnd: () => number): number {
  const u = rnd();
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
