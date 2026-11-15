// The energy of a ball of charge, three ways (plan S8a, still plates), in units where ε₀ = 1, the
// total charge Q = 1 and the radius R = 1: a spherically symmetric density ρ(r) on [0, 1] (∝ r^k,
// a thin shell, or a reader's table), its enclosed charge Q(r) by quadrature, and then
//   the field energy ∫ ½E² dV with E = Q(r)/4πr² (Gauss's law), out to infinity;
//   the work of assembling it shell by shell from infinity, ∫ Q(r) dQ / 4πr;
//   half the sum over pairs of points drawn from ρ, Σ qᵢqⱼ/4πrᵢⱼ, each carrying Q/N (Monte Carlo).
// None of them uses the closed form (k + 3)/(2k + 5) · Q²/4πR, which the plate prints beside them.
import { gaussLegendre } from './superposition';

export type Profile =
  | { kind: 'power'; k: number }
  | { kind: 'shell' }
  /** Piecewise linear ρ through (r, ρ) points, r ascending in [0, 1]. */
  | { kind: 'table'; r: ArrayLike<number>; rho: ArrayLike<number> };

const FOUR_PI = 4 * Math.PI;
const GL = gaussLegendre(64);

/** ∫ f over [a, b] by Gauss–Legendre, in `pieces` equal pieces. */
function quad(f: (x: number) => number, a: number, b: number, pieces = 8): number {
  const h = (b - a) / pieces;
  let s = 0;
  for (let p = 0; p < pieces; p++) {
    for (let i = 0; i < GL.x.length; i++) s += GL.w[i] * (h / 2) * f(a + h * (p + (GL.x[i] + 1) / 2));
  }
  return s;
}

/** The unnormalised density at r, for a profile with a volume density. */
function rawRho(p: Profile, r: number): number {
  if (p.kind === 'power') return r ** p.k;
  if (p.kind === 'table') {
    const { r: rs, rho } = p;
    if (r <= rs[0]) return rho[0];
    for (let i = 1; i < rs.length; i++) {
      if (r <= rs[i]) {
        const t = (r - rs[i - 1]) / Math.max(1e-300, rs[i] - rs[i - 1]);
        return rho[i - 1] + t * (rho[i] - rho[i - 1]);
      }
    }
    return rs[rs.length - 1] >= 1 ? rho[rho.length - 1] : 0;
  }
  return 0;
}

export interface Ball {
  profile: Profile;
  /** Normalisation: ρ(r) = rawRho(r)/norm, so that the total charge is 1. */
  norm: number;
  /** Q(r) tabulated on a fine grid of [0, 1], for the field and the sampling. */
  grid: Float64Array;
  q: Float64Array;
}

const CELLS = 2048;

/** The enclosed charge Q(r) on a grid of [0, 1], each cell's charge by Gauss–Legendre. */
export function ball(profile: Profile): Ball {
  const grid = new Float64Array(CELLS + 1);
  const q = new Float64Array(CELLS + 1);
  for (let i = 0; i <= CELLS; i++) grid[i] = i / CELLS;
  if (profile.kind === 'shell') {
    q.fill(0);
    q[CELLS] = 1;
    return { profile, norm: 1, grid, q };
  }
  for (let i = 1; i <= CELLS; i++) {
    q[i] = q[i - 1] + quad((r) => FOUR_PI * r * r * rawRho(profile, r), grid[i - 1], grid[i], 1);
  }
  const norm = q[CELLS] || 1;
  for (let i = 0; i <= CELLS; i++) q[i] /= norm;
  return { profile, norm, grid, q };
}

/** Q(r) for r in [0, 1] (the charge inside r), by the cell's own quadrature from its lower edge. */
export function enclosed(b: Ball, r: number): number {
  if (r >= 1) return 1;
  if (b.profile.kind === 'shell') return 0;
  const i = Math.min(CELLS - 1, Math.floor(r * CELLS));
  const p = b.profile;
  return b.q[i] + quad((s) => FOUR_PI * s * s * rawRho(p, s), b.grid[i], r, 1) / b.norm;
}

/** ∫ ½E² dV over all space: inside by quadrature in r, outside by r = 1/u, u in (0, 1]. */
export function fieldEnergy(b: Ball): number {
  const inside = b.profile.kind === 'shell' ? 0
    : quad((r) => { const e = enclosed(b, r) / (FOUR_PI * r * r); return 0.5 * e * e * FOUR_PI * r * r; }, 0, 1, 32);
  // outside E = 1/4πr²; with r = 1/u, dV = 4π du/u⁴
  const outside = quad((u) => { const e = (u * u) / FOUR_PI; return (0.5 * e * e * FOUR_PI) / u ** 4; }, 0, 1, 4);
  return inside + outside;
}

/** The work of bringing the charge in from infinity, shell by shell: ∫ Q(r) dQ/4πr. */
export function assemblyWork(b: Ball): number {
  // a thin shell is charged at r = 1 from 0 to 1: ∫ Q dQ / 4π = 1/8π, done as a quadrature in Q
  if (b.profile.kind === 'shell') return quad((Q) => Q / FOUR_PI, 0, 1, 1);
  const p = b.profile;
  return quad((r) => (enclosed(b, r) * FOUR_PI * r * r * rawRho(p, r)) / b.norm / (FOUR_PI * r), 0, 1, 32);
}

/** A radius drawn from the charge's distribution, by inverting the tabulated Q(r). */
export function sampleRadius(b: Ball, u: number): number {
  if (b.profile.kind === 'shell') return 1;
  let lo = 0;
  let hi = CELLS;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (b.q[mid] < u) lo = mid; else hi = mid; }
  const t = (u - b.q[lo]) / Math.max(1e-300, b.q[hi] - b.q[lo]);
  return b.grid[lo] + t * (b.grid[hi] - b.grid[lo]);
}

/** N points drawn from ρ: the radius by inverting Q(r), the direction uniform on the sphere. */
export function samplePoints(b: Ball, n: number, rnd: () => number): { x: Float64Array; y: Float64Array; z: Float64Array } {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = sampleRadius(b, rnd());
    const mu = 2 * rnd() - 1;
    const ph = 2 * Math.PI * rnd();
    const s = Math.sqrt(1 - mu * mu);
    x[i] = r * s * Math.cos(ph); y[i] = r * s * Math.sin(ph); z[i] = r * mu;
  }
  return { x, y, z };
}

/**
 * The energy of the pairs of N points, each carrying 1/N, divided by 1 − 1/N: the pair sum misses
 * each point's own energy, and its expectation is (1 − 1/N) times the continuum's. Summed a row of
 * pairs at a time, so the sum can be spread over frames.
 */
export class PairSum {
  readonly n: number;
  row = 0;
  pairs = 0;
  private sum = 0;
  constructor(private readonly p: { x: Float64Array; y: Float64Array; z: Float64Array }) { this.n = p.x.length; }
  get done(): boolean { return this.row >= this.n - 1; }
  /** Sum whole rows until about `budget` more pairs are done; true once every pair is. */
  advance(budget: number): boolean {
    const { x, y, z } = this.p;
    let spent = 0;
    while (!this.done && spent < budget) {
      const i = this.row;
      for (let j = i + 1; j < this.n; j++) {
        const d = Math.hypot(x[i] - x[j], y[i] - y[j], z[i] - z[j]);
        if (d > 0) this.sum += 1 / d;
      }
      spent += this.n - 1 - i;
      this.pairs += this.n - 1 - i;
      this.row++;
    }
    return this.done;
  }
  get energy(): number {
    const q = 1 / this.n;
    return (q * q * this.sum) / FOUR_PI / (1 - 1 / this.n);
  }
}

/**
 * The momentum of the field of the ball moving slowly at v, over U v/c²: B = v × E/c², so the
 * momentum density ε₀ E × B has the component E² sin²θ v/c² along v. Integrated over r and θ by
 * quadrature, against the energy ∫ ½E² dV; 4/3 for every spherical distribution (the 4/3 problem).
 */
export function momentumOverEnergy(b: Ball): number {
  // ∫ E² sin²θ dV as a double quadrature in r and μ = cos θ, inside and (r = 1/u) outside
  const E = (r: number) => (r >= 1 ? 1 : enclosed(b, r)) / (FOUR_PI * r * r);
  const ring = (r: number, jac: number) => { const e = E(r); return quad((mu) => e * e * (1 - mu * mu) * 2 * Math.PI * r * r * jac, -1, 1, 1); };
  const inside = b.profile.kind === 'shell' ? 0 : quad((r) => ring(r, 1), 0, 1, 16);
  const outside = quad((u) => ring(1 / u, 1 / (u * u)), 0, 1, 4);
  return (inside + outside) / fieldEnergy(b);
}

/** The closed form of the energy, (k + 3)/(2k + 5) · Q²/4πR, and 1/2 for a shell. */
export function closedForm(p: Profile): number | null {
  if (p.kind === 'shell') return 0.5 / FOUR_PI;
  if (p.kind === 'power') return (p.k + 3) / (2 * p.k + 5) / FOUR_PI;
  return null;
}

/** CODATA 2018: the elementary charge (exact), ε₀, the electron's mass, c (exact), and r_e. */
export const CODATA = {
  e: 1.602176634e-19,
  eps0: 8.8541878128e-12,
  me: 9.1093837015e-31,
  c: 299792458,
  re: 2.8179403262e-15,
};
