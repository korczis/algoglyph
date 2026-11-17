// A triangular lattice of equal masses joined to their six nearest neighbours by equal springs,
// in the small-displacement (linear) limit: a bond of unit direction n pulls its two ends together
// with k·n·(u_q − u_p) along n. Two uses: a sheet held by grips at its ends, relaxed to equilibrium
// by conjugate gradients on the free degrees of freedom; and a periodic sheet stepped in time by
// velocity Verlet. Spacing a = 1 and mass m = 1; rows are a√3/2 apart, odd rows shifted by a/2.

export interface Lattice {
  /** columns and rows */
  nx: number;
  ny: number;
  /** rest positions */
  x: Float64Array;
  y: Float64Array;
  /** bonds: ends and unit direction */
  bp: Int32Array;
  bq: Int32Array;
  ex: Float64Array;
  ey: Float64Array;
  k: number;
  periodic: boolean;
}

export const ROW = Math.sqrt(3) / 2;

/** Site index of column i, row j. */
export const site = (nx: number, i: number, j: number): number => j * nx + i;

/**
 * The lattice of nx × ny sites. Periodic: both directions wrap (ny must be even), so every site
 * has six neighbours. Open: the sheet ends at its four sides.
 */
export function lattice(nx: number, ny: number, k: number, periodic: boolean): Lattice {
  if (periodic && ny % 2 !== 0) throw new Error('a periodic triangular lattice needs an even number of rows');
  const n = nx * ny;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      x[site(nx, i, j)] = i + 0.5 * (j % 2);
      y[site(nx, i, j)] = j * ROW;
    }
  }
  const P: number[] = [];
  const Q: number[] = [];
  const EX: number[] = [];
  const EY: number[] = [];
  const add = (p: number, i: number, j: number, dx: number, dy: number) => {
    if (periodic) {
      i = (i + nx) % nx;
      j = (j + ny) % ny;
    } else if (i < 0 || i >= nx || j < 0 || j >= ny) return;
    P.push(p);
    Q.push(site(nx, i, j));
    EX.push(dx);
    EY.push(dy);
  };
  for (let j = 0; j < ny; j++) {
    const odd = j % 2;
    for (let i = 0; i < nx; i++) {
      const p = site(nx, i, j);
      add(p, i + 1, j, 1, 0);
      // up and to the right, up and to the left: an odd row's upper neighbours are i and i + 1
      add(p, i + odd, j + 1, 0.5, ROW);
      add(p, i - 1 + odd, j + 1, -0.5, ROW);
    }
  }
  return {
    nx, ny, x, y, k, periodic,
    bp: Int32Array.from(P), bq: Int32Array.from(Q), ex: Float64Array.from(EX), ey: Float64Array.from(EY),
  };
}

/** The bond's stretch n·(u_q − u_p). */
export function stretch(L: Lattice, b: number, ux: Float64Array, uy: Float64Array): number {
  const p = L.bp[b];
  const q = L.bq[b];
  return L.ex[b] * (ux[q] - ux[p]) + L.ey[b] * (uy[q] - uy[p]);
}

/** K·u into (fx, fy): minus the spring forces on each site. */
export function stiffness(L: Lattice, ux: Float64Array, uy: Float64Array, fx: Float64Array, fy: Float64Array): void {
  fx.fill(0);
  fy.fill(0);
  const { bp, bq, ex, ey, k } = L;
  for (let b = 0; b < bp.length; b++) {
    const p = bp[b];
    const q = bq[b];
    const nx = ex[b];
    const ny = ey[b];
    const s = k * (nx * (ux[q] - ux[p]) + ny * (uy[q] - uy[p]));
    fx[p] -= s * nx;
    fy[p] -= s * ny;
    fx[q] += s * nx;
    fy[q] += s * ny;
  }
}

/** The springs' energy ½k Σ (n·Δu)². */
export function strainEnergy(L: Lattice, ux: Float64Array, uy: Float64Array): number {
  let e = 0;
  for (let b = 0; b < L.bp.length; b++) {
    const s = stretch(L, b, ux, uy);
    e += s * s;
  }
  return 0.5 * L.k * e;
}

/**
 * Conjugate gradients for K u = 0 with some degrees of freedom held: `held` marks them (x of site
 * p at 2p, y at 2p + 1) and u already carries their values. One call to `iterate` is one CG step;
 * the residual is that of the free equations, relative to the first one.
 */
export class Relaxation {
  readonly ux: Float64Array;
  readonly uy: Float64Array;
  private rx: Float64Array;
  private ry: Float64Array;
  private px: Float64Array;
  private py: Float64Array;
  private ax: Float64Array;
  private ay: Float64Array;
  private rr = 0;
  private r0 = 0;
  iterations = 0;

  constructor(readonly L: Lattice, ux: Float64Array, uy: Float64Array, readonly held: Uint8Array) {
    const n = ux.length;
    this.ux = ux;
    this.uy = uy;
    this.rx = new Float64Array(n);
    this.ry = new Float64Array(n);
    this.ax = new Float64Array(n);
    this.ay = new Float64Array(n);
    stiffness(L, ux, uy, this.ax, this.ay);
    for (let p = 0; p < n; p++) {
      this.rx[p] = held[2 * p] ? 0 : -this.ax[p];
      this.ry[p] = held[2 * p + 1] ? 0 : -this.ay[p];
    }
    this.px = Float64Array.from(this.rx);
    this.py = Float64Array.from(this.ry);
    this.rr = this.dot(this.rx, this.ry, this.rx, this.ry);
    this.r0 = Math.sqrt(this.rr);
  }

  private dot(ax: Float64Array, ay: Float64Array, bx: Float64Array, by: Float64Array): number {
    let s = 0;
    for (let p = 0; p < ax.length; p++) s += ax[p] * bx[p] + ay[p] * by[p];
    return s;
  }

  /** The free residual relative to the first (0 when the start was already in equilibrium). */
  residual(): number {
    return this.r0 === 0 ? 0 : Math.sqrt(this.rr) / this.r0;
  }

  iterate(): void {
    if (this.rr === 0) return;
    const { L, held, px, py, ax, ay } = this;
    stiffness(L, px, py, ax, ay);
    for (let p = 0; p < ax.length; p++) {
      if (held[2 * p]) ax[p] = 0;
      if (held[2 * p + 1]) ay[p] = 0;
    }
    const alpha = this.rr / this.dot(px, py, ax, ay);
    for (let p = 0; p < ax.length; p++) {
      this.ux[p] += alpha * px[p];
      this.uy[p] += alpha * py[p];
      this.rx[p] -= alpha * ax[p];
      this.ry[p] -= alpha * ay[p];
    }
    const rr = this.dot(this.rx, this.ry, this.rx, this.ry);
    const beta = rr / this.rr;
    this.rr = rr;
    for (let p = 0; p < ax.length; p++) {
      px[p] = this.rx[p] + beta * px[p];
      py[p] = this.ry[p] + beta * py[p];
    }
    this.iterations++;
  }
}

/** Velocity Verlet on the periodic lattice, unit masses. */
export class Dynamics {
  readonly ux: Float64Array;
  readonly uy: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  private fx: Float64Array;
  private fy: Float64Array;

  constructor(readonly L: Lattice, ux: Float64Array, uy: Float64Array, vx: Float64Array, vy: Float64Array) {
    this.ux = ux;
    this.uy = uy;
    this.vx = vx;
    this.vy = vy;
    this.fx = new Float64Array(ux.length);
    this.fy = new Float64Array(ux.length);
    stiffness(L, ux, uy, this.fx, this.fy);
  }

  step(h: number): void {
    const { ux, uy, vx, vy, fx, fy } = this;
    const n = ux.length;
    // fx holds K·u, so the acceleration is −fx
    for (let p = 0; p < n; p++) {
      vx[p] -= 0.5 * h * fx[p];
      vy[p] -= 0.5 * h * fy[p];
      ux[p] += h * vx[p];
      uy[p] += h * vy[p];
    }
    stiffness(this.L, ux, uy, fx, fy);
    for (let p = 0; p < n; p++) {
      vx[p] -= 0.5 * h * fx[p];
      vy[p] -= 0.5 * h * fy[p];
    }
  }

  energy(): number {
    let e = 0;
    for (let p = 0; p < this.vx.length; p++) e += this.vx[p] * this.vx[p] + this.vy[p] * this.vy[p];
    return 0.5 * e + strainEnergy(this.L, this.ux, this.uy);
  }

  momentum(): [number, number] {
    let a = 0;
    let b = 0;
    for (let p = 0; p < this.vx.length; p++) {
      a += this.vx[p];
      b += this.vy[p];
    }
    return [a, b];
  }
}
