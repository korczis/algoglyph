// Least-squares fits shared by the signal engine's readouts.

/** Slope and intercept of y on x by ordinary least squares. */
export function lineFit(xs: ArrayLike<number>, ys: ArrayLike<number>): { slope: number; intercept: number } {
  const n = Math.min(xs.length, ys.length);
  let mx = 0; let my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let sxy = 0; let sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxx ? sxy / sxx : NaN;
  return { slope, intercept: my - slope * mx };
}

/** The growth exponent: slope of log(work) against log(n). */
export function exponentOf(points: [number, number][]): number {
  const pts = points.filter(([n, w]) => n > 0 && w > 0);
  if (pts.length < 2) return NaN;
  return lineFit(pts.map((q) => Math.log(q[0])), pts.map((q) => Math.log(q[1]))).slope;
}
