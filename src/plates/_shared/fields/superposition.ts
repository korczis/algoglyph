// Static fields by superposition (plan S8a): point charges in three dimensions, in units where
// ε₀ = 1, so E = Σ q (r − rᵢ)/(4π|r − rᵢ|³) and V = Σ q/(4π|r − rᵢ|). Everything a plate measures
// is computed from these two sums by a different route than the closed form it is held to:
// Gauss's law as a numerical surface integral (Gauss–Legendre in cos θ, the trapezoid in φ), the
// charge induced on a grounded plane as a numerical integral of its surface charge, a far-field
// slope by least squares, field lines by the shared RK4 (src/plates/_shared/ode). Gravity is the
// same law with mass for charge and the sign flipped. Pure: no p5, no randomness.
import { Rk4 } from '../ode/ode';

export interface Charge {
  x: number;
  y: number;
  z?: number;
  q: number;
}

const FOUR_PI = 4 * Math.PI;

/** E at (x, y, z). */
export function field(charges: readonly Charge[], x: number, y: number, z = 0): [number, number, number] {
  let ex = 0;
  let ey = 0;
  let ez = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dz = z - (c.z ?? 0);
    const r2 = dx * dx + dy * dy + dz * dz;
    const k = c.q / (FOUR_PI * r2 * Math.sqrt(r2));
    ex += k * dx;
    ey += k * dy;
    ez += k * dz;
  }
  return [ex, ey, ez];
}

/** V at (x, y, z). */
export function potential(charges: readonly Charge[], x: number, y: number, z = 0): number {
  let v = 0;
  for (const c of charges) v += c.q / (FOUR_PI * Math.hypot(x - c.x, y - c.y, z - (c.z ?? 0)));
  return v;
}

/** Nodes (ascending) and weights of the n-point Gauss–Legendre rule on [−1, 1], by Newton's method. */
export function gaussLegendre(n: number): { x: Float64Array; w: Float64Array } {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    let t = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (t * p1 - p0)) / (t * t - 1);
      const dt = p1 / dp;
      t -= dt;
      if (Math.abs(dt) < 1e-16) break;
    }
    x[n - 1 - i] = t;
    x[i] = -t;
    w[i] = w[n - 1 - i] = 2 / ((1 - t * t) * dp * dp);
  }
  return { x, w };
}

/**
 * ∮ E · n dA over the sphere of radius R about `centre`: Gauss–Legendre in cos θ, the trapezoid
 * (exponentially accurate for a smooth periodic integrand) in φ. Accurate to about 1e−10 while no
 * charge lies within a tenth of R of the surface.
 */
export function gaussFlux(charges: readonly Charge[], centre: [number, number, number], R: number,
  nTheta = 96, nPhi = 192): number {
  const { x: mu, w } = gaussLegendre(nTheta);
  let total = 0;
  for (let i = 0; i < nTheta; i++) {
    const st = Math.sqrt(1 - mu[i] * mu[i]);
    let ring = 0;
    for (let j = 0; j < nPhi; j++) {
      const ph = (2 * Math.PI * j) / nPhi;
      const nx = st * Math.cos(ph);
      const ny = st * Math.sin(ph);
      const nz = mu[i];
      const [ex, ey, ez] = field(charges, centre[0] + R * nx, centre[1] + R * ny, centre[2] + R * nz);
      ring += ex * nx + ey * ny + ez * nz;
    }
    total += w[i] * ring * ((2 * Math.PI) / nPhi);
  }
  return total * R * R;
}

/**
 * The charge induced on a grounded plane by a charge q at height a, from its image: σ = E_n just
 * above the plane (the field of the charge and its image −q mirrored below), integrated over the
 * plane in rings, ρ = a tan α with α by Gauss–Legendre. Equal to −q.
 */
export function planeInducedCharge(q: number, a: number, n = 96): number {
  const pair: Charge[] = [{ x: 0, y: a, z: 0, q }, { x: 0, y: -a, z: 0, q: -q }];
  const { x, w } = gaussLegendre(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const alpha = (Math.PI / 4) * (x[i] + 1);
    const rho = a * Math.tan(alpha);
    const drho = (a / Math.cos(alpha) ** 2) * (Math.PI / 4);
    const [, ey] = field(pair, rho, 0, 0);
    total += w[i] * ey * 2 * Math.PI * rho * drho;
  }
  return total;
}

/** The image that grounds a sphere of radius R for a charge q at distance a > R from its centre. */
export function sphereImage(q: number, a: number, R: number): { q: number; at: number } {
  return { q: (-q * R) / a, at: (R * R) / a };
}

/** Least-squares slope of ln|E| against ln r on the +x axis, for r from r0 to r1 (log-spaced). */
export function dipoleAxisSlope(charges: readonly Charge[], r0: number, r1: number, n = 24): number {
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const r = r0 * (r1 / r0) ** (i / (n - 1));
    const [ex, ey, ez] = field(charges, r, 0, 0);
    const lx = Math.log(r);
    const ly = Math.log(Math.hypot(ex, ey, ez));
    sx += lx;
    sy += ly;
    sxx += lx * lx;
    sxy += lx * ly;
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

export interface LineOptions {
  /** Arc length per RK4 step. */
  step: number;
  maxSteps: number;
  /** The line stops outside |x|, |y| ≤ bounds (or bx, by when given). */
  bounds: number;
  boundsY?: number;
  /** +1 traces along E (from a positive charge), −1 against it (from a negative one). */
  sign?: number;
  /** Stop within this distance of a charge the line runs into. */
  stopRadius?: number;
}

const lineStepper = new Rk4(2);
const lineState = new Float64Array(2);

/** A field line in the z = 0 plane from (x0, y0): points along the unit field, by RK4 in arc length. */
export function fieldLine(charges: readonly Charge[], x0: number, y0: number, o: LineOptions): [number, number][] {
  const sign = o.sign ?? 1;
  const stop = o.stopRadius ?? 2 * o.step;
  const by = o.boundsY ?? o.bounds;
  const dir = (_t: number, y: Float64Array, out: Float64Array) => {
    const [ex, ey] = field(charges, y[0], y[1], 0);
    const m = Math.hypot(ex, ey) || 1;
    out[0] = (sign * ex) / m;
    out[1] = (sign * ey) / m;
  };
  lineState[0] = x0;
  lineState[1] = y0;
  const out: [number, number][] = [[x0, y0]];
  for (let s = 0; s < o.maxSteps; s++) {
    lineStepper.step(dir, 0, lineState, o.step);
    const px = lineState[0];
    const py = lineState[1];
    out.push([px, py]);
    if (Math.abs(px) > o.bounds || Math.abs(py) > by) break;
    // a line ends in a charge of the other sign from the one it left
    if (charges.some((c) => sign * c.q < 0 && Math.hypot(px - c.x, py - c.y) < stop)) break;
  }
  return out;
}
