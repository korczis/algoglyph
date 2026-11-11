// Binary search over a sorted array, recording every probe, plus the seeded key sets and
// query streams that the binary-search, interpolation-search and indexed-sequential-access
// plates share (see ../publish.ts for why shared code lives here).

export interface Result {
  /** An index holding the key, or −1. */
  index: number;
  /** The indices probed, in order. */
  probes: number[];
  /** The interval [lo, hi] before each probe. */
  bounds: [number, number][];
}

export function binarySearch(a: ArrayLike<number>, key: number): Result {
  const probes: number[] = [];
  const bounds: [number, number][] = [];
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    probes.push(mid);
    bounds.push([lo, hi]);
    if (a[mid] === key) return { index: mid, probes, bounds };
    if (key < a[mid]) hi = mid - 1;
    else lo = mid + 1;
  }
  return { index: -1, probes, bounds };
}

export type Spread = 'uniform' | 'logarithmic';

/** n distinct sorted integer keys: uniform on [0, 8n), or log-uniform on [1, 64n), which packs
 * small values densely and leaves wide gaps between large ones. */
export function sortedKeys(n: number, spread: Spread, rnd: () => number): number[] {
  const seen = new Set<number>();
  const logTop = Math.log(64 * n);
  while (seen.size < n) {
    const u = rnd();
    seen.add(spread === 'logarithmic' ? Math.floor(Math.exp(u * logTop)) : Math.floor(8 * n * u));
  }
  return [...seen].sort((x, y) => x - y);
}

/** A key to look for: one of the keys with probability `hit`, otherwise a key not present. */
export function query(keys: number[], hit: number, rnd: () => number,
  present: Set<number> = new Set(keys)): number {
  if (rnd() < hit) return keys[Math.floor(rnd() * keys.length)];
  const top = keys[keys.length - 1] + 2;
  for (;;) {
    const k = Math.floor(rnd() * top);
    if (!present.has(k)) return k;
  }
}
