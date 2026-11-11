// Reynolds boids (1987) in a box with soft walls: separation, alignment and cohesion within a
// perception radius, each a steering force (desired velocity minus current velocity) capped at a
// maximum force, and speed held between a floor and a ceiling. Neighbours come from a uniform
// grid whose cells are at least one radius wide, so a query visits 27 cells instead of N boids.
// Positions and velocities are packed xyz arrays.

export type V3 = [number, number, number];

export interface Rules {
  separation: number;
  alignment: number;
  cohesion: number;
  /** Perception radius for alignment and cohesion; separation acts within half of it. */
  radius: number;
  maxSpeed: number;
  /** Speed floor as a fraction of maxSpeed: birds do not hover. */
  minSpeed: number;
  maxForce: number;
  dt: number;
}

export const DEFAULT_RULES: Rules = {
  separation: 1.5,
  alignment: 1,
  cohesion: 0.8,
  radius: 0.16,
  maxSpeed: 0.7,
  minSpeed: 0.4,
  maxForce: 1.6,
  dt: 1 / 30,
};

/** Counting-sort spatial hash over the box [-half, half]. */
export class Grid {
  nx = 1;
  ny = 1;
  nz = 1;
  private wx = 1;
  private wy = 1;
  private wz = 1;
  private half: V3 = [1, 1, 1];
  private start = new Int32Array(2);
  private order = new Int32Array(0);
  private cellOf = new Int32Array(0);
  /** Pair distances evaluated by `query` since the last `build`. */
  checks = 0;

  /** Cells are at least `cell` wide; queries are exact for any radius up to `cell`. */
  build(pos: Float64Array, n: number, half: V3, cell: number): void {
    this.half = half;
    this.nx = Math.max(1, Math.floor((2 * half[0]) / cell));
    this.ny = Math.max(1, Math.floor((2 * half[1]) / cell));
    this.nz = Math.max(1, Math.floor((2 * half[2]) / cell));
    this.wx = (2 * half[0]) / this.nx;
    this.wy = (2 * half[1]) / this.ny;
    this.wz = (2 * half[2]) / this.nz;
    const cells = this.nx * this.ny * this.nz;
    if (this.start.length < cells + 1) this.start = new Int32Array(cells + 1);
    else this.start.fill(0, 0, cells + 1);
    if (this.order.length < n) {
      this.order = new Int32Array(n);
      this.cellOf = new Int32Array(n);
    }
    for (let i = 0; i < n; i++) {
      const c = this.cell(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      this.cellOf[i] = c;
      this.start[c + 1]++;
    }
    for (let c = 0; c < cells; c++) this.start[c + 1] += this.start[c];
    const fill = this.start.slice(0, cells);
    for (let i = 0; i < n; i++) this.order[fill[this.cellOf[i]]++] = i;
    this.checks = 0;
  }

  private axis(v: number, h: number, w: number, k: number): number {
    const c = Math.floor((v + h) / w);
    return c < 0 ? 0 : c >= k ? k - 1 : c;
  }

  private cell(x: number, y: number, z: number): number {
    const h = this.half;
    return this.axis(x, h[0], this.wx, this.nx)
      + this.nx * (this.axis(y, h[1], this.wy, this.ny)
      + this.ny * this.axis(z, h[2], this.wz, this.nz));
  }

  /**
   * Write into `out` every boid j ≠ i with |x_j − x_i| < r and return how many. `r` must not
   * exceed the cell size the grid was built with.
   */
  query(pos: Float64Array, i: number, r: number, out: Int32Array): number {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const h = this.half;
    const cx = this.axis(x, h[0], this.wx, this.nx);
    const cy = this.axis(y, h[1], this.wy, this.ny);
    const cz = this.axis(z, h[2], this.wz, this.nz);
    const r2 = r * r;
    let m = 0;
    let checks = 0;
    for (let kz = Math.max(0, cz - 1); kz <= Math.min(this.nz - 1, cz + 1); kz++) {
      for (let ky = Math.max(0, cy - 1); ky <= Math.min(this.ny - 1, cy + 1); ky++) {
        const row = this.nx * (ky + this.ny * kz);
        const c0 = row + Math.max(0, cx - 1);
        const c1 = row + Math.min(this.nx - 1, cx + 1);
        for (let k = this.start[c0]; k < this.start[c1 + 1]; k++) {
          const j = this.order[k];
          if (j === i) continue;
          checks++;
          const dx = pos[j * 3] - x;
          const dy = pos[j * 3 + 1] - y;
          const dz = pos[j * 3 + 2] - z;
          if (dx * dx + dy * dy + dz * dz < r2) out[m++] = j;
        }
      }
    }
    this.checks += checks;
    return m;
  }
}

function limit(v: V3, max: number): void {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (l > max) {
    const k = max / l;
    v[0] *= k;
    v[1] *= k;
    v[2] *= k;
  }
}

/** Reynolds steering: towards direction d at full speed, minus the current velocity, capped. */
function steer(out: V3, d: V3, vx: number, vy: number, vz: number, maxSpeed: number,
  maxForce: number): void {
  const l = Math.hypot(d[0], d[1], d[2]);
  if (l < 1e-12) {
    out[0] = out[1] = out[2] = 0;
    return;
  }
  out[0] = (d[0] / l) * maxSpeed - vx;
  out[1] = (d[1] / l) * maxSpeed - vy;
  out[2] = (d[2] / l) * maxSpeed - vz;
  limit(out, maxForce);
}

export class Flock {
  readonly pos: Float64Array;
  readonly vel: Float64Array;
  /** Neighbours within the perception radius at the last step (local density). */
  readonly crowd: Uint16Array;
  readonly grid = new Grid();
  steps = 0;
  /** Pair distances evaluated in the last step. */
  checks = 0;
  private readonly acc: Float64Array;
  private readonly buf: Int32Array;

  constructor(readonly n: number, readonly half: V3) {
    this.pos = new Float64Array(n * 3);
    this.vel = new Float64Array(n * 3);
    this.acc = new Float64Array(n * 3);
    this.crowd = new Uint16Array(n);
    this.buf = new Int32Array(Math.max(1, n));
  }

  /** Uniform positions in the box, isotropic headings at a speed between floor and ceiling. */
  scatter(rnd: () => number, rules: Rules): void {
    for (let i = 0; i < this.n; i++) {
      for (let d = 0; d < 3; d++) this.pos[i * 3 + d] = (rnd() * 2 - 1) * this.half[d] * 0.9;
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = rules.maxSpeed * (rules.minSpeed + (1 - rules.minSpeed) * rnd());
      this.vel[i * 3] = s * Math.cos(a) * sp;
      this.vel[i * 3 + 1] = u * sp;
      this.vel[i * 3 + 2] = s * Math.sin(a) * sp;
    }
    this.steps = 0;
  }

  /** One synchronous step: every force is computed from the same state, then all boids move. */
  step(rules: Rules): void {
    const { n, pos, vel, acc, buf, half } = this;
    const r = rules.radius;
    const rs2 = (r * 0.5) * (r * 0.5);
    const { maxSpeed, maxForce } = rules;
    this.grid.build(pos, n, half, r);
    const sep: V3 = [0, 0, 0];
    const ali: V3 = [0, 0, 0];
    const coh: V3 = [0, 0, 0];
    const f: V3 = [0, 0, 0];
    const here: V3 = [0, 0, 0];
    const wall: V3 = [0, 0, 0];
    const margin = Math.min(0.3, 0.25 * Math.min(half[0], half[1], half[2]));
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      const vx = vel[i * 3];
      const vy = vel[i * 3 + 1];
      const vz = vel[i * 3 + 2];
      const m = this.grid.query(pos, i, r, buf);
      this.crowd[i] = m;
      let ax = 0;
      let ay = 0;
      let az = 0;
      if (m > 0) {
        sep[0] = sep[1] = sep[2] = 0;
        ali[0] = ali[1] = ali[2] = 0;
        coh[0] = coh[1] = coh[2] = 0;
        let close = 0;
        for (let k = 0; k < m; k++) {
          const j = buf[k];
          const dx = x - pos[j * 3];
          const dy = y - pos[j * 3 + 1];
          const dz = z - pos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rs2) {
            // away from the neighbour, weighted 1/d so the nearest push hardest
            const w = 1 / Math.max(d2, 1e-12);
            sep[0] += dx * w;
            sep[1] += dy * w;
            sep[2] += dz * w;
            close++;
          }
          ali[0] += vel[j * 3];
          ali[1] += vel[j * 3 + 1];
          ali[2] += vel[j * 3 + 2];
          coh[0] += pos[j * 3];
          coh[1] += pos[j * 3 + 1];
          coh[2] += pos[j * 3 + 2];
        }
        if (close > 0 && rules.separation !== 0) {
          steer(f, sep, vx, vy, vz, maxSpeed, maxForce);
          ax += rules.separation * f[0];
          ay += rules.separation * f[1];
          az += rules.separation * f[2];
        }
        if (rules.alignment !== 0) {
          steer(f, ali, vx, vy, vz, maxSpeed, maxForce);
          ax += rules.alignment * f[0];
          ay += rules.alignment * f[1];
          az += rules.alignment * f[2];
        }
        if (rules.cohesion !== 0) {
          coh[0] = coh[0] / m - x;
          coh[1] = coh[1] / m - y;
          coh[2] = coh[2] / m - z;
          steer(f, coh, vx, vy, vz, maxSpeed, maxForce);
          ax += rules.cohesion * f[0];
          ay += rules.cohesion * f[1];
          az += rules.cohesion * f[2];
        }
      }
      // soft walls: an inward push that grows quadratically across the margin
      const w = here;
      w[0] = x;
      w[1] = y;
      w[2] = z;
      wall[0] = wall[1] = wall[2] = 0;
      for (let d = 0; d < 3; d++) {
        const lo = w[d] + half[d];
        const hi = half[d] - w[d];
        if (lo < margin) wall[d] += ((margin - lo) / margin) ** 2;
        if (hi < margin) wall[d] -= ((margin - hi) / margin) ** 2;
      }
      acc[i * 3] = ax + 4 * maxForce * wall[0];
      acc[i * 3 + 1] = ay + 4 * maxForce * wall[1];
      acc[i * 3 + 2] = az + 4 * maxForce * wall[2];
    }
    this.checks = this.grid.checks;

    const lo = maxSpeed * rules.minSpeed;
    const dt = rules.dt;
    for (let i = 0; i < n; i++) {
      let vx = vel[i * 3] + acc[i * 3] * dt;
      let vy = vel[i * 3 + 1] + acc[i * 3 + 1] * dt;
      let vz = vel[i * 3 + 2] + acc[i * 3 + 2] * dt;
      const s = Math.hypot(vx, vy, vz);
      if (s > maxSpeed || (s < lo && s > 1e-12)) {
        const k = (s > maxSpeed ? maxSpeed : lo) / s;
        vx *= k;
        vy *= k;
        vz *= k;
      }
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      for (let d = 0; d < 3; d++) {
        let p = pos[i * 3 + d] + vel[i * 3 + d] * dt;
        // the hard wall behind the soft one: reflect anything that still gets through
        if (p > half[d]) {
          p = 2 * half[d] - p;
          vel[i * 3 + d] = -Math.abs(vel[i * 3 + d]);
        } else if (p < -half[d]) {
          p = -2 * half[d] - p;
          vel[i * 3 + d] = Math.abs(vel[i * 3 + d]);
        }
        pos[i * 3 + d] = p;
      }
    }
    this.steps++;
  }
}

/** |mean unit velocity|: 0 for random headings, 1 when every boid flies the same way. */
export function polarisation(f: Flock): number {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < f.n; i++) {
    const vx = f.vel[i * 3];
    const vy = f.vel[i * 3 + 1];
    const vz = f.vel[i * 3 + 2];
    const s = Math.hypot(vx, vy, vz) || 1;
    sx += vx / s;
    sy += vy / s;
    sz += vz / s;
  }
  return f.n > 0 ? Math.hypot(sx, sy, sz) / f.n : 0;
}

/**
 * Mean distance from each boid to its nearest neighbour. Exact: the grid finds every boid within
 * `cell`, and a boid with none that close falls back to a scan of the whole flock.
 */
export function meanNearest(f: Flock, cell: number, grid = new Grid()): number {
  const { n, pos } = f;
  if (n < 2) return 0;
  grid.build(pos, n, f.half, cell);
  const buf = new Int32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const m = grid.query(pos, i, cell, buf);
    let best = Infinity;
    const scan = m > 0 ? m : n;
    for (let k = 0; k < scan; k++) {
      const j = m > 0 ? buf[k] : k;
      if (j === i) continue;
      const d2 = (pos[j * 3] - pos[i * 3]) ** 2 + (pos[j * 3 + 1] - pos[i * 3 + 1]) ** 2
        + (pos[j * 3 + 2] - pos[i * 3 + 2]) ** 2;
      if (d2 < best) best = d2;
    }
    sum += Math.sqrt(best);
  }
  return sum / n;
}
