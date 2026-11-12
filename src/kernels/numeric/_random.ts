// Shared measurements of a stream of uniform numbers in [0, 1).

/** Pearson χ² of counts in `bins` equal bins against the uniform expectation. */
export function chiSquare(u: ArrayLike<number>, bins = 16): number {
  const c = new Array<number>(bins).fill(0);
  for (let i = 0; i < u.length; i++) c[Math.min(bins - 1, Math.floor(u[i] * bins))]++;
  const e = u.length / bins;
  return c.reduce((s, v) => s + (v - e) ** 2 / e, 0);
}

/** Lag-one serial correlation of the stream. */
export function serialCorrelation(u: ArrayLike<number>): number {
  const n = u.length - 1;
  if (n < 2) return NaN;
  let mx = 0; let my = 0;
  for (let i = 0; i < n; i++) { mx += u[i]; my += u[i + 1]; }
  mx /= n; my /= n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    const a = u[i] - mx; const b = u[i + 1] - my;
    sxy += a * b; sxx += a * a; syy += b * b;
  }
  return sxy / Math.sqrt(sxx * syy);
}
