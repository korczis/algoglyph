// The numerics readouts that claims read (ADR 0007), each checked here against an oracle computed
// independently of the plate: the plate runs headless through the claims instrument until it
// settles, and the readout's first number is compared with the oracle's value.
import { describe, expect, it } from 'vitest';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

/** The settled first number of `readout` on plate `id` with `params`, or a failed expectation. */
async function reading(id: string, readout: string, params: Record<string, unknown> = {}, seed?: number) {
  const c: Claim = {
    id: 'probe', statement: 'a probe of a numerics readout', readout, expect: { above: -Infinity },
    setup: { params: params as never, ...(seed === undefined ? {} : { seed }) },
  };
  const r = await read(id, c);
  expect(r.reason, `${id}: ${readout}`).toBeUndefined();
  return { value: r.value as number, text: r.text as string };
}

describe('horner-evaluation publishes its additions', () => {
  // Horner's rule b_k = b_{k+1}·x + a_k: one addition per coefficient below the leading one
  const hornerAdds = (d: number) => {
    let adds = 0;
    for (let k = d - 1; k >= 0; k--) adds++;
    return adds;
  };
  for (const d of [2, 9, 16]) {
    it(`counts ${d} additions for one evaluation at degree ${d}`, async () => {
      const r = await reading('horner-evaluation', 'Additions this evaluation', { degree: d });
      expect(r.value).toBe(hornerAdds(d));
    }, 120_000);
  }
});

describe('pca-svd publishes the rank-2 reconstruction error', () => {
  /** Eigenvalues of a symmetric matrix by the classical two-sided Jacobi method, descending. */
  function eigenvalues(S: number[][]): number[] {
    const A = S.map((r) => r.slice());
    const n = A.length;
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
      if (off < 1e-30) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (A[p][q] === 0) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p]; const akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k]; const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
      }
    }
    return A.map((r, i) => r[i]).sort((a, b) => b - a);
  }

  for (const [dims, points] of [[4, 260], [6, 600], [3, 50]]) {
    it(`matches the discarded eigenvalues of XᵀX at ${dims} dimensions, ${points} points`, async () => {
      const { cloud } = await import('../src/kernels/numeric/pca-svd');
      const { X } = cloud(4242, dims, points);
      // the Gram matrix XᵀX, whose eigenvalues are the squared singular values of X
      const G = Array.from({ length: dims }, (_, i) => Array.from({ length: dims }, (_, j) =>
        X.reduce((s, r) => s + r[i] * r[j], 0)));
      const discarded = eigenvalues(G).slice(2).reduce((s, v) => s + v, 0);
      const r = await reading('pca-svd', 'Rank-2 reconstruction error ‖X − X₂‖²', { dims, points });
      // seven significant digits on display
      const half = 0.5 * 10 ** (Math.floor(Math.log10(discarded)) - 6);
      expect(Math.abs(r.value - discarded), `${r.text} against ${discarded}`).toBeLessThanOrEqual(half);
    }, 120_000);
  }
});

describe('simpson-quadrature: a cubic integrand and Simpson’s error on its own', () => {
  const u = 2 ** -53;
  /** Composite Simpson with Neumaier's compensated sum: rounding near u·|result|. */
  function simpsonCompensated(f: (x: number) => number, a: number, b: number, n: number): number {
    let s = 0; let c = 0;
    const add = (v: number) => { const t = s + v; c += Math.abs(s) >= Math.abs(v) ? (s - t) + v : (v - t) + s; s = t; };
    for (let i = 0; i <= n; i++) add((i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f(a + ((b - a) * i) / n));
    return ((s + c) * (b - a)) / (3 * n);
  }

  it('is exact on a cubic to the rounding of a sum of n + 1 terms', async () => {
    const panels = (await reading('simpson-quadrature', 'Panels n', { integrand: 'cubic' })).value;
    const r = await reading('simpson-quadrature', 'Simpson error', { integrand: 'cubic' });
    // x³ − 3x² + 2x + 1 stays positive on [0, 3], so ∫|f| = ∫f = 81/4 − 27 + 9 + 3
    const absIntegral = 81 / 4 - 27 + 9 + 3;
    expect(r.value).toBeLessThanOrEqual((panels + 1) * u * absIntegral);
  }, 120_000);

  it('on sine matches the h⁴ estimate and an independent compensated sum', async () => {
    const n = (await reading('simpson-quadrature', 'Panels n', { integrand: 'sine' })).value;
    const r = await reading('simpson-quadrature', 'Simpson error', { integrand: 'sine' });
    const h = Math.PI / n;
    // Euler–Maclaurin: E ≈ h⁴ (f‴(b) − f‴(a)) / 180, and f‴ = −cos, so h⁴ · 2 / 180
    const estimate = (h ** 4 * 2) / 180;
    const independent = simpsonCompensated(Math.sin, 0, Math.PI, n) - 2;
    const bound = (n + 1) * u * 2;
    expect(Math.abs(r.value - independent), `${r.text} against ${independent}`).toBeLessThanOrEqual(bound);
    expect(Math.abs(r.value - estimate), `${r.text} against ${estimate}`).toBeLessThanOrEqual(bound);
    // the compensated sum leaves only the rule's own error: the estimate holds to its h⁶ term
    expect(Math.abs(independent - estimate) / estimate).toBeLessThan(1e-3);
  }, 120_000);
});

describe('cubic-splines publishes its measured convergence order', () => {
  /** The natural spline's knot curvatures by dense Gaussian elimination with partial pivoting. */
  function naturalCurvatures(xs: number[], ys: number[]): number[] {
    const n = xs.length;
    const A = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
    A[0][0] = 1; A[n - 1][n - 1] = 1;
    for (let i = 1; i < n - 1; i++) {
      const h0 = xs[i] - xs[i - 1]; const h1 = xs[i + 1] - xs[i];
      A[i][i - 1] = h0 / 6; A[i][i] = (h0 + h1) / 3; A[i][i + 1] = h1 / 6;
      A[i][n] = (ys[i + 1] - ys[i]) / h1 - (ys[i] - ys[i - 1]) / h0;
    }
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = c + 1; r < n; r++) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
      }
    }
    const m = new Array<number>(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = A[r][n];
      for (let k = r + 1; k < n; k++) s -= A[r][k] * m[k];
      m[r] = s / A[r][r];
    }
    return m;
  }
  /** Max |f − s| on the 801-point grid of [−1, 1], for n equally spaced knots. */
  function maxError(f: (x: number) => number, n: number): number {
    const xs = Array.from({ length: n }, (_, i) => -1 + (2 * i) / (n - 1));
    const ys = xs.map(f);
    const m = naturalCurvatures(xs, ys);
    let e = 0;
    for (let g = 0; g <= 800; g++) {
      const x = -1 + g / 400;
      const i = Math.min(n - 2, Math.max(0, Math.floor((x + 1) / (2 / (n - 1)))));
      const h = xs[i + 1] - xs[i];
      const A = (xs[i + 1] - x) / h; const B = (x - xs[i]) / h;
      const s = A * ys[i] + B * ys[i + 1] + ((A ** 3 - A) * m[i] + (B ** 3 - B) * m[i + 1]) * h * h / 6;
      e = Math.max(e, Math.abs(s - f(x)));
    }
    return e;
  }
  /** Least-squares slope of log error against log h over n = 13…25, the last halving of h. */
  function order(f: (x: number) => number): number {
    const pts = Array.from({ length: 13 }, (_, k) => 13 + k).map((n) => [Math.log(2 / (n - 1)), Math.log(maxError(f, n))]);
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  }
  const targets: Record<string, (x: number) => number> = {
    sine: (x) => Math.sin(3 * x), runge: (x) => 1 / (1 + 25 * x * x),
  };
  for (const [key, f] of Object.entries(targets)) {
    it(`matches an independent dense-solve fit on ${key}`, async () => {
      const r = await reading('cubic-splines', 'Measured order, last halving of h', { target: key });
      // four significant digits on display
      expect(Math.abs(r.value - order(f)), `${r.text} against ${order(f)}`).toBeLessThanOrEqual(5e-4);
    }, 120_000);
  }
});
