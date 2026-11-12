// The time-dependent Schrödinger equation i∂ψ/∂t = −½∂²ψ/∂x² + V(x)ψ (ħ = m = 1) on a uniform
// 1D grid, advanced by the split-step Fourier method (Strang splitting): half a potential
// phase, the exact kinetic phase in k-space, half a potential phase. The FFT is a radix-2
// Cooley–Tukey transform (src/plates/_shared/fft/); plane-wave transmission comes from transfer
// matrices.
import { flush, TINY } from '../../core/budget';
import { Fft } from '../_shared/fft/fft';

// the FFT is shared with the two-slit wall: one implementation, re-exported where it was
export { Fft };

/**
 * A piecewise-constant potential: `values[0]` left of `edges[0]`, `values[j]` between
 * `edges[j − 1]` and `edges[j]`, the last value right of the last edge.
 */
export interface Potential {
  edges: number[];
  values: number[];
}

export type Preset = 'single' | 'double' | 'step';

/** Inner width of the double-barrier well. */
export const WELL = 4;

/** The preset's potential with its edges snapped to multiples of dx (x = 0 is a grid point). */
export function potential(preset: Preset, v0: number, width: number, dx: number): Potential {
  const snap = (x: number) => Math.round(x / dx) * dx;
  const a = Math.max(dx, snap(width));
  if (preset === 'step') return { edges: [0], values: [0, v0] };
  if (preset === 'double') {
    const g = snap(WELL / 2);
    return { edges: [-g - a, -g, g, g + a], values: [0, v0, 0, v0, 0] };
  }
  const l = snap(-a / 2);
  return { edges: [l, l + a], values: [0, v0, 0] };
}

/**
 * Transmission probability of a plane wave of energy E incident from the left, by carrying
 * (ψ, ψ′) of the transmitted wave e^{iqx} leftwards through each constant region.
 */
export function transmission(energy: number, pot: Potential): number {
  const { edges, values } = pot;
  const sRight = 2 * (energy - values[values.length - 1]);
  const sLeft = 2 * (energy - values[0]);
  if (sRight <= 0 || sLeft <= 0) return 0;
  const q = Math.sqrt(sRight);
  let pr = 1;
  let pi = 0;
  let dr = 0;
  let di = q;
  for (let j = edges.length - 1; j >= 1; j--) {
    const w = edges[j] - edges[j - 1];
    const s = 2 * (energy - values[j]);
    // ψ(x − w) = c·ψ − (sin(qw)/q)·ψ′ and ψ′(x − w) = q·sin(qw)·ψ + c·ψ′, with q² = s
    let c: number;
    let sq: number;
    let qs: number;
    if (s > 0) {
      const r = Math.sqrt(s);
      c = Math.cos(r * w);
      sq = Math.sin(r * w) / r;
      qs = r * Math.sin(r * w);
    } else if (s < 0) {
      const r = Math.sqrt(-s);
      c = Math.cosh(r * w);
      sq = Math.sinh(r * w) / r;
      qs = -r * Math.sinh(r * w);
    } else {
      c = 1;
      sq = w;
      qs = 0;
    }
    const npr = c * pr - sq * dr;
    const npi = c * pi - sq * di;
    dr = qs * pr + c * dr;
    di = qs * pi + c * di;
    pr = npr;
    pi = npi;
  }
  const k = Math.sqrt(sLeft);
  // incident amplitude A = (ψ + ψ′/(ik)) / 2 up to a unit phase
  const ar = (pr + di / k) / 2;
  const ai = (pi - dr / k) / 2;
  return q / k / (ar * ar + ai * ai);
}

/**
 * The transmission a Gaussian packet of width σ (in x) and mean momentum k0 should show once
 * it has fully left the barrier: T(k²/2) averaged over |φ(k)|² ∝ exp(−2σ²(k − k0)²); the
 * components with k ≤ 0 move away from the barrier and count as reflected.
 */
export function packetTransmission(k0: number, sigma: number, pot: Potential): number {
  const sk = 1 / (2 * sigma);
  const m = 1200;
  const lo = k0 - 8 * sk;
  const h = (16 * sk) / m;
  let num = 0;
  let den = 0;
  for (let i = 0; i <= m; i++) {
    const k = lo + i * h;
    const wt = (i === 0 || i === m ? 0.5 : 1) * Math.exp(-2 * sigma * sigma * (k - k0) ** 2);
    den += wt;
    if (k > 0) num += wt * transmission((k * k) / 2, pot);
  }
  return num / den;
}

const CAP_C = 2.62206;
const CAP_DELTA = 0.2;

/**
 * Manolopoulos' transmission-free absorbing potential W at depth s ∈ [0, 1] into an edge of
 * width L: −iW damps ψ as e^{−W·dt}, per unit time and not per step, and W diverges at the grid
 * end, so nothing wraps round. It reflects little above k_min = c/(2δL).
 */
export function absorbing(s: number, length: number): number {
  const c = CAP_C;
  const kMin = c / (2 * CAP_DELTA * length);
  const y = c * s;
  if (y >= c) return Infinity;
  const a = 1 - 16 / c ** 3;
  const b = (1 - 17 / c ** 3) / (c * c);
  return ((kMin * kMin) / 2) * (a * y - b * y ** 3 + 4 / (c - y) ** 2 - 4 / (c + y) ** 2);
}

export interface GridSpec {
  /** Number of grid points, a power of two. */
  n: number;
  dx: number;
  dt: number;
  /** Width of each absorbing edge in cells; 0 makes the grid periodic. */
  absorb: number;
}

/** The state ψ on the grid, with the probability its absorbing edges have taken in. */
export class Wave {
  readonly spec: GridSpec;
  readonly re: Float64Array;
  readonly im: Float64Array;
  readonly x: Float64Array;
  readonly k: Float64Array;
  readonly v: Float64Array;
  t = 0;
  steps = 0;
  absorbedLeft = 0;
  absorbedRight = 0;
  private readonly fft: Fft;
  private readonly halfV: Float64Array[];
  private readonly fullV: Float64Array[];
  private readonly kin: Float64Array[];
  private readonly mask: Float64Array;
  private readonly sr: Float64Array;
  private readonly si: Float64Array;

  constructor(spec: GridSpec, pot: Potential) {
    const { n, dx, dt, absorb } = spec;
    this.spec = spec;
    this.fft = new Fft(n);
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.sr = new Float64Array(n);
    this.si = new Float64Array(n);
    this.x = new Float64Array(n);
    this.k = new Float64Array(n);
    this.v = new Float64Array(n);
    const length = n * dx;
    for (let i = 0; i < n; i++) {
      this.x[i] = (i - n / 2) * dx;
      this.k[i] = ((2 * Math.PI) / length) * (i < n / 2 ? i : i - n);
    }
    const { edges, values } = pot;
    for (let i = 0; i < n; i++) {
      let r = 0;
      // compare in cells, so an edge that is a multiple of dx falls exactly on a grid point
      while (r < edges.length && i - n / 2 >= Math.round(edges[r] / dx)) r++;
      this.v[i] = values[r];
    }
    this.halfV = [new Float64Array(n), new Float64Array(n)];
    this.fullV = [new Float64Array(n), new Float64Array(n)];
    this.kin = [new Float64Array(n), new Float64Array(n)];
    for (let i = 0; i < n; i++) {
      const pv = (-this.v[i] * dt) / 2;
      this.halfV[0][i] = Math.cos(pv);
      this.halfV[1][i] = Math.sin(pv);
      this.fullV[0][i] = Math.cos(2 * pv);
      this.fullV[1][i] = Math.sin(2 * pv);
      const pk = (-this.k[i] * this.k[i] * dt) / 2;
      this.kin[0][i] = Math.cos(pk);
      this.kin[1][i] = Math.sin(pk);
    }
    this.mask = new Float64Array(n).fill(1);
    for (let j = 0; j < absorb; j++) {
      const m = Math.exp(-absorbing((absorb - j) / absorb, absorb * dx) * dt);
      this.mask[j] = m;
      this.mask[n - 1 - j] = m;
    }
  }

  /** ψ = Gaussian of position spread σ (of |ψ|²) at x0 with mean momentum k0, Σ|ψ|²dx = 1. */
  gaussian(x0: number, k0: number, sigma: number): void {
    for (let i = 0; i < this.spec.n; i++) {
      const d = this.x[i] - x0;
      const a = flush(Math.exp(-(d * d) / (4 * sigma * sigma)));
      this.re[i] = a * Math.cos(k0 * this.x[i]);
      this.im[i] = a * Math.sin(k0 * this.x[i]);
    }
    const s = 1 / Math.sqrt(this.norm());
    for (let i = 0; i < this.spec.n; i++) {
      this.re[i] *= s;
      this.im[i] *= s;
    }
    this.t = 0;
    this.steps = 0;
    this.absorbedLeft = 0;
    this.absorbedRight = 0;
  }

  private phase(c: Float64Array, s: Float64Array, re: Float64Array, im: Float64Array): void {
    for (let i = 0; i < re.length; i++) {
      const r = re[i];
      re[i] = r * c[i] - im[i] * s[i];
      im[i] = r * s[i] + im[i] * c[i];
    }
  }

  /**
   * Advance `count` steps. The closing half step of potential of one step and the opening half
   * of the next are applied together as one full step; the absorbing mask is diagonal like the
   * potential, so where it is applied between them does not matter.
   */
  step(count = 1): void {
    const { re, im } = this;
    const n = this.spec.n;
    const absorb = this.spec.absorb;
    const dx = this.spec.dx;
    // whole steps only: a fractional count would end on a full potential step, not a half
    count = Math.floor(count);
    if (count < 1) return;
    this.phase(this.halfV[0], this.halfV[1], re, im);
    for (let s = 0; s < count; s++) {
      this.fft.transform(re, im);
      this.phase(this.kin[0], this.kin[1], re, im);
      this.fft.transform(re, im, true);
      const v = s === count - 1 ? this.halfV : this.fullV;
      this.phase(v[0], v[1], re, im);
      if (absorb > 0) {
        let left = 0;
        let right = 0;
        for (let j = 0; j < absorb; j++) {
          const m = this.mask[j];
          const loss = 1 - m * m;
          const a = j;
          const b = n - 1 - j;
          left += (re[a] * re[a] + im[a] * im[a]) * loss;
          right += (re[b] * re[b] + im[b] * im[b]) * loss;
          re[a] = flush(re[a] * m);
          im[a] = flush(im[a] * m);
          re[b] = flush(re[b] * m);
          im[b] = flush(im[b] * m);
        }
        this.absorbedLeft += left * dx;
        this.absorbedRight += right * dx;
      }
      this.t += this.spec.dt;
      this.steps++;
    }
    // what has decayed below TINY anywhere (tails, a state the edges have all but swallowed) is
    // zero, so the FFT never runs on subnormal floats
    for (let i = 0; i < n; i++) {
      if (re[i] < TINY && re[i] > -TINY) re[i] = 0;
      if (im[i] < TINY && im[i] > -TINY) im[i] = 0;
    }
  }

  /** Σ|ψ|²dx over the cells with lo ≤ x < hi (the whole grid by default). */
  probability(lo = -Infinity, hi = Infinity): number {
    let s = 0;
    for (let i = 0; i < this.spec.n; i++) {
      const x = this.x[i];
      if (x >= lo && x < hi) s += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    }
    return s * this.spec.dx;
  }

  norm(): number {
    return this.probability();
  }

  /** ⟨x⟩ and the spread √(⟨x²⟩ − ⟨x⟩²) of |ψ|². */
  spread(): { mean: number; width: number } {
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < this.spec.n; i++) {
      const d = this.re[i] * this.re[i] + this.im[i] * this.im[i];
      s0 += d;
      s1 += d * this.x[i];
      s2 += d * this.x[i] * this.x[i];
    }
    const mean = s1 / s0;
    return { mean, width: Math.sqrt(Math.max(0, s2 / s0 - mean * mean)) };
  }

  /** ⟨k⟩ and ⟨H⟩ = ⟨k²/2⟩ + ⟨V⟩ of the state on the grid, normalised by its own norm. */
  measure(): { momentum: number; kinetic: number; potential: number; energy: number } {
    const { sr, si, re, im } = this;
    sr.set(re);
    si.set(im);
    this.fft.transform(sr, si);
    let p0 = 0;
    let p1 = 0;
    let p2 = 0;
    let x0 = 0;
    let xv = 0;
    for (let i = 0; i < this.spec.n; i++) {
      const pk = sr[i] * sr[i] + si[i] * si[i];
      const k = this.k[i];
      p0 += pk;
      p1 += pk * k;
      p2 += pk * k * k;
      const d = re[i] * re[i] + im[i] * im[i];
      x0 += d;
      xv += d * this.v[i];
    }
    const kinetic = p2 / p0 / 2;
    const pot = xv / x0;
    return { momentum: p1 / p0, kinetic, potential: pot, energy: kinetic + pot };
  }
}
