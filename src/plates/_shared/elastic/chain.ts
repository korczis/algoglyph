// A beam as Hencky's bar chain: rigid segments joined by rotational springs, the discrete elastica.
// A beam of length L and bending stiffness EI is cut into N cells; each cell's bending is a spring
// κ = EI/Δs at its midpoint, the springs joined by rigid links of Δs, with a half-link Δs/2 at each
// end. The base is clamped (the first half-link along x); the unknowns are the angles θ₁…θ_N of
// the other segments. Loads are forces at the joints and the tip. A load's potential depends on a
// segment's angle only through the forces beyond it, so the energy's Hessian is tridiagonal and
// Newton's method costs O(N) a step, at any deflection.

export interface Chain {
  n: number;
  /** segment lengths: Δs/2, Δs, …, Δs, Δs/2 (n + 1 of them) */
  len: Float64Array;
  kappa: number;
}

export function chain(n: number, length = 1, EI = 1): Chain {
  const ds = length / n;
  const len = new Float64Array(n + 1).fill(ds);
  len[0] = ds / 2;
  len[n] = ds / 2;
  return { n, len, kappa: EI / ds };
}

/**
 * Forces at the joints (1…n, at the end of segment j − 1) and at the tip (n + 1, the end of
 * segment n), as the sum carried by each segment: G_i is every force applied beyond segment i's
 * start, so the load's potential is −Σ len_i (G_i,x cos θ_i + G_i,y sin θ_i).
 */
export function carried(c: Chain, fx: ArrayLike<number>, fy: ArrayLike<number>): { gx: Float64Array; gy: Float64Array } {
  const gx = new Float64Array(c.n + 1);
  const gy = new Float64Array(c.n + 1);
  let ax = 0;
  let ay = 0;
  // the node at the end of segment i is index i + 1 of the force arrays
  for (let i = c.n; i >= 0; i--) {
    ax += fx[i + 1] ?? 0;
    ay += fy[i + 1] ?? 0;
    gx[i] = ax;
    gy[i] = ay;
  }
  return { gx, gy };
}

/** The total potential Π = Σ κ/2 (θ_j − θ_{j−1})² − Σ len_i G_i·(cos θ_i, sin θ_i), θ₀ = 0. */
export function potential(c: Chain, th: Float64Array, gx: Float64Array, gy: Float64Array): number {
  let e = 0;
  for (let j = 1; j <= c.n; j++) e += 0.5 * c.kappa * (th[j] - th[j - 1]) ** 2;
  for (let i = 0; i <= c.n; i++) e -= c.len[i] * (gx[i] * Math.cos(th[i]) + gy[i] * Math.sin(th[i]));
  return e;
}

/** ∂Π/∂θ_i for i = 1…n into g (g[0] unused). */
export function gradient(c: Chain, th: Float64Array, gx: Float64Array, gy: Float64Array, g: Float64Array): void {
  const { n, kappa, len } = c;
  g[0] = 0;
  for (let i = 1; i <= n; i++) {
    let s = kappa * (th[i] - th[i - 1]);
    if (i < n) s -= kappa * (th[i + 1] - th[i]);
    g[i] = s - len[i] * (-gx[i] * Math.sin(th[i]) + gy[i] * Math.cos(th[i]));
  }
}

/** The tridiagonal Hessian: diagonal d[1…n], off-diagonal −κ. */
export function hessian(c: Chain, th: Float64Array, gx: Float64Array, gy: Float64Array, d: Float64Array): void {
  const { n, kappa, len } = c;
  for (let i = 1; i <= n; i++) {
    d[i] = kappa * (i < n ? 2 : 1) + len[i] * (gx[i] * Math.cos(th[i]) + gy[i] * Math.sin(th[i]));
  }
}

/**
 * (d + shift, −κ) x = b by the LDLᵀ of a symmetric tridiagonal matrix; null when a pivot is not
 * positive, so a solve that returns is a descent direction. negatives counts the negative pivots
 * (Sylvester: the eigenvalues below zero) without solving.
 */
export function solveTridiagonal(d: Float64Array, off: number, shift: number, b: Float64Array, n: number): Float64Array | null {
  const piv = new Float64Array(n + 1);
  const y = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const l = i > 1 ? off / piv[i - 1] : 0;
    piv[i] = d[i] + shift - (i > 1 ? l * off : 0);
    if (!(piv[i] > 0)) return null;
    y[i] = b[i] - (i > 1 ? l * y[i - 1] : 0);
  }
  const x = new Float64Array(n + 1);
  for (let i = n; i >= 1; i--) x[i] = (y[i] - (i < n ? off * x[i + 1] : 0)) / piv[i];
  return x;
}

export function negatives(d: Float64Array, off: number, n: number): number {
  let count = 0;
  let prev = 1;
  for (let i = 1; i <= n; i++) {
    const p = d[i] - (i > 1 ? (off * off) / prev : 0);
    if (p < 0) count++;
    prev = p === 0 ? 1e-300 : p;
  }
  return count;
}

export interface Solve {
  iterations: number;
  /** the largest |∂Π/∂θ_i| at the end, relative to κ */
  residual: number;
}

/**
 * Π's minimum from th, in place: Newton's step on the tridiagonal Hessian, shifted until it is
 * positive definite where the start is not a minimum (past a buckling load), with a backtracking
 * line search on Π. Stops once every |∂Π/∂θ_i| ≤ tol·κ.
 */
export function minimise(c: Chain, th: Float64Array, gx: Float64Array, gy: Float64Array, tol = 1e-12, cap = 200): Solve {
  const n = c.n;
  const g = new Float64Array(n + 1);
  const d = new Float64Array(n + 1);
  const trial = new Float64Array(n + 1);
  let it = 0;
  let res = Infinity;
  for (; it < cap; it++) {
    gradient(c, th, gx, gy, g);
    res = 0;
    for (let i = 1; i <= n; i++) res = Math.max(res, Math.abs(g[i]) / c.kappa);
    if (res <= tol) break;
    hessian(c, th, gx, gy, d);
    const b = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) b[i] = -g[i];
    let shift = 0;
    let step = solveTridiagonal(d, -c.kappa, 0, b, n);
    while (step === null) {
      shift = shift === 0 ? 1e-6 * c.kappa : shift * 4;
      step = solveTridiagonal(d, -c.kappa, shift, b, n);
    }
    const p0 = potential(c, th, gx, gy);
    let slope = 0;
    for (let i = 1; i <= n; i++) slope += g[i] * step[i];
    let a = 1;
    for (let k = 0; k < 60; k++, a *= 0.5) {
      trial[0] = 0;
      for (let i = 1; i <= n; i++) trial[i] = th[i] + a * step[i];
      const p1 = potential(c, trial, gx, gy);
      if (p1 <= p0 + 1e-4 * a * slope || Math.abs(p1 - p0) <= 1e-15 * Math.abs(p0) + 1e-300) break;
    }
    for (let i = 1; i <= n; i++) th[i] = trial[i];
  }
  return { iterations: it, residual: res };
}

/** The joints' and the tip's positions, from the clamp at the origin. */
export function positions(c: Chain, th: Float64Array): { x: Float64Array; y: Float64Array } {
  const x = new Float64Array(c.n + 2);
  const y = new Float64Array(c.n + 2);
  for (let i = 0; i <= c.n; i++) {
    x[i + 1] = x[i] + c.len[i] * Math.cos(th[i]);
    y[i + 1] = y[i] + c.len[i] * Math.sin(th[i]);
  }
  return { x, y };
}

/**
 * The chain's own buckling load under a tip load along −x, straight: the least P at which the
 * Hessian K − P·diag(len) has a negative eigenvalue, by bisection on its count of negative pivots.
 */
export function bucklingLoad(c: Chain): number {
  const d = new Float64Array(c.n + 1);
  const count = (P: number) => {
    for (let i = 1; i <= c.n; i++) d[i] = c.kappa * (i < c.n ? 2 : 1) - P * c.len[i];
    return negatives(d, -c.kappa, c.n);
  };
  let lo = 0;
  let hi = c.kappa;
  while (count(hi) === 0) hi *= 2;
  for (let k = 0; k < 200 && hi - lo > 1e-15 * hi; k++) {
    const mid = 0.5 * (lo + hi);
    if (count(mid) === 0) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}
