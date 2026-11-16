// How a person's hand moves a pointer from one place to another, the model of the OpenTTD fork's
// tools/research/mcp-human/src/motion.rs ported operation for operation, so the same seed gives
// the same samples in both (the parity vectors in test/human-pointing.test.ts come from it):
// - duration by Fitts' law, MT = a + b log2(D / W + 1), with a little noise between movements;
// - a minimum-jerk profile, 10t^3 - 15t^4 + 6t^5 (slow start, fast middle, slow arrival), along
//   a quadratic Bezier bowed sideways by a random fraction of the distance;
// - a long move overshoots by 3 to 7 % and corrects with a short second sub-movement;
// - tremor of about a pixel along the way, never on the last sample, which is the target exactly.
// Seeded by xorshift64*, in 64-bit integer arithmetic (BigInt), and rounded half away from zero
// as Rust's f64::round is. Nothing here draws.

const MASK = (1n << 64n) - 1n;
const TWO53 = 2 ** 53;

/** A small seeded source, xorshift64*, exactly motion.rs's Rng. */
export class Rng {
  private s: bigint;
  constructor(seed: number | bigint) {
    this.s = ((BigInt.asUintN(64, BigInt(seed)) * 0x9E3779B97F4A7C15n) & MASK) | 1n;
  }
  nextU64(): bigint {
    let x = this.s;
    x ^= x >> 12n;
    x = (x ^ (x << 25n)) & MASK;
    x ^= x >> 27n;
    this.s = x;
    return (x * 0x2545F4914F6CDD1Dn) & MASK;
  }
  /** Uniform in [0, 1). */
  unit(): number { return Number(this.nextU64() >> 11n) / TWO53; }
  range(lo: number, hi: number): number { return lo + (hi - lo) * this.unit(); }
  /** Approximately normal (a sum of six uniforms), mean 0, standard deviation sd. */
  normal(sd: number): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.unit();
    return (s - 3) * sd * Math.SQRT2;
  }
}

export interface Model {
  /** Fitts' intercept, seconds. */
  fitts_a: number;
  /** Fitts' slope, seconds per bit. */
  fitts_b: number;
  /** Pointer updates a second. */
  rate_hz: number;
  /** The sideways bow's standard deviation, as a fraction of the distance. */
  curvature: number;
  /** Moves longer than this (pixels) overshoot and correct. */
  overshoot_from: number;
  /** Tremor, pixels. */
  tremor: number;
  /** 1 is an ordinary person, 2 twice as fast. */
  speed: number;
}

export const DEFAULT_MODEL: Model = { fitts_a: 0.15, fitts_b: 0.14, rate_hz: 60, curvature: 0.08, overshoot_from: 280, tremor: 0.8, speed: 1 };

/** One step: where the pointer is, and how long to wait before the next. */
export type Sample = [number, number, number];

/** Rust's f64::round as an integer: half away from zero, and never -0 (an i32 has no sign of zero). */
export const roundAway = (v: number) => (v < 0 ? -Math.round(-v) : Math.round(v)) + 0;

export function minJerk(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * u * (10 - 15 * u + 6 * u * u);
}

/** Fitts' law movement time in seconds for a distance and a target width (pixels). */
export function duration(m: Model, distance: number, width: number, rng: Rng): number {
  const bits = Math.log2(distance / Math.max(width, 4) + 1);
  const base = m.fitts_a + m.fitts_b * bits;
  return Math.max(base * (1 + rng.normal(0.08)), 0.06) / Math.max(m.speed, 0.1);
}

function submovement(m: Model, from: [number, number], to: [number, number], seconds: number, rng: Rng, tremor: boolean): Sample[] {
  const dx = to[0] - from[0]; const dy = to[1] - from[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  // the control point: the midpoint pushed sideways by a random fraction of the distance
  const bow = rng.normal(m.curvature) * dist;
  const [nx, ny] = dist > 0 ? [-dy / dist, dx / dist] : [0, 0];
  const cx = from[0] + dx * 0.5 + nx * bow; const cy = from[1] + dy * 0.5 + ny * bow;
  const steps = Math.max(Math.ceil(seconds * m.rate_hz), 2);
  const wait = Math.max(roundAway((seconds * 1000) / steps), 1);
  const out: Sample[] = [];
  for (let i = 1; i <= steps; i++) {
    const s = minJerk(i / steps);
    const u = 1 - s;
    let x = u * u * from[0] + 2 * u * s * cx + s * s * to[0];
    let y = u * u * from[1] + 2 * u * s * cy + s * s * to[1];
    if (tremor && i < steps) { x += rng.normal(m.tremor); y += rng.normal(m.tremor); }
    out.push([roundAway(x), roundAway(y), wait]);
  }
  return out;
}

/**
 * The whole movement from `from` to a target `width` pixels wide centred on `to`: one
 * sub-movement, or an overshoot and a correction for a long move. The last sample is `to`.
 */
export function path(m: Model, from: [number, number], to: [number, number], width: number, rng: Rng): Sample[] {
  const dx = to[0] - from[0]; const dy = to[1] - from[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return [[to[0], to[1], 16]];
  const total = duration(m, dist, width, rng);
  let out: Sample[];
  if (dist > m.overshoot_from) {
    // overshoot along the direction of travel by 3 to 7 %, a little off-axis, then correct
    const k = rng.range(0.03, 0.07);
    const ox = to[0] + dx * k + rng.normal(width * 0.15);
    const oy = to[1] + dy * k + rng.normal(width * 0.15);
    out = [...submovement(m, from, [ox, oy], total * 0.82, rng, true), ...submovement(m, [ox, oy], to, total * 0.18 + 0.05, rng, false)];
  } else {
    out = submovement(m, from, to, total, rng, true);
  }
  const last = out[out.length - 1];
  last[0] = to[0]; last[1] = to[1];
  return out;
}

/** A deliberate drag at a steady, slower pace: straight, minimum-jerk, no tremor. */
export function drag(m: Model, from: [number, number], to: [number, number], rng: Rng): Sample[] {
  const dx = to[0] - from[0]; const dy = to[1] - from[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  const seconds = ((0.35 + dist / 900) * (1 + rng.normal(0.06))) / Math.max(m.speed, 0.1);
  const steps = Math.max(Math.ceil(seconds * m.rate_hz), 2);
  const wait = Math.max(roundAway((seconds * 1000) / steps), 1);
  const out: Sample[] = [];
  for (let i = 1; i <= steps; i++) {
    const s = minJerk(i / steps);
    out.push([roundAway(from[0] + dx * s), roundAway(from[1] + dy * s), wait]);
  }
  return out;
}
