// What the triangular spring lattice should do, computed without relaxing or stepping it: the
// continuum's elastic constants as a sum over the bond directions of one site (the Cauchy-Born
// rule), and the lattice's exact dispersion from its dynamical matrix. The relaxation and the time
// integration in lattice.ts never read these.

/** The bond directions of one site, each counted once (the other three are their opposites). */
export function bondDirections(): [number, number][] {
  return [0, 1, 2].map((m) => [Math.cos((m * Math.PI) / 3), Math.sin((m * Math.PI) / 3)]);
}

export interface Moduli {
  /** C₁₁₁₁, C₁₁₂₂, C₂₂₂₂, C₁₂₁₂ per unit area */
  c11: number;
  c12: number;
  c22: number;
  c66: number;
  /** mass per unit area */
  rho: number;
}

/**
 * C_ijkl = (k a²/A) Σ n_i n_j n_k n_l over one site's bonds, A = (√3/2) a² the area of a site:
 * the energy of an affine strain, ½k Σ (n·ε·n)², per area.
 */
export function moduli(k: number): Moduli {
  const A = Math.sqrt(3) / 2;
  let c11 = 0;
  let c12 = 0;
  let c22 = 0;
  for (const [x, y] of bondDirections()) {
    c11 += x ** 4;
    c12 += x * x * y * y;
    c22 += y ** 4;
  }
  return { c11: (k * c11) / A, c12: (k * c12) / A, c22: (k * c22) / A, c66: (k * c12) / A, rho: 1 / A };
}

/** Lamé's λ = C₁₁₂₂ and μ = C₁₂₁₂ of the bond sum. */
export function lame(k: number): { lambda: number; mu: number } {
  const m = moduli(k);
  return { lambda: m.c12, mu: m.c66 };
}

/** Poisson's ratio in the plane, under a stress along x: λ/(λ + 2μ). */
export function poisson(k: number): number {
  const { lambda, mu } = lame(k);
  return lambda / (lambda + 2 * mu);
}

/** Young's modulus in the plane: 4μ(λ + μ)/(λ + 2μ). */
export function young(k: number): number {
  const { lambda, mu } = lame(k);
  return (4 * mu * (lambda + mu)) / (lambda + 2 * mu);
}

/** The continuum's wave speeds √((λ + 2μ)/ρ) and √(μ/ρ). */
export function speeds(k: number): { cL: number; cT: number } {
  const m = moduli(k);
  const { lambda, mu } = lame(k);
  return { cL: Math.sqrt((lambda + 2 * mu) / m.rho), cT: Math.sqrt(mu / m.rho) };
}

/**
 * The exact angular frequencies of a plane wave of wavenumber q along x on the lattice: the
 * eigenvalues of D(q) = (k/m) Σ 2(1 − cos(q·b)) n nᵀ over one site's bonds. Along a bond direction
 * D is diagonal, so the waves are purely longitudinal (x) and purely transverse (y); off is the
 * off-diagonal element, zero to round-off.
 */
export function dispersion(k: number, q: number): { wL: number; wT: number; off: number } {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const [x, y] of bondDirections()) {
    const w = 2 * k * (1 - Math.cos(q * x));
    xx += w * x * x;
    yy += w * y * y;
    xy += w * x * y;
  }
  return { wL: Math.sqrt(xx), wT: Math.sqrt(yy), off: xy };
}
