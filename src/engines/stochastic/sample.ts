// Distributions built on the engine's counted uniform draws, and the few closed forms the
// kernels read (normal density and distribution function, quantiles of a sample).

export class Sampler {
  private spare: number | null = null;
  constructor(private readonly u: () => number) {}

  uniform(a = 0, b = 1): number { return a + (b - a) * this.u(); }

  /** 0 .. n-1. */
  int(n: number): number { return Math.min(n - 1, Math.floor(this.u() * n)); }

  bernoulli(p: number): boolean { return this.u() < p; }

  /** Standard normal by the Box–Muller transform, the second value of each pair kept. */
  normal(mu = 0, sd = 1): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sd * z;
    }
    const r = Math.sqrt(-2 * Math.log(1 - this.u()));
    const t = 2 * Math.PI * this.u();
    this.spare = r * Math.sin(t);
    return mu + sd * r * Math.cos(t);
  }

  exponential(rate = 1): number { return -Math.log(1 - this.u()) / rate; }

  lognormal(mu: number, sigma: number): number { return Math.exp(this.normal(mu, sigma)); }

  /** Gamma(k, 1) by Marsaglia and Tsang's squeeze; k < 1 through the k + 1 boost. */
  gamma(k: number): number {
    if (k < 1) return this.gamma(k + 1) * Math.pow(1 - this.u(), 1 / k);
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const w = 1 - this.u();
      if (w < 1 - 0.0331 * x ** 4) return d * v;
      if (Math.log(w) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  beta(a: number, b: number): number {
    const x = this.gamma(a);
    return x / (x + this.gamma(b));
  }

  /** Student's t with nu degrees of freedom: a normal over the root of a scaled chi-square. */
  studentT(nu: number): number { return this.normal() / Math.sqrt((2 * this.gamma(nu / 2)) / nu); }
}

export function normalPdf(x: number, mu = 0, sd = 1): number {
  const z = (x - mu) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/** Normal distribution function through erf (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
export function normalCdf(x: number, mu = 0, sd = 1): number {
  const z = (x - mu) / (sd * Math.SQRT2);
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t
    + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + (z >= 0 ? y : -y));
}

/** The empirical q-quantile of an ascending sample: the smallest x with F_n(x) >= q. */
export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  return sorted[Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1))];
}

export function mean(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : NaN;
}

/** Unbiased sample variance. */
export function variance(xs: ArrayLike<number>): number {
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - m) ** 2;
  return xs.length > 1 ? s / (xs.length - 1) : NaN;
}

export function ascending(xs: ArrayLike<number>): Float64Array {
  return Float64Array.from(xs).sort();
}

/** A number for a readout: fixed digits, thousands separated. */
export function fmt(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** An estimate with its standard error. */
export function pm(x: number, se: number, digits = 3): string {
  return `${fmt(x, digits)} ± ${fmt(se, digits)}`;
}

export function pct(x: number, digits = 1): string { return `${fmt(100 * x, digits)}%`; }
