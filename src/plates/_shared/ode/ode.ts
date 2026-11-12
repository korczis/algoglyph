// One integrator library for the small systems of the collection (plan S0): explicit Euler,
// symplectic Euler, leapfrog (kick-drift-kick), the classical Runge–Kutta, the Boris push for a
// charge in E and B, and Crank–Nicolson for a linear complex flow dψ/dt = −iHψ. Each works on a
// Float64Array state of any length, in place, with scratch it is handed or owns; none allocates
// per step. The arithmetic of each step is written once, in the order the plates that used to
// carry their own copies wrote it, so their trajectories are unchanged bit for bit
// (test/ode.test.ts pins them). Measured orders on the harmonic oscillator: 1, 1, 2, 4, and 2 for
// Crank–Nicolson; the symplectic two keep the energy bounded where explicit Euler lets it grow.
// Hot vectorised loops (the cloth, the ripple tank) keep their own inner kernels.

/** dy/dt = f(t, y), written into `out`. */
export type Deriv = (t: number, y: Float64Array, out: Float64Array) => void;

/** One explicit Euler step, in place; `scratch` holds f(t, y). First order, energy grows. */
export function euler(f: Deriv, t: number, y: Float64Array, h: number, scratch: Float64Array): void {
  f(t, y, scratch);
  for (let i = 0; i < y.length; i++) y[i] += h * scratch[i];
}

/** The classical fourth-order Runge–Kutta method, with its own stage buffers for a state of n. */
export class Rk4 {
  private readonly k1: Float64Array;
  private readonly k2: Float64Array;
  private readonly k3: Float64Array;
  private readonly k4: Float64Array;
  private readonly tmp: Float64Array;

  constructor(readonly n: number) {
    this.k1 = new Float64Array(n);
    this.k2 = new Float64Array(n);
    this.k3 = new Float64Array(n);
    this.k4 = new Float64Array(n);
    this.tmp = new Float64Array(n);
  }

  /** One step of h from t, in place. */
  step(f: Deriv, t: number, y: Float64Array, h: number): void {
    const { k1, k2, k3, k4, tmp } = this;
    const n = y.length;
    const half = h / 2;
    f(t, y, k1);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + k1[i] * half;
    f(t + half, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + k2[i] * half;
    f(t + half, tmp, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + k3[i] * h;
    f(t + h, tmp, k4);
    for (let i = 0; i < n; i++) y[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
}

const rk4Cache = new Map<number, Rk4>();

/** One RK4 step returning a new state: for callers that keep immutable tuples. */
export function rk4Step(f: Deriv, t: number, y: Float64Array, h: number): Float64Array {
  let rk = rk4Cache.get(y.length);
  if (!rk) rk4Cache.set(y.length, (rk = new Rk4(y.length)));
  const out = Float64Array.from(y);
  rk.step(f, t, out, h);
  return out;
}

/**
 * One symplectic Euler step for q'' = a(q): kick with the force at the current position, then
 * drift with the new velocity. First order and symplectic: the energy oscillates, never drifts.
 */
export function symplecticEuler(q: Float64Array, p: Float64Array, h: number,
  accel: (q: Float64Array, a: Float64Array) => void, a: Float64Array): void {
  accel(q, a);
  for (let k = 0; k < q.length; k++) p[k] += h * a[k];
  for (let k = 0; k < q.length; k++) q[k] += h * p[k];
}

/**
 * One kick-drift-kick leapfrog step for q'' = a(q); `a` must hold the acceleration at the current
 * q and holds it at the new q afterwards. Second order, symplectic, time-reversible.
 */
export function leapfrog(q: Float64Array, v: Float64Array, a: Float64Array, h: number,
  accel: (q: Float64Array, a: Float64Array) => void): void {
  for (let k = 0; k < q.length; k++) v[k] += 0.5 * h * a[k];
  for (let k = 0; k < q.length; k++) q[k] += h * v[k];
  accel(q, a);
  for (let k = 0; k < q.length; k++) v[k] += 0.5 * h * a[k];
}

/**
 * One Boris step for a charge of charge-to-mass ratio qm in uniform E and B (3-D, non-relativistic):
 * half an electric kick, a rotation about B that keeps |v| exactly, the other half kick, a drift.
 */
export function boris(x: Float64Array, v: Float64Array, h: number, qm: number,
  E: Float64Array, B: Float64Array): void {
  const c = (qm * h) / 2;
  const vx = v[0] + c * E[0];
  const vy = v[1] + c * E[1];
  const vz = v[2] + c * E[2];
  const tx = c * B[0];
  const ty = c * B[1];
  const tz = c * B[2];
  const t2 = tx * tx + ty * ty + tz * tz;
  const sx = (2 * tx) / (1 + t2);
  const sy = (2 * ty) / (1 + t2);
  const sz = (2 * tz) / (1 + t2);
  // v' = v⁻ + v⁻ × t, then v⁺ = v⁻ + v' × s
  const px = vx + (vy * tz - vz * ty);
  const py = vy + (vz * tx - vx * tz);
  const pz = vz + (vx * ty - vy * tx);
  v[0] = vx + (py * sz - pz * sy) + c * E[0];
  v[1] = vy + (pz * sx - px * sz) + c * E[1];
  v[2] = vz + (px * sy - py * sx) + c * E[2];
  x[0] += h * v[0];
  x[1] += h * v[1];
  x[2] += h * v[2];
}

/**
 * One Crank–Nicolson step of dψ/dt = −iHψ for a small dense H (real part `H`, optional imaginary
 * part `Hi`): (I + i h H/2) ψ⁺ = (I − i h H/2) ψ, solved by complex Gaussian elimination with
 * partial pivoting. Unitary for Hermitian H, second order, unconditionally stable.
 */
export function crankNicolson(H: number[][], re: Float64Array, im: Float64Array, h: number,
  Hi?: number[][]): void {
  const n = re.length;
  const g = h / 2;
  // A = I + i g H, b = (I − i g H) ψ, with H = Hr + i Hi: i g H = −g Hi + i g Hr
  const ar: number[][] = [];
  const ai: number[][] = [];
  const br = new Float64Array(n);
  const bi = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    ar.push([]);
    ai.push([]);
    let sr = re[r];
    let si = im[r];
    for (let c = 0; c < n; c++) {
      const hr = H[r][c];
      const hi = Hi ? Hi[r][c] : 0;
      ar[r].push((r === c ? 1 : 0) - g * hi);
      ai[r].push(g * hr);
      // − i g (hr + i hi)(ψr + i ψi) = g hi ψr − g hr ... : (−i g H) ψ
      sr += g * (hi * re[c] + hr * im[c]);
      si += g * (hi * im[c] - hr * re[c]);
    }
    br[r] = sr;
    bi[r] = si;
  }
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.hypot(ar[r][col], ai[r][col]) > Math.hypot(ar[piv][col], ai[piv][col])) piv = r;
    }
    [ar[col], ar[piv]] = [ar[piv], ar[col]];
    [ai[col], ai[piv]] = [ai[piv], ai[col]];
    [br[col], br[piv]] = [br[piv], br[col]];
    [bi[col], bi[piv]] = [bi[piv], bi[col]];
    const pr = ar[col][col];
    const pi = ai[col][col];
    const den = pr * pr + pi * pi;
    for (let r = col + 1; r < n; r++) {
      // factor = A[r][col] / A[col][col]
      const fr = (ar[r][col] * pr + ai[r][col] * pi) / den;
      const fi = (ai[r][col] * pr - ar[r][col] * pi) / den;
      for (let c = col; c < n; c++) {
        const xr = ar[col][c];
        const xi = ai[col][c];
        ar[r][c] -= fr * xr - fi * xi;
        ai[r][c] -= fr * xi + fi * xr;
      }
      const yr = br[col];
      const yi = bi[col];
      br[r] -= fr * yr - fi * yi;
      bi[r] -= fr * yi + fi * yr;
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let sr = br[r];
    let si = bi[r];
    for (let c = r + 1; c < n; c++) {
      sr -= ar[r][c] * re[c] - ai[r][c] * im[c];
      si -= ar[r][c] * im[c] + ai[r][c] * re[c];
    }
    const pr = ar[r][r];
    const pi = ai[r][r];
    const den = pr * pr + pi * pi;
    re[r] = (sr * pr + si * pi) / den;
    im[r] = (si * pr - sr * pi) / den;
  }
}
