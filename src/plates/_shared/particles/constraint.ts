// A bead held on a track y = f(x) under uniform gravity (plan S5, constraints), integrated by
// RATTLE: velocity Verlet with a Lagrange multiplier in each half step. The first multiplier λ is
// the one that puts the drifted position back on the track (found by Newton's method on the
// scalar c(q) = y − f(x)); the second, μ, the one that makes the new velocity tangent to it (a
// linear equation, solved exactly). The scheme is second order and symplectic on the constrained
// motion, so the energy error stays bounded and the bead stays on the track to round-off. The
// normal force is read off the second multiplier, −μ∇c, so nothing here is told what it should
// be. Kinetic friction μₖN opposes the motion along the tangent with N from the step before (the
// normal force does not depend on the friction, which is tangential); a bead at rest whose
// tangential pull is under μₖN stays at rest. Nothing knows the closed forms the tests hold it to.
// Pure: no p5, no randomness.

export interface Track {
  /** The height of the track above x, and its slope. */
  f(x: number): number;
  df(x: number): number;
  /** The horizontal extent the track is defined on. */
  lo: number;
  hi: number;
}

/** A straight incline falling at angle θ to the right of the origin: y = −x tan θ. */
export function incline(theta: number, length: number): Track {
  const s = Math.tan(theta);
  return { f: (x) => -s * x, df: () => -s, lo: 0, hi: length * Math.cos(theta) };
}

/**
 * The cycloid bowl traced by a point of a circle of radius R rolling under the line y = 2R:
 * x = R(φ + sin φ), y = R(1 − cos φ), φ in [−π, π], its bottom at the origin and its cusps at
 * x = ±πR. Its height above x is found by solving x = R(φ + sin φ) for φ, Newton's method kept
 * inside a bisection bracket (the map is monotonic, its derivative vanishing only at the cusps).
 */
export function cycloid(R: number): Track {
  // the last solution: RATTLE asks for f and f′ at one x in turn, and the next x is close by
  let lastX = 0;
  let lastPhi = 0;
  const phiOf = (x: number): number => {
    if (x === lastX) return lastPhi;
    const target = Math.max(-Math.PI, Math.min(Math.PI, x / R));
    let lo = -Math.PI;
    let hi = Math.PI;
    let phi = Math.abs(lastPhi - target / 2) < 1 ? lastPhi : target / 2;
    for (let k = 0; k < 60; k++) {
      const g = phi + Math.sin(phi) - target;
      if (g === 0) break;
      if (g > 0) hi = phi; else lo = phi;
      const d = 1 + Math.cos(phi);
      let next = d > 1e-12 ? phi - g / d : 0.5 * (lo + hi);
      if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
      const done = Math.abs(next - phi) < 1e-15;
      phi = next;
      if (done) break;
    }
    lastX = x;
    lastPhi = phi;
    return phi;
  };
  return {
    f: (x) => R * (1 - Math.cos(phiOf(x))),
    // dy/dx = sin φ / (1 + cos φ) = tan(φ/2)
    df: (x) => Math.tan(phiOf(x) / 2),
    lo: -Math.PI * R,
    hi: Math.PI * R,
  };
}

/** A circular bowl of radius L, its bottom at the origin: a pendulum of length L. */
export function circle(L: number, reach: number): Track {
  return {
    f: (x) => L - Math.sqrt(L * L - x * x),
    df: (x) => x / Math.sqrt(L * L - x * x),
    lo: -reach,
    hi: reach,
  };
}

/** A parabolic bowl y = x²/(2ρ), whose radius of curvature at the bottom is ρ. */
export function parabola(rho: number, reach: number): Track {
  return { f: (x) => (x * x) / (2 * rho), df: (x) => x / rho, lo: -reach, hi: reach };
}

/** The x on the left branch (x ≤ 0) of a bowl at which the track has height y, by bisection. */
export function leftAt(track: Track, y: number): number {
  let lo = track.lo;
  let hi = 0;
  for (let k = 0; k < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo)); k++) {
    const mid = 0.5 * (lo + hi);
    if (track.f(mid) > y) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The normal force per unit mass at the last step, |μ∇c|, and its direction's sign. */
  normal: number;
  /** The largest |y − f(x)| and |∇c·v|/|∇c| seen after a step. */
  maxGap: number;
  maxNormalSpeed: number;
  /** Newton iterations of the position projection, over every step. */
  iterations: number;
}

export function bead(track: Track, x: number, g: number): Bead {
  const s = track.df(x);
  // at rest the normal force is the normal component of gravity: g / √(1 + f′²)
  return { x, y: track.f(x), vx: 0, vy: 0, normal: g / Math.sqrt(1 + s * s), maxGap: 0, maxNormalSpeed: 0, iterations: 0 };
}

/** The tangential friction acceleration on a bead moving with (vx, vy) at slope s, or the one that
 * holds it when it is at rest and its pull is under the friction's limit. */
function friction(b: Bead, s: number, vx: number, vy: number, g: number, mu: number): [number, number] {
  if (mu <= 0) return [0, 0];
  const n = Math.sqrt(1 + s * s);
  const tx = 1 / n;
  const ty = s / n;
  const vt = vx * tx + vy * ty;
  const limit = mu * b.normal;
  if (Math.abs(vt) <= 1e-14) {
    // at rest: static friction cancels the pull of gravity along the track up to its limit
    const pull = -g * ty;
    const f = Math.abs(pull) <= limit ? -pull : -Math.sign(pull) * limit;
    return [f * tx, f * ty];
  }
  const f = -Math.sign(vt) * limit;
  return [f * tx, f * ty];
}

/**
 * One RATTLE step of h for a bead of unit mass under gravity g (downwards), friction coefficient
 * mu, on the track. Returns false when the bead has left the track's extent.
 */
export function rattle(b: Bead, track: Track, h: number, g: number, mu: number): boolean {
  const s0 = track.df(b.x);
  // ∇c = (−f′, 1) at the start
  const gx0 = -s0;
  const gy0 = 1;
  const [fx0, fy0] = friction(b, s0, b.vx, b.vy, g, mu);
  // the free half kick and drift, then the multiplier that lands the drifted point on the track
  const ux = b.vx + 0.5 * h * fx0;
  const uy = b.vy + 0.5 * h * (fy0 - g);
  const px = b.x + h * ux;
  const py = b.y + h * uy;
  const k = 0.5 * h * h;
  let lambda = 0;
  let x = px;
  let y = py;
  for (let it = 0; it < 30; it++) {
    x = px - k * lambda * gx0;
    y = py - k * lambda * gy0;
    const c = y - track.f(x);
    b.iterations++;
    // dc/dλ = ∇c(q(λ))·(−k ∇c(q₀))
    const dc = -k * (-track.df(x) * gx0 + gy0);
    const dl = c / dc;
    lambda -= dl;
    if (Math.abs(dl * k) < 1e-17 * (1 + Math.abs(x) + Math.abs(y))) {
      x = px - k * lambda * gx0;
      y = py - k * lambda * gy0;
      break;
    }
  }
  const slack = 1e-9 * (1 + track.hi - track.lo);
  if (x < track.lo - slack || x > track.hi + slack) return false;
  // put y exactly on the track (the Newton residual is round-off) and kick to the half velocity
  y = track.f(x);
  const vhx = ux - 0.5 * h * lambda * gx0;
  const vhy = uy - 0.5 * h * lambda * gy0;
  // the second half: gravity, then the multiplier that makes the velocity tangent
  const s1 = track.df(x);
  const gx1 = -s1;
  const gy1 = 1;
  const wx = vhx;
  const wy = vhy - 0.5 * h * g;
  const nn = gx1 * gx1 + gy1 * gy1;
  const mu2 = (gx1 * wx + gy1 * wy) / (0.5 * h * nn);
  let vx = wx - 0.5 * h * mu2 * gx1;
  let vy = wy - 0.5 * h * mu2 * gy1;
  // the normal force per unit mass, from the multiplier alone
  b.normal = Math.abs(mu2) * Math.sqrt(nn);
  b.x = x;
  b.y = y;
  const [fx1, fy1] = friction(b, s1, vx, vy, g, mu);
  if (mu > 0) {
    // friction may stop the bead but never turn it back within one half step
    const n = Math.sqrt(nn);
    const tx = 1 / n;
    const ty = s1 / n;
    const before = vx * tx + vy * ty;
    const after = before + 0.5 * h * (fx1 * tx + fy1 * ty);
    const vt = before !== 0 && Math.sign(after) !== Math.sign(before) ? 0 : after;
    vx = vt * tx;
    vy = vt * ty;
  }
  b.vx = vx;
  b.vy = vy;
  b.maxGap = Math.max(b.maxGap, Math.abs(b.y - track.f(b.x)));
  b.maxNormalSpeed = Math.max(b.maxNormalSpeed, Math.abs(gx1 * vx + gy1 * vy) / Math.sqrt(nn));
  return true;
}

/** Energy per unit mass: ½|v|² + g y. */
export const energy = (b: Bead, g: number): number => 0.5 * (b.vx * b.vx + b.vy * b.vy) + g * b.y;
