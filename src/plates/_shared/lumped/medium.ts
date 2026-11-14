// A medium of bound electrons (plan S1): each kind j of electron is a damped oscillator of natural
// frequency ω_j and damping γ_j, a fraction f_j of the N electrons per volume, driven by the light's
// field. Its displacement is measured by the shared lock-in (src/plates/_shared/lumped/oscillator):
// the oscillator is integrated by RK4 from rest under cos ωt and correlated with the drive over whole
// periods. The polarisation N q x of all of them, over ε₀E, is the susceptibility χ(ω), measured;
// the Lorentz sum Σ f_j ω_p² / (ω_j² − ω² + iγ_jω) is what it is held to and is never used to make it.
// From χ: the index n = √(1 + χ) (the root with a non-negative imaginary part), the local-field
// (Clausius–Mossotti) correction for a dense medium, a Kramers–Kronig reconstruction of Re χ from the
// measured Im χ by the Hilbert transform of src/kernels/signal/hilbert-analytic, and the f-sum.
// Sign convention: a field E cos ωt, a response A cos(ωt − φ); Im χ = |χ| sin φ ≥ 0 is absorption.
import { analytic } from '../../../kernels/signal/hilbert-analytic';
import { Rk4, type Deriv } from '../ode/ode';
import { STEPS_PER_PERIOD } from './oscillator';

export interface Resonance {
  /** Natural frequency, in units of the plate's reference ω₀. */
  w0: number;
  /** Fraction of the electrons in this resonance (the oscillator strength). */
  f: number;
  /** Damping rate. */
  gamma: number;
}

export interface Medium {
  /** Plasma frequency ω_p² = Nq²/(ε₀m) of all the electrons together. */
  wp2: number;
  resonances: Resonance[];
  /** Correct for the field of the neighbouring dipoles: dense matter, Clausius–Mossotti. */
  dense: boolean;
}

export interface Complex { re: number; im: number }

/** The Lorentz sum Σ f ω_p² / (ω_j² − ω² − iγω): the closed form the measurement is held to. */
export function lorentz(m: Medium, w: number): Complex {
  let re = 0;
  let im = 0;
  for (const r of m.resonances) {
    const a = r.w0 * r.w0 - w * w;
    const b = r.gamma * w;
    const d = a * a + b * b;
    re += (r.f * m.wp2 * a) / d;
    im += (r.f * m.wp2 * b) / d;
  }
  return m.dense ? localField({ re, im }) : { re, im };
}

/**
 * The local-field correction: dipoles in dense matter feel E + P/3ε₀, so with the dilute response
 * χₗ the medium's own is χ = χₗ / (1 − χₗ/3), the Clausius–Mossotti relation solved for χ.
 */
export function localField(x: Complex): Complex {
  const dr = 1 - x.re / 3;
  const di = -x.im / 3;
  const d = dr * dr + di * di;
  return { re: (x.re * dr + x.im * di) / d, im: (x.im * dr - x.re * di) / d };
}

/**
 * One kind of electron's displacement per unit force, measured as the driven oscillator's lock-in
 * measures it (src/plates/_shared/lumped/oscillator, lockIn): RK4 from rest under cos ωt at
 * STEPS_PER_PERIOD steps a period of the faster of ω and ω_j, 28/γ of settling (the start decays by
 * e^(−14)), then the trapezoid correlation with cos ωt and sin ωt over twenty whole drive periods.
 * Resumable: `advance(steps)` takes at most that many steps, so a plate spreads a slow one over frames.
 */
export class LockIn {
  result: Complex | null = null;
  private readonly y = new Float64Array(2);
  private readonly rk = new Rk4(2);
  private readonly f: Deriv;
  private readonly h: number;
  private readonly settle: number;
  private readonly n: number;
  private k = 0;
  private t = 0;
  private c = 0;
  private s = 0;

  constructor(r: Resonance, private readonly w: number) {
    this.f = (t, y, out) => {
      out[0] = y[1];
      out[1] = -r.gamma * y[1] - r.w0 * r.w0 * y[0] + Math.cos(w * t);
    };
    const step = (2 * Math.PI) / (STEPS_PER_PERIOD * Math.max(r.w0, w));
    const period = (2 * Math.PI) / w;
    const perPeriod = Math.max(STEPS_PER_PERIOD, Math.ceil(period / step));
    this.h = period / perPeriod;
    this.settle = Math.ceil(28 / Math.max(r.gamma, 1e-3) / step);
    this.n = 20 * perPeriod;
  }

  /** Steps left before the result. */
  get left(): number { return this.settle + this.n + 1 - this.k; }

  advance(steps: number): boolean {
    const { y, rk, f, h, w } = this;
    for (let i = 0; i < steps && !this.result; i++) {
      if (this.k < this.settle) {
        rk.step(f, this.t, y, h);
        this.t += h;
      } else {
        const j = this.k - this.settle;
        const wgt = j === 0 || j === this.n ? 0.5 : 1;
        this.c += wgt * y[0] * Math.cos(w * this.t);
        this.s += wgt * y[0] * Math.sin(w * this.t);
        if (j < this.n) {
          rk.step(f, this.t, y, h);
          this.t += h;
        } else {
          const c = (2 / this.n) * this.c;
          const s = (2 / this.n) * this.s;
          const a = Math.hypot(c, s);
          const phase = Math.atan2(s, c);
          this.result = { re: a * Math.cos(phase), im: a * Math.sin(phase) };
        }
      }
      this.k++;
    }
    return this.result !== null;
  }
}

/** The lock-in run to its end. */
export function measuredResponse(r: Resonance, w: number): Complex {
  const l = new LockIn(r, w);
  l.advance(Infinity);
  return l.result!;
}

/** χ measured at ω: every resonance's electrons driven and locked in, summed, corrected if dense. */
export function measuredChi(m: Medium, w: number): Complex {
  let re = 0;
  let im = 0;
  for (const r of m.resonances) {
    const x = measuredResponse(r, w);
    re += r.f * m.wp2 * x.re;
    im += r.f * m.wp2 * x.im;
  }
  return m.dense ? localField({ re, im }) : { re, im };
}

/** n + iκ = √(1 + χ), the root with κ ≥ 0 (a wave that decays as it travels). */
export function index(chi: Complex): Complex {
  const a = 1 + chi.re;
  const b = chi.im;
  const mod = Math.hypot(a, b);
  const re = Math.sqrt(Math.max(0, (mod + a) / 2));
  const im = Math.sqrt(Math.max(0, (mod - a) / 2));
  return { re, im: b >= 0 ? im : -im };
}

/**
 * Re χ from Im χ by Kramers–Kronig: Im χ, sampled at ω_k = kΔ for k = 0 … K − 1 (K a power of two),
 * is extended to an odd function on [−KΔ, KΔ) and Hilbert transformed by the FFT method of
 * hilbert-analytic (the analytic signal of the sequence). Causality makes Re χ = −H{Im χ}. Returns
 * Re χ at the same ω_k. The tail beyond KΔ and the grid's resolution of the peak are its errors.
 */
export function kramersKronig(im: Float64Array): Float64Array {
  const K = im.length;
  const seq = new Float64Array(2 * K);
  // index j ↔ ω = (j − K)Δ: odd, so the point at −KΔ (j = 0) is the wrap of +KΔ, taken as zero
  for (let k = 1; k < K; k++) {
    seq[K + k] = im[k];
    seq[K - k] = -im[k];
  }
  const [, h] = analytic(seq);
  const out = new Float64Array(K);
  for (let k = 0; k < K; k++) out[k] = -h[K + k];
  return out;
}

/** ∫₀^Ω ω Im χ dω by the trapezoid rule on a uniform grid, plus the 1/ω³ tail beyond Ω: Ω² Im χ(Ω). */
export function fSum(ws: ArrayLike<number>, im: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k + 1 < ws.length; k++) s += 0.5 * (ws[k + 1] - ws[k]) * (ws[k] * im[k] + ws[k + 1] * im[k + 1]);
  const W = ws[ws.length - 1];
  return s + W * W * im[im.length - 1];
}

/** The least-squares slope of ln y against ln x. */
export function logSlope(xs: number[], ys: number[]): number {
  const lx = xs.map(Math.log);
  const ly = ys.map(Math.log);
  const mx = lx.reduce((a, b) => a + b, 0) / lx.length;
  const my = ly.reduce((a, b) => a + b, 0) / ly.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < lx.length; i++) {
    num += (lx[i] - mx) * (ly[i] - my);
    den += (lx[i] - mx) ** 2;
  }
  return num / den;
}
