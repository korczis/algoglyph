// Every permutation of 0 … n − 1, each from the one before by a single exchange.
// Heap's method exchanges an arbitrary pair; the Johnson–Trotter method exchanges neighbours
// only, moving the largest "mobile" element one place in the direction it faces.

export interface Step {
  perm: number[];
  /** The two positions exchanged to reach this permutation (−1 for the first). */
  i: number;
  j: number;
}

export type Method = 'heap' | 'johnson-trotter';

export function* permutations(n: number, method: Method): Generator<Step> {
  if (method === 'heap') yield* heap(n);
  else yield* johnsonTrotter(n);
}

/** Heap's method, iterative form. */
export function* heap(n: number): Generator<Step> {
  const a = Array.from({ length: n }, (_, k) => k);
  const c = new Array(n).fill(0);
  yield { perm: a.slice(), i: -1, j: -1 };
  let k = 1;
  while (k < n) {
    if (c[k] < k) {
      const j = k % 2 === 0 ? 0 : c[k];
      [a[j], a[k]] = [a[k], a[j]];
      yield { perm: a.slice(), i: j, j: k };
      c[k]++;
      k = 1;
    } else {
      c[k] = 0;
      k++;
    }
  }
}

/** Johnson–Trotter: each element faces left or right; move the largest one that can. */
export function* johnsonTrotter(n: number): Generator<Step> {
  const a = Array.from({ length: n }, (_, k) => k);
  const dir = new Array(n).fill(-1); // dir[value]
  yield { perm: a.slice(), i: -1, j: -1 };
  for (;;) {
    let best = -1;
    let at = -1;
    for (let p = 0; p < n; p++) {
      const q = p + dir[a[p]];
      if (q < 0 || q >= n || a[q] > a[p]) continue;
      if (a[p] > best) {
        best = a[p];
        at = p;
      }
    }
    if (best < 0) return;
    const q = at + dir[best];
    [a[at], a[q]] = [a[q], a[at]];
    for (let p = 0; p < n; p++) if (a[p] > best) dir[a[p]] = -dir[a[p]];
    yield { perm: a.slice(), i: Math.min(at, q), j: Math.max(at, q) };
  }
}
