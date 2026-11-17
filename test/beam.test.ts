// The bar chain (src/plates/_shared/elastic/chain.ts) and the continuous beam's oracles
// (elastica.ts) beyond the entry's claims: the chain's small deflection against its own midpoint
// sum, its measured order 2 against FL³/3EI and Euler's load as the cells are halved, the
// tridiagonal Hessian against finite differences of the energy, the elliptic integrals against
// Legendre's values, the shooting's order 4, and a straight column under Euler's load.
import { describe, expect, it } from 'vitest';
import {
  bucklingLoad, carried, chain, gradient, hessian, minimise, positions, potential,
} from '../src/plates/_shared/elastic/chain';
import { ellipticKE, elasticaTip, eulerLoad, postBuckled, tipLinear } from '../src/plates/_shared/elastic/elastica';

/** The chain of n cells under a downward tip force F, relaxed; the tip's fall. */
function tipFall(n: number, F: number): number {
  const c = chain(n);
  const fy = new Float64Array(n + 2);
  fy[n + 1] = -F;
  const { gx, gy } = carried(c, new Float64Array(n + 2), fy);
  const th = new Float64Array(n + 1);
  minimise(c, th, gx, gy);
  return -positions(c, th).y[n + 1];
}

describe('beam: the bar chain', () => {
  it('falls by its own midpoint sum Σ F(L − s_j)²Δs/EI under a light tip load', () => {
    for (const n of [8, 40]) {
      const ds = 1 / n;
      let sum = 0;
      for (let j = 1; j <= n; j++) sum += (1 - (j - 0.5) * ds) ** 2 * ds;
      const F = 1e-6;
      expect(tipFall(n, F) / (F * sum)).toBeCloseTo(1, 9);
    }
  });

  it('approaches FL³/3EI and Euler’s load at order 2 as the cells are halved', () => {
    const F = 1e-6;
    const e = (n: number) => Math.abs(tipFall(n, F) - tipLinear(F));
    expect(Math.abs(Math.log2(e(20) / e(40)) - 2)).toBeLessThan(0.2);
    const b = (n: number) => Math.abs(bucklingLoad(chain(n)) - eulerLoad());
    expect(Math.abs(Math.log2(b(20) / b(40)) - 2)).toBeLessThan(0.2);
    // from below: the chain is softer than the beam
    expect(bucklingLoad(chain(40))).toBeLessThan(eulerLoad());
  });

  it('has the gradient and tridiagonal Hessian of its energy, by central differences', () => {
    const n = 12;
    const c = chain(n);
    const fx = new Float64Array(n + 2).map((_, i) => (i > 0 ? 0.3 * Math.sin(i) : 0));
    const fy = new Float64Array(n + 2).map((_, i) => (i > 0 ? -0.5 * Math.cos(2 * i) : 0));
    const { gx, gy } = carried(c, fx, fy);
    const th = new Float64Array(n + 1).map((_, i) => (i > 0 ? 0.4 * Math.sin(0.7 * i) : 0));
    const g = new Float64Array(n + 1);
    const d = new Float64Array(n + 1);
    gradient(c, th, gx, gy, g);
    hessian(c, th, gx, gy, d);
    const h = 1e-5;
    for (let i = 1; i <= n; i++) {
      const up = Float64Array.from(th);
      const dn = Float64Array.from(th);
      up[i] += h;
      dn[i] -= h;
      expect((potential(c, up, gx, gy) - potential(c, dn, gx, gy)) / (2 * h)).toBeCloseTo(g[i], 7);
      const gu = new Float64Array(n + 1);
      const gd = new Float64Array(n + 1);
      gradient(c, up, gx, gy, gu);
      gradient(c, dn, gx, gy, gd);
      for (let j = 1; j <= n; j++) {
        const fd = (gu[j] - gd[j]) / (2 * h);
        const want = j === i ? d[i] : Math.abs(j - i) === 1 ? -c.kappa : 0;
        expect(Math.abs(fd - want)).toBeLessThan(1e-4 * c.kappa);
      }
    }
  });

  it('leaves a straight column straight, even past Euler’s load, until it is nudged', () => {
    const n = 40;
    const c = chain(n);
    const fx = new Float64Array(n + 2);
    fx[n + 1] = -1.5 * eulerLoad();
    const { gx, gy } = carried(c, fx, new Float64Array(n + 2));
    const th = new Float64Array(n + 1);
    const r = minimise(c, th, gx, gy);
    expect(r.iterations).toBe(0);
    expect(th.every((v) => v === 0)).toBe(true);
    // nudged, it falls to the post-buckled elastica
    th[n] = 1e-6;
    minimise(c, th, gx, gy);
    expect(Math.abs(Math.abs(positions(c, th).y[n + 1]) - postBuckled(1.5 * eulerLoad())!.side)).toBeLessThan(3e-4);
  });
});

describe('beam: the continuous beam', () => {
  it('has Legendre’s complete elliptic integrals at k = 1/√2', () => {
    const { K, E } = ellipticKE(Math.SQRT1_2);
    expect(K).toBeCloseTo(1.854074677301372, 13);
    expect(E).toBeCloseTo(1.350643881047675, 13);
    // and K(0) = E(0) = π/2
    expect(ellipticKE(0).K).toBeCloseTo(Math.PI / 2, 14);
  });

  it('shoots the elastica at order 4, and meets FL³/3EI under a light load', () => {
    expect(-elasticaTip(-1e-6).y).toBeCloseTo(tipLinear(1e-6), 15);
    const ref = elasticaTip(-3, 1, 1, 6400, 20).y;
    const e1 = Math.abs(elasticaTip(-3, 1, 1, 50, 20).y - ref);
    const e2 = Math.abs(elasticaTip(-3, 1, 1, 100, 20).y - ref);
    expect(Math.abs(Math.log2(e1 / e2) - 4)).toBeLessThan(0.3);
  });

  it('has no post-buckled shape below Euler’s load, and a small one just above it', () => {
    expect(postBuckled(0.99 * eulerLoad())).toBeNull();
    // just above, the bend grows as √(P/P_E − 1): 2k/λ with k ≈ √(2(P/P_E − 1))
    const d = 1e-4;
    const pb = postBuckled((1 + d) * eulerLoad())!;
    expect(pb.side / ((2 * Math.sqrt(2 * d)) / (Math.PI / 2))).toBeCloseTo(1, 3);
  });
});
