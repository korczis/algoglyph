// Overdamped Langevin walkers (plan S7b): dx = (F(x)/γ) dt + √(2D) dW with D = kT/γ (Einstein),
// by the Euler–Maruyama scheme, for many independent walkers in one or two dimensions. The
// potentials are presets: flat, a harmonic well, gravity above a reflecting floor, a uniform tilt,
// and an asymmetric sawtooth ratchet. Stability wants dt·|U″|/γ < 1, and the scheme has a known
// O(dt) bias (a harmonic well's stationary variance is (kT/k)/(1 − k dt/2γ)), which the tests use
// rather than hide. Noise is Box–Muller from the generator passed in; nothing else is random.
import { gaussian } from '../../../core/random';

export type PotentialKind = 'flat' | 'harmonic' | 'gravity' | 'tilt' | 'ratchet';

export interface Potential {
  kind: PotentialKind;
  strength: number;
  /** The force −U′(x) along the first axis. */
  force: (x: number) => number;
  U: (x: number) => number;
  /** A reflecting floor at x = 0 (gravity). */
  floor: boolean;
}

/** The ratchet's asymmetry: the potential rises over this fraction of each unit period. */
export const RATCHET_RISE = 0.8;

export function potentialOf(kind: PotentialKind, s: number): Potential {
  const frac = (x: number) => x - Math.floor(x);
  switch (kind) {
    case 'harmonic': return { kind, strength: s, force: (x) => -s * x, U: (x) => 0.5 * s * x * x, floor: false };
    case 'gravity': return { kind, strength: s, force: () => -s, U: (x) => s * x, floor: true };
    case 'tilt': return { kind, strength: s, force: () => s, U: (x) => -s * x, floor: false };
    case 'ratchet': return {
      kind, strength: s,
      force: (x) => (frac(x) < RATCHET_RISE ? -s / RATCHET_RISE : s / (1 - RATCHET_RISE)),
      U: (x) => (frac(x) < RATCHET_RISE ? (s * frac(x)) / RATCHET_RISE : (s * (1 - frac(x))) / (1 - RATCHET_RISE)),
      floor: false,
    };
    default: return { kind: 'flat', strength: 0, force: () => 0, U: () => 0, floor: false };
  }
}

export interface WalkerOptions {
  n: number;
  dims: 1 | 2;
  kT: number;
  gamma: number;
  dt: number;
  potential: Potential;
  /** Starting position along the first axis (default 0). */
  start?: number;
}

export class Walkers {
  readonly n: number;
  readonly dims: 1 | 2;
  readonly x: Float64Array;
  readonly x0: Float64Array;
  t = 0;
  private readonly sigma: number;

  constructor(readonly o: WalkerOptions, private readonly rnd: () => number) {
    this.n = o.n;
    this.dims = o.dims;
    this.x = new Float64Array(o.n * o.dims);
    for (let i = 0; i < o.n; i++) this.x[i * o.dims] = o.start ?? 0;
    this.x0 = Float64Array.from(this.x);
    this.sigma = Math.sqrt((2 * o.kT * o.dt) / o.gamma);
  }

  /** The diffusion constant D = kT/γ. */
  get D(): number { return this.o.kT / this.o.gamma; }

  step(): void {
    const { dims, dt, gamma, potential } = this.o;
    const x = this.x;
    for (let i = 0; i < this.n; i++) {
      const k = i * dims;
      let v = x[k] + (potential.force(x[k]) / gamma) * dt + this.sigma * gaussian(this.rnd);
      if (potential.floor && v < 0) v = -v;
      x[k] = v;
      if (dims === 2) x[k + 1] += this.sigma * gaussian(this.rnd);
    }
    this.t += dt;
  }

  /** Mean squared displacement from the start. */
  msd(): number {
    let s = 0;
    for (let i = 0; i < this.x.length; i++) s += (this.x[i] - this.x0[i]) ** 2;
    return s / this.n;
  }

  /** Mean velocity along the first axis since the start, with its standard error. */
  drift(): { mean: number; se: number } {
    const d = Array.from({ length: this.n }, (_, i) => this.x[i * this.dims] - this.x0[i * this.dims]);
    const mean = d.reduce((a, b) => a + b, 0) / this.n;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (this.n - 1));
    return { mean: mean / this.t, se: sd / Math.sqrt(this.n) / this.t };
  }

  /** Positions along the first axis. */
  positions(): Float64Array {
    const out = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) out[i] = this.x[i * this.dims];
    return out;
  }
}

/** The drift of n walkers in a ratchet of height 2kT at one temperature, after `steps`. */
export function ratchetDrift(n: number, steps: number, rnd: () => number): { mean: number; se: number } {
  const w = new Walkers({ n, dims: 1, kT: 1, gamma: 1, dt: 0.002, potential: potentialOf('ratchet', 2) }, rnd);
  for (let i = 0; i < steps; i++) w.step();
  return w.drift();
}
