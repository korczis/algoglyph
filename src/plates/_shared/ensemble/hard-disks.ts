// Event-driven hard disks in a square box (plan S7a): N disks of one diameter d and their own masses
// fly straight between collisions, which are found exactly, never stepped. Each disk keeps one
// predicted event (the earliest collision with another disk or a wall) in an indexed binary heap;
// a prediction is a lower bound on the disk's true next event, so a stale one only costs a
// re-prediction when it reaches the top (it is recognised by the collision counts it was made
// with). Collisions are elastic unless a coefficient of restitution e < 1 is given: momentum is
// exchanged along the line of centres, the normal relative speed leaving e times the one it came in
// with (e = 1, the default, is the elastic impulse, arithmetic unchanged), and a wall reverses the
// normal velocity. Nothing here knows the gas laws; the box only counts what happens
// at its walls and between its disks: the impulse delivered to the walls, the disk–disk
// collisions and the distance flown. Initial speeds use Box–Muller from the generator passed in.
import { gaussian } from '../../../core/random';
import { IndexHeap } from '../../../kernels/graph/_heap';

/** A wall's partner code: below zero, so it never names a disk. */
const WALL_X0 = -1;
const WALL_X1 = -2;
const WALL_Y0 = -3;
const WALL_Y1 = -4;

export interface DiskInit {
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  m: Float64Array;
}

/** How the starting velocities are drawn: every disk at one speed in a random direction (far
 * from equilibrium, whatever the masses), or each component Gaussian with variance kT/m. */
export type StartKind = 'equal' | 'maxwell';

export interface GasOptions {
  n: number;
  /** Packing fraction η = N·πd²/4 over the box's area (the box side is 1). */
  eta: number;
  kT: number;
  /** Fraction of the disks that are heavy, and how much heavier (the light ones weigh 1). */
  heavy: number;
  ratio: number;
  start: StartKind;
}

/** The diameter that gives N disks the packing fraction η in the unit box. */
export const diameterOf = (n: number, eta: number): number => Math.sqrt((4 * eta) / (Math.PI * Math.max(1, n)));

/**
 * A starting state: N disks on a square lattice of ⌈√N⌉² cells, a random choice of the cells,
 * each disk placed uniformly in its cell's free room, so no two overlap at any packing the lattice
 * allows (η < π/4·N/⌈√N⌉²); then velocities as `start` asks, scaled so the kinetic energy is
 * exactly N·kT (two dimensions, ½kT per degree of freedom).
 */
export function initialState(o: GasOptions, rnd: () => number): DiskInit {
  const n = o.n;
  const d = diameterOf(n, o.eta);
  const side = Math.ceil(Math.sqrt(n));
  const cell = 1 / side;
  const room = Math.max(0, cell - d * 1.0001);
  const cells = Array.from({ length: side * side }, (_, k) => k);
  for (let k = cells.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [cells[k], cells[j]] = [cells[j], cells[k]];
  }
  const s: DiskInit = {
    x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n), m: new Float64Array(n),
  };
  const heavyCount = Math.round(o.heavy * n);
  const order = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  for (let k = 0; k < n; k++) s.m[order[k]] = k < heavyCount ? o.ratio : 1;
  let mass = 0;
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    s.x[i] = (c % side) * cell + (cell - room) / 2 + rnd() * room;
    s.y[i] = Math.floor(c / side) * cell + (cell - room) / 2 + rnd() * room;
    mass += s.m[i];
  }
  const speed = Math.sqrt((2 * o.kT * n) / mass);
  let ke = 0;
  for (let i = 0; i < n; i++) {
    if (o.start === 'equal') {
      const a = 2 * Math.PI * rnd();
      s.vx[i] = speed * Math.cos(a);
      s.vy[i] = speed * Math.sin(a);
    } else {
      const sd = Math.sqrt(o.kT / s.m[i]);
      s.vx[i] = sd * gaussian(rnd);
      s.vy[i] = sd * gaussian(rnd);
    }
    ke += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
  }
  const f = ke > 0 ? Math.sqrt((n * o.kT) / ke) : 1;
  for (let i = 0; i < n; i++) { s.vx[i] *= f; s.vy[i] *= f; }
  return s;
}

/**
 * Disks of diameter `d` from a table of positions, velocities and masses: each row is moved inside
 * the walls if it reaches past one, and a row whose disk would overlap one already placed is left
 * out (counted in `dropped`), since hard disks cannot overlap.
 */
export function fromTable(cols: { x: ArrayLike<number>; y: ArrayLike<number>; vx: ArrayLike<number>; vy: ArrayLike<number>; m: ArrayLike<number> },
  d: number): { state: DiskInit; dropped: number } {
  const keep: number[] = [];
  const r = d / 2;
  const px: number[] = [];
  const py: number[] = [];
  const rows = cols.x.length;
  for (let k = 0; k < rows; k++) {
    const x = Math.min(1 - r, Math.max(r, cols.x[k]));
    const y = Math.min(1 - r, Math.max(r, cols.y[k]));
    let clear = true;
    for (let j = 0; j < px.length && clear; j++) clear = (px[j] - x) ** 2 + (py[j] - y) ** 2 >= d * d;
    if (!clear) continue;
    keep.push(k);
    px.push(x);
    py.push(y);
  }
  const n = keep.length;
  const state: DiskInit = {
    x: Float64Array.from(px), y: Float64Array.from(py), vx: new Float64Array(n), vy: new Float64Array(n), m: new Float64Array(n),
  };
  keep.forEach((k, i) => { state.vx[i] = cols.vx[k]; state.vy[i] = cols.vy[k]; state.m[i] = cols.m[k]; });
  return { state, dropped: rows - n };
}

export class DiskGas {
  readonly n: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly m: Float64Array;
  /** Simulated time. */
  t = 0;
  /** Disk–disk collisions, wall bounces and events taken from the queue (stale ones included). */
  collisions = 0;
  bounces = 0;
  popped = 0;
  /** Impulse delivered to the four walls, Σ 2m|v⊥|, since the last `resetWallImpulse`. */
  wallImpulse = 0;
  /** Distance flown by all disks together. */
  path = 0;
  private readonly cnt: Int32Array;
  private readonly partner: Int32Array;
  private readonly seenSelf: Int32Array;
  private readonly seenOther: Int32Array;
  private readonly heap: IndexHeap;
  private readonly lo: number;
  private readonly hi: number;
  private readonly d2: number;
  /** Σ|v|, kept with every velocity change, so the distance flown costs nothing per flight. */
  private speedSum = 0;

  /** @param e the coefficient of restitution of disk–disk collisions (1: elastic) */
  constructor(s: DiskInit, readonly d: number, readonly e = 1) {
    this.n = s.x.length;
    this.x = Float64Array.from(s.x);
    this.y = Float64Array.from(s.y);
    this.vx = Float64Array.from(s.vx);
    this.vy = Float64Array.from(s.vy);
    this.m = Float64Array.from(s.m);
    this.cnt = new Int32Array(this.n);
    this.partner = new Int32Array(this.n);
    this.seenSelf = new Int32Array(this.n);
    this.seenOther = new Int32Array(this.n);
    this.heap = new IndexHeap(Math.max(1, this.n));
    this.lo = d / 2;
    this.hi = 1 - d / 2;
    this.d2 = d * d;
    for (let i = 0; i < this.n; i++) this.speedSum += Math.hypot(this.vx[i], this.vy[i]);
    for (let i = 0; i < this.n; i++) this.predict(i);
  }

  /** Kinetic energy, summed afresh. */
  energy(): number {
    let e = 0;
    for (let i = 0; i < this.n; i++) e += 0.5 * this.m[i] * (this.vx[i] ** 2 + this.vy[i] ** 2);
    return e;
  }

  /** The side the disk centres can reach, 1 − d: the box the centres see. */
  get reach(): number { return this.hi - this.lo; }

  resetWallImpulse(): void { this.wallImpulse = 0; }

  /** Time until disks i and j touch, or Infinity when they never will on their present lines. */
  private pairTime(i: number, j: number): number {
    const dx = this.x[j] - this.x[i];
    const dy = this.y[j] - this.y[i];
    const dvx = this.vx[j] - this.vx[i];
    const dvy = this.vy[j] - this.vy[i];
    const b = dx * dvx + dy * dvy;
    if (b >= 0) return Infinity;
    const vv = dvx * dvx + dvy * dvy;
    const disc = b * b - vv * (dx * dx + dy * dy - this.d2);
    if (disc <= 0) return Infinity;
    // approaching and already touching by round-off: collide now
    return Math.max(0, (-b - Math.sqrt(disc)) / vv);
  }

  /** The earliest event of disk i from now: a wall, or a disk, which also learns of it when it is
   * earlier than its own prediction. */
  private predict(i: number): void {
    let best = Infinity;
    let who = 0;
    const vx = this.vx[i];
    const vy = this.vy[i];
    if (vx > 0) { best = (this.hi - this.x[i]) / vx; who = WALL_X1; } else if (vx < 0) { best = (this.lo - this.x[i]) / vx; who = WALL_X0; }
    if (vy > 0) { const w = (this.hi - this.y[i]) / vy; if (w < best) { best = w; who = WALL_Y1; } } else if (vy < 0) {
      const w = (this.lo - this.y[i]) / vy;
      if (w < best) { best = w; who = WALL_Y0; }
    }
    for (let j = 0; j < this.n; j++) {
      if (j === i) continue;
      const w = this.pairTime(i, j);
      if (w < best) { best = w; who = j; }
      // j's own prediction is a lower bound; an earlier meeting with i replaces it
      const at = this.t + w;
      if (w < Infinity && at < this.heap.key[j]) {
        this.partner[j] = i;
        this.seenSelf[j] = this.cnt[j];
        this.seenOther[j] = this.cnt[i];
        this.heap.push(j, at);
      }
    }
    best = Math.max(0, best);
    this.partner[i] = who;
    this.seenSelf[i] = this.cnt[i];
    this.seenOther[i] = who >= 0 ? this.cnt[who] : 0;
    this.heap.key[i] = Infinity;
    if (best < Infinity) this.heap.push(i, this.t + best);
  }

  /** Every disk flies straight for dt. */
  private fly(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < this.n; i++) { this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; }
    this.path += this.speedSum * dt;
    this.t += dt;
  }

  /**
   * Take events until simulated time `until` or until `budget` events have been taken from the
   * queue, whichever comes first; returns the events taken. When it reaches `until`, every disk
   * has flown to that time.
   */
  advance(until: number, budget: number): number {
    let taken = 0;
    while (taken < budget) {
      if (!this.heap.size) { this.fly(until - this.t); return taken; }
      const i = this.heap.pop();
      const at = this.heap.key[i];
      if (at > until) {
        this.heap.key[i] = Infinity;
        this.heap.push(i, at);
        this.fly(until - this.t);
        return taken;
      }
      taken++;
      this.popped++;
      this.heap.key[i] = Infinity;
      this.fly(at - this.t);
      const j = this.partner[i];
      const stale = this.seenSelf[i] !== this.cnt[i] || (j >= 0 && this.seenOther[i] !== this.cnt[j]);
      if (stale) { this.predict(i); continue; }
      if (j >= 0) this.collide(i, j);
      else this.bounce(i, j);
    }
    return taken;
  }

  private collide(i: number, j: number): void {
    const dx = this.x[j] - this.x[i];
    const dy = this.y[j] - this.y[i];
    const dvx = this.vx[j] - this.vx[i];
    const dvy = this.vy[j] - this.vy[i];
    const dist = Math.hypot(dx, dy);
    const b = dx * dvx + dy * dvy;
    const mi = this.m[i];
    const mj = this.m[j];
    // the impulse along the line of centres that keeps momentum and, for e = 1, kinetic energy
    const J = ((1 + this.e) * mi * mj * b) / ((mi + mj) * dist);
    const jx = (J * dx) / dist;
    const jy = (J * dy) / dist;
    this.speedSum -= Math.hypot(this.vx[i], this.vy[i]) + Math.hypot(this.vx[j], this.vy[j]);
    this.vx[i] += jx / mi;
    this.vy[i] += jy / mi;
    this.vx[j] -= jx / mj;
    this.vy[j] -= jy / mj;
    this.speedSum += Math.hypot(this.vx[i], this.vy[i]) + Math.hypot(this.vx[j], this.vy[j]);
    this.cnt[i]++;
    this.cnt[j]++;
    this.collisions++;
    // j's queued prediction is stale now (its count moved): lowered to now, it surfaces next and is
    // predicted afresh then; the heap only ever lowers a key in place
    this.heap.push(j, this.t);
    this.predict(i);
  }

  private bounce(i: number, wall: number): void {
    if (wall === WALL_X0 || wall === WALL_X1) {
      this.wallImpulse += 2 * this.m[i] * Math.abs(this.vx[i]);
      this.vx[i] = -this.vx[i];
      this.x[i] = wall === WALL_X0 ? this.lo : this.hi;
    } else {
      this.wallImpulse += 2 * this.m[i] * Math.abs(this.vy[i]);
      this.vy[i] = -this.vy[i];
      this.y[i] = wall === WALL_Y0 ? this.lo : this.hi;
    }
    this.cnt[i]++;
    this.bounces++;
    this.predict(i);
  }
}
