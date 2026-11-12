// Small dense linear algebra for the numeric kernels: row-major matrices as number[][].
export type Mat = number[][];

export const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0));

export function matmul(a: Mat, b: Mat): Mat {
  const out = zeros(a.length, b[0]?.length ?? 0);
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      const v = a[i][k];
      for (let j = 0; j < b[0].length; j++) out[i][j] += v * b[k][j];
    }
  }
  return out;
}

export const transpose = (a: Mat): Mat => (a[0] ?? []).map((_, j) => a.map((row) => row[j]));

export const matvec = (a: Mat, x: number[]): number[] => a.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));

/**
 * Least squares by Householder QR: minimise |X b - y| over b. Returns b and the residual.
 * Each column is reflected onto the diagonal, so the normal equations are never formed.
 */
export function lstsq(X: Mat, y: number[]): { beta: number[]; residual: number[] } {
  const m = X.length; const n = X[0].length;
  const R = X.map((r) => r.slice());
  const q = y.slice();
  for (let k = 0; k < n; k++) {
    let norm = 0;
    for (let i = k; i < m; i++) norm += R[i][k] ** 2;
    norm = Math.sqrt(norm);
    if (norm === 0) continue;
    const alpha = R[k][k] > 0 ? -norm : norm;
    const v = new Array<number>(m).fill(0);
    for (let i = k; i < m; i++) v[i] = R[i][k];
    v[k] -= alpha;
    const vv = v.reduce((s, t) => s + t * t, 0);
    if (vv === 0) continue;
    for (let j = k; j < n; j++) {
      let s = 0;
      for (let i = k; i < m; i++) s += v[i] * R[i][j];
      const f = (2 * s) / vv;
      for (let i = k; i < m; i++) R[i][j] -= f * v[i];
    }
    let s = 0;
    for (let i = k; i < m; i++) s += v[i] * q[i];
    const f = (2 * s) / vv;
    for (let i = k; i < m; i++) q[i] -= f * v[i];
  }
  const beta = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = q[i];
    for (let j = i + 1; j < n; j++) s -= R[i][j] * beta[j];
    beta[i] = R[i][i] ? s / R[i][i] : 0;
  }
  const fit = matvec(X, beta);
  return { beta, residual: y.map((v, i) => v - fit[i]) };
}

/** Rows [1, x, x², ..., x^d]. */
export const vandermonde = (xs: number[], d: number): Mat => xs.map((x) => Array.from({ length: d + 1 }, (_, j) => x ** j));

export const polyval = (beta: number[], x: number) => beta.reduceRight((s, c) => s * x + c, 0);
