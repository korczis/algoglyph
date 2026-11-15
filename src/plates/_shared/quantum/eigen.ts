// Bound states of the time-independent Schrödinger equation −½ψ″ + Vψ = Eψ (ħ = m = 1), plan S11:
// the second-order finite-difference Hamiltonian on a grid with ψ = 0 at both ends is a symmetric
// tridiagonal matrix, diagonal 1/h² + Vᵢ and off-diagonal −1/2h². Its eigenvalues are found exactly
// (to round-off) by Sturm-sequence bisection — the number of negative pivots of H − λ is the number of
// eigenvalues below λ — and each eigenvector by inverse iteration with the Thomas algorithm. The
// radial equation for u = rψ is the same matrix with ℓ(ℓ + 1)/2r² added to V. Pure.

/** n interior points of [lo, hi], ψ held at zero on the two ends. */
export function grid(lo: number, hi: number, n: number): { x: Float64Array; h: number } {
  const h = (hi - lo) / (n + 1);
  return { x: Float64Array.from({ length: n }, (_, i) => lo + (i + 1) * h), h };
}

/** The number of eigenvalues of H below λ: the negative pivots of the LDLᵀ factorisation of H − λ. */
export function sturmCount(V: ArrayLike<number>, h: number, lambda: number): number {
  const d0 = 1 / (h * h);
  const e2 = (0.5 / (h * h)) ** 2;
  let count = 0;
  let q = 1;
  for (let i = 0; i < V.length; i++) {
    q = d0 + V[i] - lambda - (i > 0 ? e2 / q : 0);
    if (q === 0) q = -1e-300;
    if (q < 0) count++;
  }
  return count;
}

/** The lowest `count` eigenvalues, each by bisection on the Sturm count to round-off. */
export function eigenvalues(V: ArrayLike<number>, h: number, count: number): number[] {
  let vmin = Infinity;
  let vmax = -Infinity;
  for (let i = 0; i < V.length; i++) { vmin = Math.min(vmin, V[i]); vmax = Math.max(vmax, V[i]); }
  // Gershgorin: every eigenvalue lies within the diagonal ± the off-diagonal row sum
  const lo0 = vmin;
  const hi0 = vmax + 2 / (h * h);
  const out: number[] = [];
  for (let k = 0; k < Math.min(count, V.length); k++) {
    let lo = k ? out[k - 1] : lo0;
    let hi = hi0;
    for (let it = 0; it < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(hi)); it++) {
      const mid = 0.5 * (lo + hi);
      if (sturmCount(V, h, mid) > k) hi = mid; else lo = mid;
    }
    out.push(0.5 * (lo + hi));
  }
  return out;
}

/** The eigenvector of the eigenvalue λ by inverse iteration, normalised so that Σψ²h = 1, its first
 * extremum positive. */
export function eigenvector(V: ArrayLike<number>, h: number, lambda: number): Float64Array {
  const n = V.length;
  const off = -0.5 / (h * h);
  // shift a hair off the eigenvalue, so H − σ is invertible and the eigenvector dominates
  const sigma = lambda + 1e-10 * Math.max(1, Math.abs(lambda));
  let v = new Float64Array(n).fill(1);
  const c = new Float64Array(n);
  const y = new Float64Array(n);
  for (let it = 0; it < 4; it++) {
    // Thomas algorithm on (H − σ) w = v
    let b = 1 / (h * h) + V[0] - sigma;
    c[0] = off / b;
    y[0] = v[0] / b;
    for (let i = 1; i < n; i++) {
      b = 1 / (h * h) + V[i] - sigma - off * c[i - 1];
      c[i] = off / b;
      y[i] = (v[i] - off * y[i - 1]) / b;
    }
    const w = new Float64Array(n);
    w[n - 1] = y[n - 1];
    for (let i = n - 2; i >= 0; i--) w[i] = y[i] - c[i] * w[i + 1];
    let s = 0;
    for (let i = 0; i < n; i++) s += w[i] * w[i] * h;
    s = Math.sqrt(s);
    for (let i = 0; i < n; i++) w[i] /= s;
    v = w;
  }
  // the sign: the first value of any size is positive
  let big = 0;
  for (let i = 0; i < n; i++) big = Math.max(big, Math.abs(v[i]));
  const first = v.findIndex((x) => Math.abs(x) > 1e-3 * big);
  if (first >= 0 && v[first] < 0) for (let i = 0; i < n; i++) v[i] = -v[i];
  return v;
}

/** Sign changes of a vector, ignoring values below a millionth of its largest. */
export function nodes(v: ArrayLike<number>): number {
  let big = 0;
  for (let i = 0; i < v.length; i++) big = Math.max(big, Math.abs(v[i]));
  let last = 0;
  let count = 0;
  for (let i = 0; i < v.length; i++) {
    if (Math.abs(v[i]) < 1e-6 * big) continue;
    const s = Math.sign(v[i]);
    if (last && s !== last) count++;
    last = s;
  }
  return count;
}

/**
 * The bound levels of a square well of depth v0 and half-width a (V = 0 inside, v0 outside), from
 * the matching conditions alone: k sin ka = κ cos ka for the even states and k cos ka = −κ sin ka for
 * the odd, k = √2E and κ = √2(v0 − E), each root bracketed on a fine scan of (0, v0) and bisected.
 */
export function finiteWellLevels(v0: number, a: number): number[] {
  const fe = (E: number) => { const k = Math.sqrt(2 * E); const q = Math.sqrt(2 * (v0 - E)); return k * Math.sin(k * a) - q * Math.cos(k * a); };
  const fo = (E: number) => { const k = Math.sqrt(2 * E); const q = Math.sqrt(2 * (v0 - E)); return k * Math.cos(k * a) + q * Math.sin(k * a); };
  const roots: number[] = [];
  const M = 20000;
  for (const f of [fe, fo]) {
    let prev = f(1e-12 * v0);
    for (let j = 1; j < M; j++) {
      const E = (v0 * j) / M;
      const cur = f(E);
      if (Math.sign(cur) !== Math.sign(prev)) {
        let lo = (v0 * (j - 1)) / M; let hi = E;
        for (let it = 0; it < 100; it++) { const m = 0.5 * (lo + hi); if (Math.sign(f(m)) === Math.sign(f(lo))) lo = m; else hi = m; }
        roots.push(0.5 * (lo + hi));
      }
      prev = cur;
    }
  }
  return roots.sort((x, y) => x - y);
}
