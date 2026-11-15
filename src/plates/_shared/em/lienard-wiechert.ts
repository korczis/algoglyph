// The fields of a moving point charge (plan S9b), in units where c = 1 and q/4πε₀ = 1: a prescribed
// worldline r_s(t), the retarded time t_r solving t − t_r = |r − r_s(t_r)| by Newton's method kept
// inside a bracket (the root is unique while the charge is slower than light), and the
// Liénard–Wiechert fields at (r, t) from the charge's position, velocity and acceleration at t_r:
//   E = (n − β)(1 − β²)/(κ³R²) + n × ((n − β) × β̇)/(κ³R),  B = n × E,  κ = 1 − n·β.
// Measured from these, never assumed: the Poynting flux through a sphere, an observed period from
// the arrival times of the field. Pure: no p5, no randomness.
export type V3 = [number, number, number];

export interface State { r: V3; v: V3; a: V3 }

export interface Worldline {
  /** Position, velocity and acceleration at time t. */
  at(t: number): State;
  /** An upper bound on the speed, below 1. */
  vmax: number;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.sqrt(dot(a, a));

/** Uniform motion at velocity β along x through the origin at t = 0. */
export function uniform(beta: number): Worldline {
  return { vmax: Math.abs(beta), at: (t) => ({ r: [beta * t, 0, 0], v: [beta, 0, 0], a: [0, 0, 0] }) };
}

/** Oscillating along y as A sin ωt about a centre drifting along x at V: an antenna's charge,
 * carried along. */
export function oscillating(amp: number, omega: number, drift = 0): Worldline {
  return {
    vmax: Math.hypot(drift, amp * omega),
    at: (t) => ({
      r: [drift * t, amp * Math.sin(omega * t), 0],
      v: [drift, amp * omega * Math.cos(omega * t), 0],
      a: [0, -amp * omega * omega * Math.sin(omega * t), 0],
    }),
  };
}

/** A circle of radius ρ in the x–y plane at angular speed ω (speed β = ωρ): a synchrotron's charge. */
export function circular(rho: number, omega: number): Worldline {
  return {
    vmax: Math.abs(rho * omega),
    at: (t) => {
      const c = Math.cos(omega * t);
      const s = Math.sin(omega * t);
      return { r: [rho * c, rho * s, 0], v: [-rho * omega * s, rho * omega * c, 0], a: [-rho * omega * omega * c, -rho * omega * omega * s, 0] };
    },
  };
}

/**
 * At rest until t = 0, then a constant acceleration g along x for a time τ, then coasting at the
 * speed reached, gτ (kept below 1): the kink of radiation Purcell drew, travelling out at c.
 */
export function kick(g: number, tau: number): Worldline {
  const vEnd = g * tau;
  return {
    vmax: Math.abs(vEnd),
    at: (t) => {
      if (t <= 0) return { r: [0, 0, 0], v: [0, 0, 0], a: [0, 0, 0] };
      if (t < tau) return { r: [0.5 * g * t * t, 0, 0], v: [g * t, 0, 0], a: [g, 0, 0] };
      return { r: [0.5 * g * tau * tau + vEnd * (t - tau), 0, 0], v: [vEnd, 0, 0], a: [0, 0, 0] };
    },
  };
}

/** The retarded time at (x, t): g(t_r) = t − t_r − |x − r_s(t_r)| falls strictly (g′ ≤ −(1 − β)),
 * so Newton's steps are kept inside [lo, hi] with g(lo) ≥ 0 ≥ g(hi), and bisect when they leave it. */
export function retardedTime(w: Worldline, x: V3, t: number): number {
  let hi = t;
  let lo = t - norm(sub(x, w.at(t).r)) / Math.max(1e-9, 1 - w.vmax) - 1e-12;
  let tr = t - norm(sub(x, w.at(t).r));
  for (let k = 0; k < 100; k++) {
    if (tr <= lo || tr >= hi) tr = 0.5 * (lo + hi);
    const s = w.at(tr);
    const d = sub(x, s.r);
    const R = norm(d);
    const val = t - tr - R;
    if (val > 0) lo = tr; else hi = tr;
    if (Math.abs(val) < 1e-13 * Math.max(1, Math.abs(t))) return tr;
    // g′ = −1 + n·v
    const slope = -1 + dot(d, s.v) / Math.max(1e-300, R);
    tr -= val / slope;
    if (hi - lo < 1e-15 * Math.max(1, Math.abs(t))) return tr;
  }
  return 0.5 * (lo + hi);
}

export interface Fields { E: V3; B: V3; tr: number; R: number }

/** The Liénard–Wiechert E and B at (x, t). */
export function fields(w: Worldline, x: V3, t: number): Fields {
  const tr = retardedTime(w, x, t);
  const s = w.at(tr);
  const d = sub(x, s.r);
  const R = norm(d);
  const n: V3 = [d[0] / R, d[1] / R, d[2] / R];
  const b = s.v;
  const k = 1 - dot(n, b);
  const nb = sub(n, b);
  const b2 = dot(b, b);
  const vel = (1 - b2) / (k * k * k * R * R);
  const acc = cross(n, cross(nb, s.a));
  const r1 = 1 / (k * k * k * R);
  const E: V3 = [nb[0] * vel + acc[0] * r1, nb[1] * vel + acc[1] * r1, nb[2] * vel + acc[2] * r1];
  return { E, B: cross(n, E), tr, R };
}

/** Heaviside's field of a charge in uniform motion, from its present position (no retarded time):
 * E = (1 − β²) d / (|d|³ (1 − β² sin²ψ)^(3/2)), d from the present position, ψ the angle to the motion. */
export function heaviside(beta: number, x: V3, t: number): V3 {
  const d: V3 = [x[0] - beta * t, x[1], x[2]];
  const r = norm(d);
  const sin2 = (d[1] * d[1] + d[2] * d[2]) / (r * r);
  const f = (1 - beta * beta) / (r * r * r * (1 - beta * beta * sin2) ** 1.5);
  return [d[0] * f, d[1] * f, d[2] * f];
}

/** Nodes and weights of Gauss–Legendre on [−1, 1], by Newton's method on the Legendre recurrence. */
function gl(n: number): { x: number[]; w: number[] } {
  const x: number[] = new Array(n);
  const w: number[] = new Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 1;
    for (let it = 0; it < 100; it++) {
      let p0 = 1; let p1 = z;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    x[i] = -z; x[n - 1 - i] = z;
    w[i] = w[n - 1 - i] = 2 / ((1 - z * z) * dp * dp);
  }
  return { x, w };
}

/**
 * The power through a sphere of radius Rs about the origin at time t: ∮(E × B)·n R² dΩ / 4π (the
 * Poynting vector is E × B/4π in these units), Gauss–Legendre in cos θ and the trapezoid in φ, θ
 * measured from the y axis. Also the flux per unit solid angle on each θ ring, for the pattern.
 */
export function sphereFlux(w: Worldline, Rs: number, t: number, nTheta = 24, nPhi = 24): { power: number; rings: { mu: number; dP: number }[] } {
  const { x: mus, w: ws } = gl(nTheta);
  let power = 0;
  const rings: { mu: number; dP: number }[] = [];
  for (let i = 0; i < nTheta; i++) {
    const mu = mus[i];
    const st = Math.sqrt(1 - mu * mu);
    let ring = 0;
    for (let j = 0; j < nPhi; j++) {
      const ph = (2 * Math.PI * j) / nPhi;
      const n: V3 = [st * Math.cos(ph), mu, st * Math.sin(ph)];
      const f = fields(w, [Rs * n[0], Rs * n[1], Rs * n[2]], t);
      ring += dot(cross(f.E, f.B), n);
    }
    const dP = (ring / nPhi) * Rs * Rs / (4 * Math.PI);
    rings.push({ mu, dP });
    power += ws[i] * dP * 2 * Math.PI;
  }
  return { power, rings };
}

/** The time the field emitted at t_e reaches the observer: t_e + |x − r_s(t_e)|. */
export function arrival(w: Worldline, x: V3, te: number): number {
  return te + norm(sub(x, w.at(te).r));
}
