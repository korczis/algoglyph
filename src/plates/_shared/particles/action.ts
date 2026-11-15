// The discrete action of a particle of unit mass in a potential V(q), and the path that makes it
// stationary with both ends held (plan S5, least action). With N steps of h = T/N the action is
//   S(q) = Σₖ [ (qₖ₊₁ − qₖ)²/2h − (h/2)(V(qₖ) + V(qₖ₊₁)) ],
// the kinetic term by differences and the potential by the trapezoidal rule. Its gradient in an
// interior qₖ is (2qₖ − qₖ₋₁ − qₖ₊₁)/h − h V′(qₖ) and its Hessian is tridiagonal, 2/h − h V″(qₖ) on
// the diagonal and −1/h beside it. Newton's method on the gradient, each step one tridiagonal solve
// (the Thomas algorithm) with a backtracking line search on the gradient's size, finds the stationary
// path from a straight-line guess. Setting the gradient to zero is the recurrence
// qₖ₊₁ = 2qₖ − qₖ₋₁ − h²V′(qₖ), Störmer–Verlet: the integrator is the stationary point of this
// action, which the tests and claims check by shooting Verlet from the path's first two points. The
// number of negative eigenvalues of the Hessian (its Morse index, by a Sturm count of the LDLᵀ
// pivots) says whether the stationary path is a minimum or a saddle. Pure: no p5, no randomness.

export interface Potential {
  V(q: number): number;
  dV(q: number): number;
  d2V(q: number): number;
}

export const harmonic = (omega: number): Potential => ({
  V: (q) => 0.5 * omega * omega * q * q, dV: (q) => omega * omega * q, d2V: () => omega * omega,
});
export const uniform = (g: number): Potential => ({ V: (q) => g * q, dV: () => g, d2V: () => 0 });
export const pendulum = (omega: number): Potential => ({
  V: (q) => omega * omega * (1 - Math.cos(q)), dV: (q) => omega * omega * Math.sin(q), d2V: (q) => omega * omega * Math.cos(q),
});
export const quartic = (c: number): Potential => ({ V: (q) => 0.25 * c * q ** 4, dV: (q) => c * q ** 3, d2V: (q) => 3 * c * q * q });

/** The discrete action of the path q (q[0] and q[N] are its ends). */
export function action(pot: Potential, q: ArrayLike<number>, h: number): number {
  let s = 0;
  for (let k = 0; k + 1 < q.length; k++) {
    const d = q[k + 1] - q[k];
    s += (d * d) / (2 * h) - 0.5 * h * (pot.V(q[k]) + pot.V(q[k + 1]));
  }
  return s;
}

/** The gradient of the action in the interior points, written into g (g[0] = g[N] = 0). */
export function gradient(pot: Potential, q: ArrayLike<number>, h: number, g: Float64Array): number {
  let worst = 0;
  g[0] = 0;
  g[q.length - 1] = 0;
  for (let k = 1; k + 1 < q.length; k++) {
    g[k] = (2 * q[k] - q[k - 1] - q[k + 1]) / h - h * pot.dV(q[k]);
    worst = Math.max(worst, Math.abs(g[k]));
  }
  return worst;
}

/** The diagonal of the Hessian over the interior points (its off-diagonal is −1/h throughout). */
export function hessianDiagonal(pot: Potential, q: ArrayLike<number>, h: number): Float64Array {
  const n = q.length - 2;
  const d = new Float64Array(Math.max(0, n));
  for (let i = 0; i < n; i++) d[i] = 2 / h - h * pot.d2V(q[i + 1]);
  return d;
}

/** The number of negative eigenvalues of the symmetric tridiagonal matrix (diagonal d, constant
 * off-diagonal e): the negative pivots of its LDLᵀ factorisation, Sylvester's law of inertia. */
export function morseIndex(d: ArrayLike<number>, e: number): number {
  let count = 0;
  let p = 1;
  for (let i = 0; i < d.length; i++) {
    p = d[i] - (i > 0 ? (e * e) / p : 0);
    if (p === 0) p = -1e-300;
    if (p < 0) count++;
  }
  return count;
}

/** x solving the tridiagonal system (diagonal d, off-diagonal e) x = r, by the Thomas algorithm. */
export function thomas(d: ArrayLike<number>, e: number, r: ArrayLike<number>): Float64Array {
  const n = d.length;
  const c = new Float64Array(n);
  const x = new Float64Array(n);
  let p = d[0];
  x[0] = r[0] / p;
  for (let i = 1; i < n; i++) {
    c[i - 1] = e / p;
    p = d[i] - e * c[i - 1];
    x[i] = (r[i] - e * x[i - 1]) / p;
  }
  for (let i = n - 2; i >= 0; i--) x[i] -= c[i] * x[i + 1];
  return x;
}

export interface StationaryPath {
  q: Float64Array;
  h: number;
  /** Every iterate, the straight-line guess first. */
  iterates: Float64Array[];
  /** The largest |∂S/∂qₖ| of each iterate. */
  residuals: number[];
  converged: boolean;
  /** Found by shooting, then polished by Newton, because Newton from the straight line failed. */
  shot: boolean;
}

/**
 * The stationary path from a to b in time T with N steps, by damped Newton from the straight line.
 * Where that does not converge (a nonlinear potential over a long time, whose gradient's size has
 * other minima), the path is found by shooting instead: Verlet from q₀ = a with a first step q₁ =
 * a + v h, v scanned over [−10, 10] and every sign change of q_N(v) − b refined by bisection; of the
 * paths that hit b, the one whose start is nearest the straight line's is polished by Newton.
 */
export function stationaryPath(pot: Potential, a: number, b: number, T: number, N: number, maxIter = 50): StationaryPath {
  const direct = newton(pot, a, b, T, N, null, maxIter);
  if (direct.converged) return direct;
  const h = T / N;
  const miss = (v: number) => verletShoot(pot, a, a + v * h, h, N)[N] - b;
  const straight = (b - a) / T;
  let best = Number.NaN;
  let prev = miss(-10);
  for (let i = 1; i <= 800; i++) {
    const v1 = -10 + (20 * i) / 800;
    const f1 = miss(v1);
    if (Number.isFinite(prev) && Number.isFinite(f1) && Math.sign(prev) !== Math.sign(f1)) {
      let lo = v1 - 20 / 800;
      let hi = v1;
      const flo = Math.sign(prev);
      for (let k = 0; k < 80; k++) {
        const mid = 0.5 * (lo + hi);
        if (Math.sign(miss(mid)) === flo) lo = mid; else hi = mid;
      }
      const v = 0.5 * (lo + hi);
      if (!Number.isFinite(best) || Math.abs(v - straight) < Math.abs(best - straight)) best = v;
    }
    prev = f1;
  }
  if (!Number.isFinite(best)) return direct;
  const shot = verletShoot(pot, a, a + best * h, h, N);
  shot[N] = b;
  const polished = newton(pot, a, b, T, N, shot, maxIter);
  return { ...polished, shot: true, iterates: [direct.iterates[0], shot, ...polished.iterates.slice(1)], residuals: [direct.residuals[0], ...polished.residuals] };
}

function newton(pot: Potential, a: number, b: number, T: number, N: number, start: Float64Array | null, maxIter: number): StationaryPath {
  const h = T / N;
  let q = start ? Float64Array.from(start) : Float64Array.from({ length: N + 1 }, (_, k) => a + ((b - a) * k) / N);
  const g = new Float64Array(N + 1);
  const iterates = [Float64Array.from(q)];
  const residuals = [gradient(pot, q, h, g)];
  let converged = residuals[0] < 1e-13;
  for (let it = 0; it < maxIter && !converged; it++) {
    const d = hessianDiagonal(pot, q, h);
    const step = thomas(d, -1 / h, g.subarray(1, N));
    let t = 1;
    let next = q;
    let r = Infinity;
    const trial = new Float64Array(N + 1);
    // backtrack until the gradient shrinks; a full Newton step is taken whenever it does
    for (let k = 0; k < 30; k++) {
      trial[0] = a;
      trial[N] = b;
      for (let i = 1; i < N; i++) trial[i] = q[i] - t * step[i - 1];
      r = gradient(pot, trial, h, new Float64Array(N + 1));
      if (Number.isFinite(r) && r < residuals[residuals.length - 1]) { next = Float64Array.from(trial); break; }
      t *= 0.5;
    }
    if (next === q) break;
    q = next;
    gradient(pot, q, h, g);
    iterates.push(Float64Array.from(q));
    residuals.push(r);
    converged = r < 1e-12 * Math.max(1, 1 / h);
  }
  return { q, h, iterates, residuals, converged, shot: false };
}

/** Störmer–Verlet shot from q₀ and q₁: qₖ₊₁ = 2qₖ − qₖ₋₁ − h²V′(qₖ), N + 1 points. */
export function verletShoot(pot: Potential, q0: number, q1: number, h: number, N: number): Float64Array<ArrayBuffer> {
  const q = new Float64Array(N + 1);
  q[0] = q0;
  q[1] = q1;
  for (let k = 1; k < N; k++) q[k + 1] = 2 * q[k] - q[k - 1] - h * h * pot.dV(q[k]);
  return q;
}
