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

/** A sample kept in ascending order as it grows: each batch is sorted on its own and merged
 * in, so a quantile is an index lookup and growing by k costs O(n + k log k), not a re-sort. */
export class SortedSample {
  private a = new Float64Array(0);
  get length(): number { return this.a.length; }
  get values(): Float64Array { return this.a; }
  add(batch: ArrayLike<number>): void {
    if (!batch.length) return;
    const b = Float64Array.from(batch).sort();
    const a = this.a;
    const out = new Float64Array(a.length + b.length);
    let i = 0;
    let j = 0;
    let k = 0;
    while (i < a.length && j < b.length) out[k++] = a[i] <= b[j] ? a[i++] : b[j++];
    while (i < a.length) out[k++] = a[i++];
    while (j < b.length) out[k++] = b[j++];
    this.a = out;
  }
  quantile(q: number): number { return quantile(this.a, q); }
}

/** Indices of keys in descending order of key, by a bottom-up merge sort that yields every so
 * many element moves, so a large sort is spread over frames. */
export function* sortDescending(keys: ArrayLike<number>, movesPerYield = 30000): Generator<void, Int32Array, void> {
  const n = keys.length;
  let src = new Int32Array(n);
  for (let i = 0; i < n; i++) src[i] = i;
  let dst = new Int32Array(n);
  let moves = 0;
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo;
      let j = mid;
      let k = lo;
      while (i < mid && j < hi) dst[k++] = keys[src[j]] > keys[src[i]] ? src[j++] : src[i++];
      while (i < mid) dst[k++] = src[i++];
      while (j < hi) dst[k++] = src[j++];
      moves += hi - lo;
      if (moves >= movesPerYield) { moves = 0; yield; }
    }
    [src, dst] = [dst, src];
  }
  return src;
}

/** log Γ(z) for z > 0, by the Lanczos approximation (g = 7, nine coefficients). */
export function logGamma(z: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** The regularised incomplete beta function I_x(a, b): the Beta(a, b) distribution function,
 * by its continued fraction (modified Lentz), on whichever side converges. */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x > (a + 1) / (a + b + 2)) return 1 - betaCdf(1 - x, b, a);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - (logGamma(a) + logGamma(b) - logGamma(a + b))) / a;
  const tiny = 1e-300;
  let f = 1;
  let c = 1;
  let d = 0;
  for (let i = 0; i <= 400; i++) {
    const m = Math.floor(i / 2);
    let num: number;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    c = 1 + num / c;
    if (Math.abs(c) < tiny) c = tiny;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-14) break;
  }
  return front * (f - 1);
}
