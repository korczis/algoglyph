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
