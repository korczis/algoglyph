// Point particles under a central force (plan S5): an acceleration a = −k r^(n−1) q (1 + g/r²)
// toward the origin, integrated by any integrator of the shared library (src/plates/_shared/ode),
// with the apsides of an orbit found where the radial velocity q·v changes sign. Each apsis is
// placed by a cubic Hermite interpolant through the two steps that bracket it (positions and
// velocities, so fourth order in the step), refined by the secant method on q·v, so its time, its
// distance and its angle are not limited by the step. Nothing here knows Kepler's laws: the
// period, the semimajor axis, the eccentricity, the apsidal angle and the precession are measured
// from the apsides, and the tests and claims hold them to the closed forms.
//
// k > 0 attracts, k < 0 repels. n = −2 is the inverse square; g ≠ 0 adds the weak-field correction
// of general relativity in the form the orbit equation takes, 3GM h²/(c² r⁴), with h = |q × v| the
// angular momentum per unit mass, which a central force keeps (g = 3h²/c², a constant of the orbit).
import { Rk4, euler, leapfrog, symplecticEuler, type Deriv } from '../ode/ode';

export type Integrator = 'euler' | 'symplectic-euler' | 'leapfrog' | 'rk4';

export interface CentralForce {
  /** Strength: |a| = |k| r^n, toward the centre when k > 0. */
  k: number;
  /** The power of r in the force; −2 is gravity and Coulomb. */
  n: number;
  /** The relativistic term's coefficient g = 3h²/c² (0: Newtonian). */
  g: number;
}

/** The acceleration at q (2-D), written into a. */
export function accel(f: CentralForce, q: Float64Array, a: Float64Array): void {
  const r2 = q[0] * q[0] + q[1] * q[1];
  const r = Math.sqrt(r2);
  // −k r^(n−1) q̂·r … written as −k r^(n−1) q / r · r = −k r^(n−1) (q / r) · r; for n = −2, −k q / r³
  const s = (-f.k * (f.n === -2 ? 1 / (r2 * r) : Math.pow(r, f.n - 1))) * (f.g === 0 ? 1 : 1 + f.g / r2);
  a[0] = s * q[0];
  a[1] = s * q[1];
}

/** The potential energy per unit mass whose gradient is −accel. */
export function potential(f: CentralForce, r: number): number {
  const base = f.n === -1 ? f.k * Math.log(r) : (f.k * Math.pow(r, f.n + 1)) / (f.n + 1);
  // the relativistic term of the inverse square: −k g / (3 r³)
  return f.g === 0 ? base : base - (f.k * f.g) / (3 * r * r * r);
}

/** The speed of a circular orbit of radius r under an attracting force: v² / r = k r^n. */
export const circularSpeed = (f: CentralForce, r: number) => Math.sqrt(f.k * Math.pow(r, f.n + 1));

export interface Apsis {
  kind: 'peri' | 'apo';
  t: number;
  r: number;
  /** The polar angle, unwrapped along the orbit (so successive apsides keep increasing). */
  angle: number;
}

export interface OrbitRun {
  apsides: Apsis[];
  steps: number;
  /** Energy per unit mass at the start, and the largest relative departure from it. */
  energy0: number;
  energyDrift: number;
  /** The largest relative departure in the first and in the second half of the run. */
  energyDriftFirstHalf: number;
  energyDriftSecondHalf: number;
  /** Angular momentum per unit mass h = |q × v| at the start, and its largest relative departure. */
  h0: number;
  hDrift: number;
  /** The run stopped because the particle left (r > escapeR) or its state stopped being finite. */
  escaped: boolean;
  t: number;
  /** Times at which the angle has turned by one more whole turn since the start. */
  crossings: number[];
  /** The least and greatest distance over the steps. */
  rMin: number;
  rMax: number;
}

export interface OrbitOptions {
  h: number;
  integrator: Integrator;
  /** Stop after this many perihelion passages (the start does not count). */
  perihelia: number;
  /** A step cap, whatever happens (an orbit that never returns). */
  maxSteps: number;
  /** Stop when r exceeds this (escape). */
  escapeR: number;
  /** Called after every step with the time and the state (x, y, vx, vy). */
  record?: (t: number, x: number, y: number, vx: number, vy: number) => void;
}

/** Cubic Hermite position and velocity between (p0, v0) and (p1, v1) over a step h, at s ∈ [0, 1]. */
function hermite(p0: number, v0: number, p1: number, v1: number, h: number, s: number): [number, number] {
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const p = h00 * p0 + h10 * h * v0 + h01 * p1 + h11 * h * v1;
  const d00 = 6 * s2 - 6 * s;
  const d10 = 3 * s2 - 4 * s + 1;
  const d01 = -6 * s2 + 6 * s;
  const d11 = 3 * s2 - 2 * s;
  const v = (d00 * p0 + d01 * p1) / h + d10 * v0 + d11 * v1;
  return [p, v];
}

/**
 * The apsis between two steps whose radial velocities bracket zero: the time fraction s where the
 * Hermite interpolant's q·v vanishes, by the secant method from the linear guess, and r and the
 * angle there.
 */
function apsisBetween(prev: Float64Array, next: Float64Array, h: number): { s: number; x: number; y: number } {
  const at = (s: number) => {
    const [x, vx] = hermite(prev[0], prev[2], next[0], next[2], h, s);
    const [y, vy] = hermite(prev[1], prev[3], next[1], next[3], h, s);
    return { x, y, u: x * vx + y * vy };
  };
  let s0 = 0;
  let u0 = prev[0] * prev[2] + prev[1] * prev[3];
  let s1 = 1;
  let u1 = next[0] * next[2] + next[1] * next[3];
  let s = u0 / (u0 - u1);
  for (let i = 0; i < 6; i++) {
    const m = at(s);
    if (m.u === 0) break;
    // keep the bracket, step by the secant of its ends (regula falsi, Illinois-free: 6 rounds suffice)
    if ((m.u < 0) === (u0 < 0)) { s0 = s; u0 = m.u; } else { s1 = s; u1 = m.u; }
    const next = s0 + (u0 * (s1 - s0)) / (u0 - u1);
    if (Math.abs(next - s) < 1e-15) { s = next; break; }
    s = next;
  }
  const m = at(s);
  return { s, x: m.x, y: m.y };
}

/** Integrate one orbit from (x, y, vx, vy) and measure its apsides and its conserved quantities. */
export function runOrbit(f: CentralForce, x0: number, y0: number, vx0: number, vy0: number, o: OrbitOptions): OrbitRun {
  const q = new Float64Array([x0, y0]);
  const v = new Float64Array([vx0, vy0]);
  const a = new Float64Array(2);
  const y = new Float64Array([x0, y0, vx0, vy0]);
  const scratch = new Float64Array(4);
  const rk = new Rk4(4);
  const deriv: Deriv = (_t, s, out) => {
    out[0] = s[2];
    out[1] = s[3];
    q[0] = s[0];
    q[1] = s[1];
    accel(f, q, a);
    out[2] = a[0];
    out[3] = a[1];
  };
  const kepler = f.n === -2 && f.g === 0;
  const energy = (x: number, yy: number, vx: number, vy: number) => {
    const r = Math.sqrt(x * x + yy * yy);
    return 0.5 * (vx * vx + vy * vy) + (kepler ? -f.k / r : potential(f, r));
  };
  const force = (qq: Float64Array, aa: Float64Array) => accel(f, qq, aa);
  const e0 = energy(x0, y0, vx0, vy0);
  const h0 = Math.abs(x0 * vy0 - y0 * vx0);
  const prev = new Float64Array(4);
  const cur = new Float64Array([x0, y0, vx0, vy0]);
  const apsides: Apsis[] = [];
  let lastAngle = Math.atan2(y0, x0);
  let unwrapped = lastAngle;
  const angle0 = lastAngle;
  const crossings: number[] = [];
  let rMin = Math.hypot(x0, y0);
  let rMax = rMin;
  const u00 = x0 * vx0 + y0 * vy0;
  const eps0 = 1e-10 * rMin * Math.hypot(vx0, vy0);
  let radial = u00 > eps0 ? 1 : u00 < -eps0 ? -1 : 0;
  let lastRadial = radial;
  const bracketA = new Float64Array(4);
  const bracketB = new Float64Array(4);
  let bracketT = 0;
  let bracketUnwrapped = 0;
  let bracketAngle = 0;
  let drift = 0;
  let hDrift = 0;
  let drifts = new Float64Array(Math.min(o.maxSteps, 1 << 16));
  let perihelia = 0;
  let escaped = false;
  let t = 0;
  let steps = 0;
  q[0] = x0;
  q[1] = y0;
  accel(f, q, a);
  // ends after the perihelia asked, or, for an orbit with none (a circle), as many whole turns
  while (steps < o.maxSteps && perihelia < o.perihelia && !(apsides.length === 0 && crossings.length >= o.perihelia)) {
    prev.set(cur);
    if (o.integrator === 'leapfrog') {
      leapfrog(q, v, a, o.h, force);
      cur[0] = q[0]; cur[1] = q[1]; cur[2] = v[0]; cur[3] = v[1];
    } else if (o.integrator === 'symplectic-euler') {
      symplecticEuler(q, v, o.h, force, a);
      cur[0] = q[0]; cur[1] = q[1]; cur[2] = v[0]; cur[3] = v[1];
    } else {
      y.set(cur);
      if (o.integrator === 'rk4') rk.step(deriv, t, y, o.h);
      else euler(deriv, t, y, o.h, scratch);
      cur.set(y);
    }
    t += o.h;
    steps++;
    const ang = Math.atan2(cur[1], cur[0]);
    let d = ang - lastAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    unwrapped += d;
    lastAngle = ang;
    const rel = Math.abs((energy(cur[0], cur[1], cur[2], cur[3]) - e0) / e0);
    if (steps > drifts.length) { const grown = new Float64Array(Math.min(o.maxSteps, 2 * drifts.length)); grown.set(drifts); drifts = grown; }
    drifts[steps - 1] = rel;
    if (rel > drift) drift = rel;
    const hNow = Math.abs(cur[0] * cur[3] - cur[1] * cur[2]);
    const hr = Math.abs(hNow - h0) / h0;
    if (hr > hDrift) hDrift = hr;
    const rNow = Math.sqrt(cur[0] * cur[0] + cur[1] * cur[1]);
    if (rNow < rMin) rMin = rNow;
    if (rNow > rMax) rMax = rNow;
    // a whole turn of the angle since the start, placed by linear interpolation of the angle
    if (Math.abs(unwrapped - angle0) >= 2 * Math.PI * (crossings.length + 1)) {
      const target = angle0 + Math.sign(unwrapped - angle0) * 2 * Math.PI * (crossings.length + 1);
      const before = unwrapped - d;
      crossings.push(t - o.h + (o.h * (target - before)) / d);
    }
    const u0 = prev[0] * prev[2] + prev[1] * prev[3];
    const u1 = cur[0] * cur[2] + cur[1] * cur[3];
    // the last step across which q·v changed sign brackets the apsis, kept until it is confirmed
    if ((u0 < 0 && u1 >= 0) || (u0 > 0 && u1 <= 0)) {
      bracketA.set(prev);
      bracketB.set(cur);
      bracketT = t;
      bracketUnwrapped = unwrapped;
      bracketAngle = ang;
    }
    // ...when the radial velocity has left round-off's band about zero: a circle's q·v is noise
    const eps = 1e-10 * rNow * Math.sqrt(cur[2] * cur[2] + cur[3] * cur[3]);
    if (u1 > eps) radial = 1;
    else if (u1 < -eps) radial = -1;
    if (radial !== lastRadial && radial !== 0 && lastRadial !== 0) {
      const m = apsisBetween(bracketA, bracketB, o.h);
      // the angle at the apsis, unwrapped: the step's own unwrapped angle less the turn since
      let back = Math.atan2(m.y, m.x) - bracketAngle;
      if (back > Math.PI) back -= 2 * Math.PI;
      else if (back < -Math.PI) back += 2 * Math.PI;
      const kind = radial > 0 ? 'peri' : 'apo';
      apsides.push({ kind, t: bracketT - o.h + m.s * o.h, r: Math.hypot(m.x, m.y), angle: bracketUnwrapped + back });
      if (kind === 'peri') perihelia++;
    }
    if (radial !== 0) lastRadial = radial;
    o.record?.(t, cur[0], cur[1], cur[2], cur[3]);
    if (!Number.isFinite(rNow) || rNow > o.escapeR) { escaped = true; break; }
  }
  const half = Math.floor(steps / 2);
  let first = 0;
  let second = 0;
  for (let i = 0; i < steps; i++) {
    if (i < half) first = Math.max(first, drifts[i]);
    else second = Math.max(second, drifts[i]);
  }
  return {
    apsides, steps, energy0: e0, energyDrift: drift, energyDriftFirstHalf: first, energyDriftSecondHalf: second,
    h0, hDrift, escaped, t, crossings, rMin, rMax,
  };
}

export interface OrbitMeasure {
  /** Perihelion passages measured. */
  perihelia: number;
  /** Mean time between successive perihelia. */
  period: number;
  rPeri: number;
  rApo: number;
  /** (rApo + rPeri)/2 and (rApo − rPeri)/(rApo + rPeri), from the measured apsides. */
  a: number;
  e: number;
  /** Mean angle from a perihelion to the next aphelion. */
  apsidal: number;
  /** Mean advance of the perihelion per orbit, beyond one whole turn. */
  precession: number;
}

/** What the apsides of a run say about its orbit; null when it did not close two perihelia. */
export function measureOrbit(run: OrbitRun): OrbitMeasure | null {
  const peri = run.apsides.filter((x) => x.kind === 'peri');
  const apo = run.apsides.filter((x) => x.kind === 'apo');
  if (peri.length < 2 || apo.length < 1) {
    // no apsides to read (a circle, to round-off): the period from whole turns of the angle
    const c = run.crossings;
    if (run.escaped || c.length < 1) return null;
    return {
      perihelia: 0, period: c[c.length - 1] / c.length, rPeri: run.rMin, rApo: run.rMax,
      a: (run.rMin + run.rMax) / 2, e: (run.rMax - run.rMin) / (run.rMax + run.rMin),
      apsidal: Number.NaN, precession: Number.NaN,
    };
  }
  const period = (peri[peri.length - 1].t - peri[0].t) / (peri.length - 1);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const rPeri = mean(peri.map((x) => x.r));
  const rApo = mean(apo.map((x) => x.r));
  const gaps: number[] = [];
  for (let i = 0; i + 1 < run.apsides.length; i++) {
    const p = run.apsides[i];
    const n = run.apsides[i + 1];
    if (p.kind === 'peri' && n.kind === 'apo') gaps.push(n.angle - p.angle);
  }
  const precession = (peri[peri.length - 1].angle - peri[0].angle) / (peri.length - 1) - 2 * Math.PI;
  return {
    perihelia: peri.length, period, rPeri, rApo, a: (rApo + rPeri) / 2, e: (rApo - rPeri) / (rApo + rPeri),
    apsidal: gaps.length ? mean(gaps) : Number.NaN, precession,
  };
}

/**
 * The deflection of a particle that arrives from far away at speed v0 with impact parameter b, under
 * a repulsive inverse square of strength κ (a = κ q/r³), integrated by RK4 with the step in
 * proportion to r/v (a time transformation: the close approach is resolved, the long legs cost
 * little). It starts at the distance `start` with the energy ½v0² and the angular momentum b·v0 it
 * has at infinity (conservation alone, not the orbit's shape), moving along +x, and stops once it is
 * as far out again. The angle measured is the turn of its velocity between the two moments; by the
 * orbit's symmetry it falls short of the whole deflection only by the two tails beyond `start`,
 * about 2κb/(v0² start²) radians.
 */
export function deflection(kappa: number, v0: number, b: number, start: number, eta: number,
  record?: (x: number, y: number) => void): { angle: number; steps: number } {
  const vs = Math.sqrt(v0 * v0 - (2 * kappa) / start);
  const y0 = (b * v0) / vs;
  const s = new Float64Array([-Math.sqrt(start * start - y0 * y0), y0, vs, 0]);
  const rk = new Rk4(4);
  const deriv: Deriv = (_t, y, out) => {
    const r2 = y[0] * y[0] + y[1] * y[1];
    const c = kappa / (r2 * Math.sqrt(r2));
    out[0] = y[2];
    out[1] = y[3];
    out[2] = c * y[0];
    out[3] = c * y[1];
  };
  let steps = 0;
  let t = 0;
  for (; steps < 100000; steps++) {
    const r = Math.hypot(s[0], s[1]);
    if (steps > 0 && r >= start && s[0] * s[2] + s[1] * s[3] > 0) break;
    const h = (eta * r) / Math.hypot(s[2], s[3]);
    rk.step(deriv, t, s, h);
    t += h;
    record?.(s[0], s[1]);
  }
  return { angle: Math.atan2(s[3], s[2]), steps };
}

/** The regularised lower incomplete gamma function P(a, x), by its series (x < a + 1) or continued fraction. */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const lg = logGamma(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lg);
  }
  // Lentz's continued fraction for Q(a, x)
  let bb = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / bb;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    bb += 2;
    d = an * d + bb;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = bb + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lg) * h;
}

/** ln Γ(x) for x > 0, by the Lanczos approximation (g = 7, nine coefficients). */
export function logGamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let s = c[0];
  for (let i = 1; i < 9; i++) s += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(s);
}

/** The point below which a χ² variable of `dof` degrees of freedom falls with probability p (bisection). */
export function chiSquareQuantile(p: number, dof: number): number {
  let lo = 0;
  let hi = dof + 20 * Math.sqrt(2 * dof) + 20;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (gammaP(dof / 2, mid / 2) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
