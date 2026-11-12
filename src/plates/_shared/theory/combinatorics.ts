// The textbook quantities the bespoke sorting plates set their measurements against. Each one is
// computed from its definition, never from a plate's run, and test/sorting-esoteric-shared.test.ts
// checks it against brute force.

/** n! as a double (exact up to 18!). */
export function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** The harmonic number H_n = 1 + 1/2 + … + 1/n. */
export function harmonic(n: number): number {
  let h = 0;
  for (let i = 1; i <= n; i++) h += 1 / i;
  return h;
}

/** The number of distinct arrangements of a multiset of keys: n! / Π m_i!. */
export function arrangements(keys: ArrayLike<number>): number {
  const m = new Map<number, number>();
  for (let i = 0; i < keys.length; i++) m.set(keys[i], (m.get(keys[i]) ?? 0) + 1);
  let r = factorial(keys.length);
  for (const c of m.values()) r /= factorial(c);
  return r;
}

/** The integer partitions of n, largest part first, each in non-increasing order. */
export function partitions(n: number, max = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let k = Math.min(n, max); k >= 1; k--) {
    for (const rest of partitions(n - k, k)) out.push([k, ...rest]);
  }
  return out;
}

/** The cycle lengths of the permutation that sorts `keys` (distinct keys), largest first. */
export function cycleType(keys: ArrayLike<number>): number[] {
  const n = keys.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => keys[a] - keys[b]);
  // rank[i]: where the key now at i belongs
  const rank = new Array<number>(n);
  order.forEach((at, r) => { rank[at] = r; });
  const seen = new Array<boolean>(n).fill(false);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = rank[j]) {
      seen[j] = true;
      len++;
    }
    out.push(len);
  }
  return out.sort((a, b) => b - a);
}

/** Solves A x = b by Gaussian elimination with partial pivoting (small dense systems). */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    if (d === 0) throw new Error('solve: singular system');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
