// The tridiagonal eigensolver (src/plates/_shared/quantum/eigen.ts) against what it does not
// compute: the discrete Laplacian's eigenvalues (1 − cos kπ/(N + 1))/h² in closed form, the
// oscillator's n + ½, hydrogen's −1/2n², the finite well's levels by the transcendental equations,
// and Sturm's node count.
import { describe, expect, it } from 'vitest';
import { eigenvalues, eigenvector, finiteWellLevels, grid, nodes } from '../src/plates/_shared/quantum/eigen';

describe('bound-states', () => {
  it('finds the discrete box’s eigenvalues exactly', () => {
    const N = 200; const h = 0.05;
    const V = new Float64Array(N);
    const lam = eigenvalues(V, h, 6);
    lam.forEach((l, i) => expect(l).toBeCloseTo((1 - Math.cos(((i + 1) * Math.PI) / (N + 1))) / (h * h), 9));
  });

  it('inverse iteration gives a normalised eigenvector with k − 1 nodes and a small residual', () => {
    const { x, h } = grid(-8, 8, 800);
    const V = Float64Array.from(x, (s) => 0.5 * s * s);
    const lam = eigenvalues(V, h, 5);
    lam.forEach((l, k) => {
      const v = eigenvector(V, h, l);
      let norm = 0; let res = 0;
      for (let i = 0; i < v.length; i++) {
        norm += v[i] * v[i] * h;
        const hv = (1 / (h * h) + V[i]) * v[i] - (0.5 / (h * h)) * ((v[i - 1] ?? 0) + (v[i + 1] ?? 0));
        res = Math.max(res, Math.abs(hv - l * v[i]));
      }
      expect(norm).toBeCloseTo(1, 10);
      expect(res).toBeLessThan(1e-7);
      expect(nodes(v)).toBe(k);
    });
  });

  it('the harmonic oscillator’s levels are n + ½ to the grid’s h²', () => {
    const { x, h } = grid(-10, 10, 2000);
    const lam = eigenvalues(Float64Array.from(x, (s) => 0.5 * s * s), h, 4);
    lam.forEach((l, n) => expect(Math.abs(l - (n + 0.5))).toBeLessThan(2e-4));
  });

  it('hydrogen’s s levels are −1/2n²', () => {
    const { x: r, h } = grid(0, 80, 8000);
    const lam = eigenvalues(Float64Array.from(r, (s) => -1 / s), h, 3);
    lam.forEach((l, i) => expect(Math.abs(l + 1 / (2 * (i + 1) ** 2))).toBeLessThan(3e-4));
  });

  it('the finite well’s transcendental levels meet the grid’s', () => {
    const v0 = 10; const a = 1;
    const roots = finiteWellLevels(v0, a);
    expect(roots.length).toBeGreaterThan(2);
    const { x, h } = grid(-6, 6, 4000);
    const lam = eigenvalues(Float64Array.from(x, (s) => (Math.abs(s) < a ? 0 : v0)), h, roots.length);
    // a step in V is resolved to first order in h, so the tolerance is h, not h²
    lam.forEach((l, i) => expect(Math.abs(l - roots[i])).toBeLessThan(5 * h));
  });
});
