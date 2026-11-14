// Electrostatics on a grid (plan S8b), the second back-end beside superposition.ts: −∇·(ε∇φ) = ρ on
// the unit square sampled at n × n nodes, the box's edge grounded (φ = 0), conductors as nodes held
// at a potential, ε per node with each face taking the harmonic mean of its two nodes (so the
// normal flux D·n is continuous across an interface between them). The free nodes form a symmetric
// positive-definite system, solved by conjugate gradients with a Jacobi preconditioner, resumable
// an iteration at a time so a plate spreads the solve over frames and shows it converging.
// Measured from the solution, never assumed: the charge on each conductor as the discrete flux out
// of it (Gauss's law on the grid, Q = h² Σ (Aφ − ρ) over its nodes), the field by differences, and
// the energy two ways, ½Σε|∇φ|² over the faces and ½(ΣQV + Σρφh²) over the sources.

export interface Grid {
  n: number;
  h: number;
  /** Permittivity at each node. */
  eps: Float64Array;
  /** Charge density at each node. */
  rho: Float64Array;
  /** 0 for a free node; otherwise the conductor's number: 1 is the box's edge, 2 and on the conductors inside. */
  fixed: Int32Array;
  /** The potential: the fixed nodes' values are given, the free ones solved. */
  phi: Float64Array;
}

/** A grid of n × n nodes, ε = 1, no charge, the edge grounded as conductor 1 at φ = 0. */
export function makeGrid(n: number): Grid {
  const g: Grid = {
    n, h: 1 / (n - 1), eps: new Float64Array(n * n).fill(1), rho: new Float64Array(n * n),
    fixed: new Int32Array(n * n), phi: new Float64Array(n * n),
  };
  for (let i = 0; i < n; i++) {
    for (const k of [i, (n - 1) * n + i, i * n, i * n + n - 1]) g.fixed[k] = 1;
  }
  return g;
}

/** Hold the nodes where `inside(x, y)` as conductor `id` at potential V. */
export function conductor(g: Grid, id: number, V: number, inside: (x: number, y: number) => boolean): number {
  let count = 0;
  for (let j = 1; j < g.n - 1; j++) {
    for (let i = 1; i < g.n - 1; i++) {
      if (!inside(i * g.h, j * g.h)) continue;
      const k = j * g.n + i;
      g.fixed[k] = id;
      g.phi[k] = V;
      count++;
    }
  }
  return count;
}

const face = (a: number, b: number) => (2 * a * b) / (a + b);

/** (Aφ)ₖ = Σ over the four faces ε_f (φₖ − φ_nb)/h², at an interior node k. */
function applyAt(g: Grid, phi: Float64Array, k: number): number {
  const { n, eps } = g;
  const e = eps[k];
  const p = phi[k];
  return (face(e, eps[k - 1]) * (p - phi[k - 1]) + face(e, eps[k + 1]) * (p - phi[k + 1])
    + face(e, eps[k - n]) * (p - phi[k - n]) + face(e, eps[k + n]) * (p - phi[k + n])) / (g.h * g.h);
}

/**
 * Conjugate gradients on the free nodes, from the potential the grid holds (the fixed nodes' values
 * enter as the right-hand side through the operator). `advance(k)` runs k iterations; `residual` is
 * ‖ρ − Aφ‖ over the free nodes, relative to the right-hand side's norm.
 */
export class Solve {
  iterations = 0;
  residual = 1;
  private readonly r: Float64Array;
  private readonly z: Float64Array;
  private readonly d: Float64Array;
  private readonly q: Float64Array;
  private readonly diag: Float64Array;
  private readonly free: Int32Array;
  private rz = 0;
  private readonly norm: number;

  constructor(private readonly g: Grid) {
    const N = g.n * g.n;
    const free: number[] = [];
    for (let k = 0; k < N; k++) if (!g.fixed[k]) free.push(k);
    this.free = Int32Array.from(free);
    this.r = new Float64Array(N);
    this.z = new Float64Array(N);
    this.d = new Float64Array(N);
    this.q = new Float64Array(N);
    this.diag = new Float64Array(N);
    const { n, eps } = g;
    let b2 = 0;
    for (const k of this.free) {
      const e = eps[k];
      this.diag[k] = (face(e, eps[k - 1]) + face(e, eps[k + 1]) + face(e, eps[k - n]) + face(e, eps[k + n])) / (g.h * g.h);
      // the right-hand side: the charge, plus the fixed neighbours' pull (their part of Aφ moved across)
      this.r[k] = g.rho[k] - applyAt(g, g.phi, k);
      // ‖b‖ with b = ρ + (fixed neighbours' terms): Aφ₀ computed with the free part zeroed
      b2 += this.r[k] * this.r[k];
    }
    this.norm = Math.sqrt(b2) || 1;
    for (const k of this.free) this.z[k] = this.r[k] / this.diag[k];
    this.d.set(this.z);
    for (const k of this.free) this.rz += this.r[k] * this.z[k];
    this.residual = Math.sqrt(b2) / this.norm;
  }

  /** Run up to `k` iterations, stopping once the relative residual is below `tol`; true when below. */
  advance(k: number, tol: number): boolean {
    const { g, r, z, d, q, diag, free } = this;
    for (let it = 0; it < k && this.residual > tol; it++) {
      let dq = 0;
      for (const m of free) {
        // A applied to the direction alone: fixed nodes contribute nothing (d is zero there)
        q[m] = applyAt(g, d, m);
        dq += d[m] * q[m];
      }
      const alpha = this.rz / dq;
      let r2 = 0;
      let rz = 0;
      for (const m of free) {
        g.phi[m] += alpha * d[m];
        r[m] -= alpha * q[m];
        z[m] = r[m] / diag[m];
        r2 += r[m] * r[m];
        rz += r[m] * z[m];
      }
      const beta = rz / this.rz;
      this.rz = rz;
      for (const m of free) d[m] = z[m] + beta * d[m];
      this.iterations++;
      this.residual = Math.sqrt(r2) / this.norm;
    }
    return this.residual <= tol;
  }
}

/** The charge on conductor `id`: Gauss's law on the grid, h² Σ (Aφ − ρ) over its interior nodes. */
export function chargeOn(g: Grid, id: number): number {
  const { n } = g;
  let q = 0;
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      if (g.fixed[k] === id) q += (applyAt(g, g.phi, k) - g.rho[k]) * g.h * g.h;
    }
  }
  return q;
}

/** The field energy ½ Σ over faces ε_f (Δφ)², the discrete ½∫ε|E|² (per unit length). */
export function fieldEnergy(g: Grid): number {
  const { n, eps, phi } = g;
  let w = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (i + 1 < n) w += face(eps[k], eps[k + 1]) * (phi[k + 1] - phi[k]) ** 2;
      if (j + 1 < n) w += face(eps[k], eps[k + n]) * (phi[k + n] - phi[k]) ** 2;
    }
  }
  return 0.5 * w;
}

/** The field E = −∇φ at node (i, j) by central differences. */
export function fieldAt(g: Grid, i: number, j: number): [number, number] {
  const { n, phi, h } = g;
  const k = j * n + i;
  return [-(phi[k + 1] - phi[k - 1]) / (2 * h), -(phi[k + n] - phi[k - n]) / (2 * h)];
}

/**
 * The potential of a line charge q at (x0, y0) in the grounded unit square, by its sine series in x
 * with the exact hyperbolic solution in y for each mode: an independent solution, converging
 * exponentially away from the source row. (ε = 1.)
 */
export function boxSeries(q: number, x0: number, y0: number, x: number, y: number, modes = 400): number {
  let s = 0;
  for (let m = 1; m <= modes; m++) {
    const k = m * Math.PI;
    const lo = Math.min(y, y0);
    const hi = Math.max(y, y0);
    // G_m(y, y0) = sinh(k lo) sinh(k (1 − hi)) / (k sinh k), written to avoid overflow
    const g = (Math.exp(k * (lo - hi)) + Math.exp(k * (hi - lo - 2)) - Math.exp(k * (lo + hi - 2)) - Math.exp(-k * (lo + hi)))
      / (2 * k * (1 - Math.exp(-2 * k)));
    s += 2 * Math.sin(k * x) * Math.sin(k * x0) * g;
  }
  return q * s;
}
