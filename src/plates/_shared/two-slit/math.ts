// Special functions and statistics the two-slit models need, written here so each is checkable
// against published values (test/two-slit.test.ts) and none hides inside a plate.

/** sin(u)/u, 1 at u = 0. */
export function sinc(u: number): number {
  if (Math.abs(u) < 1e-8) return 1 - (u * u) / 6;
  return Math.sin(u) / u;
}

/**
 * The error function. Its Taylor series up to |x| = 4.5 (the alternating terms lose digits to
 * cancellation, leaving an error under 1e-9 at 4.5 and under 1e-12 below 3.5), the asymptotic
 * expansion of erfc above, cut at its smallest term (erfc(4.5) is 2e-10, so its error is far
 * smaller still).
 */
export function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 4.5) {
    let term = ax;
    let sum = ax;
    for (let n = 1; n < 160; n++) {
      term *= (-ax * ax) / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return Math.sign(x) * (2 / Math.sqrt(Math.PI)) * sum;
  }
  const x2 = ax * ax;
  let series = 1;
  let term = 1;
  for (let n = 1; n < 60; n++) {
    const next = (term * -(2 * n - 1)) / (2 * x2);
    if (Math.abs(next) >= Math.abs(term)) break;
    term = next;
    series += term;
  }
  const erfc = (Math.exp(-x2) / (ax * Math.sqrt(Math.PI))) * series;
  return Math.sign(x) * (1 - erfc);
}

/**
 * The Bessel function J₀. Its power series below |x| = 12 (largest term about 4·10³, so about
 * 1e-12 is left after cancellation), Hankel's asymptotic expansion above (error below 1e-8).
 */
export function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 12) {
    const q = (ax * ax) / 4;
    let term = 1;
    let sum = 1;
    for (let k = 1; k < 80; k++) {
      term *= -q / (k * k);
      sum += term;
      if (Math.abs(term) < 1e-18) break;
    }
    return sum;
  }
  // P and Q of Hankel's expansion for ν = 0, to the terms that matter above 12
  const z = 8 * ax;
  const z2 = z * z;
  const p = 1 - 9 / (2 * z2) + 3675 / (8 * z2 * z2);
  const qq = -1 / z + 75 / (2 * z2 * z) - 59535 / (8 * z2 * z2 * z);
  const chi = ax - Math.PI / 4;
  return Math.sqrt(2 / (Math.PI * ax)) * (p * Math.cos(chi) - qq * Math.sin(chi));
}

/** The 0.1 % and 99.9 % points of the standard normal distribution. */
export const Z_999 = 3.090232306167813;

/**
 * The p-quantile of χ²ₖ by the Wilson–Hilferty cube-root approximation, given z, the standard
 * normal quantile at p: k·(1 − 2/(9k) + z·√(2/(9k)))³. Within about 1 % of the exact quantile for
 * k ≥ 10 at the 0.1 % and 99.9 % points.
 */
export function chiSquareQuantile(k: number, z: number): number {
  const c = 2 / (9 * k);
  const base = 1 - c + z * Math.sqrt(c);
  return k * Math.max(0, base) ** 3;
}

/** The band of χ²ₖ/k between its 0.1 % and 99.9 % points: where a correct model's statistic falls
 * 998 times in 1000. */
export function chiSquareBand(k: number): [number, number] {
  return [chiSquareQuantile(k, -Z_999) / k, chiSquareQuantile(k, Z_999) / k];
}

/** The 95 % critical value of the Kolmogorov–Smirnov distance for n samples, 1.36/√n. */
export function ksBound(n: number): number {
  return 1.36 / Math.sqrt(n);
}

/**
 * Cumulative integral of f over [lo, hi] on n equal cells by Simpson's rule within each cell
 * (three points per cell): out[i] is ∫ from lo to lo + i·(hi − lo)/n. Normalised to end at 1 when
 * `normalise` is set.
 */
export function cumulative(f: (x: number) => number, lo: number, hi: number, n: number,
  normalise = true): Float64Array {
  const out = new Float64Array(n + 1);
  const h = (hi - lo) / n;
  let acc = 0;
  let fa = f(lo);
  for (let i = 0; i < n; i++) {
    const a = lo + i * h;
    const fb = f(a + h);
    acc += (h / 6) * (fa + 4 * f(a + h / 2) + fb);
    out[i + 1] = acc;
    fa = fb;
  }
  if (normalise && acc > 0) for (let i = 0; i <= n; i++) out[i] /= acc;
  return out;
}

/** ∫ f over [lo, hi] by composite Simpson on n cells. */
export function integrate(f: (x: number) => number, lo: number, hi: number, n: number): number {
  return cumulative(f, lo, hi, n, false)[n];
}

/** A table of a cumulative function on equal cells, read by linear interpolation. */
export function interpolate(table: Float64Array, lo: number, hi: number, x: number): number {
  const n = table.length - 1;
  const t = ((x - lo) / (hi - lo)) * n;
  if (t <= 0) return table[0];
  if (t >= n) return table[n];
  const i = Math.floor(t);
  return table[i] + (table[i + 1] - table[i]) * (t - i);
}

/**
 * The Kolmogorov–Smirnov distance between the empirical distribution of `xs` (sorted in place)
 * and the cumulative function `cdf`: the largest gap on either side of each step.
 */
export function ksDistance(xs: Float64Array, cdf: (x: number) => number): number {
  xs.sort();
  const n = xs.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const f = cdf(xs[i]);
    d = Math.max(d, f - i / n, (i + 1) / n - f);
  }
  return d;
}
