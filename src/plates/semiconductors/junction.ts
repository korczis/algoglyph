// A p-n junction in thermal equilibrium: the Poisson–Boltzmann equation solved on a grid, with zero
// field at both ends, so the potential drop across it is found rather than imposed. In units of
// kT/q for the potential, u, measured from the intrinsic level:
//   ε ψ'' = −ρ  →  u'' = (e^u − e^(−u) − C(x)) / L_i²,   L_i = √(ε kT / (q² n_i)),
// with electrons n = n_i e^u, holes p = n_i e^(−u), and the net doping C = (N_D − N_A)/n_i, fully
// ionised. Lengths are in cm, densities in cm⁻³, as semiconductor tables give them.

/** Boltzmann's constant in eV/K, the elementary charge in C, the vacuum permittivity in F/cm. */
export const K_EV = 8.617333262e-5;
export const Q = 1.602176634e-19;
export const EPS0 = 8.8541878128e-14;

export interface Material {
  id: string;
  label: string;
  /** Band gap in eV, held at its 300 K value. */
  gap: number;
  /** Effective densities of states of the conduction and valence bands at 300 K, cm⁻³. */
  nc: number;
  nv: number;
  /** Relative permittivity. */
  eps: number;
}

export const MATERIALS: Material[] = [
  { id: 'si', label: 'Silicon', gap: 1.12, nc: 2.8e19, nv: 1.04e19, eps: 11.7 },
  { id: 'ge', label: 'Germanium', gap: 0.66, nc: 1.04e19, nv: 6.0e18, eps: 16.0 },
  { id: 'gaas', label: 'Gallium arsenide', gap: 1.424, nc: 4.7e17, nv: 7.0e18, eps: 12.9 },
];

export const material = (id: string): Material => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

/** The intrinsic density √(N_c N_v) e^(−E_g/2kT), N_c and N_v scaled as T^(3/2). */
export function intrinsic(m: Material, T: number): number {
  const s = (T / 300) ** 1.5;
  return Math.sqrt(m.nc * s * m.nv * s) * Math.exp(-m.gap / (2 * K_EV * T));
}

export interface Junction {
  /** Node positions (cm), the potential u at each, and the doping C at each. */
  x: Float64Array;
  u: Float64Array;
  c: Float64Array;
  /** The neutral potentials far into the p and n sides, from neutrality alone: ∓asinh(C/2). */
  up: number;
  un: number;
  /** Newton iterations taken, and the largest update of the last. */
  iterations: number;
  update: number;
  /** L_i², the intrinsic Debye length squared (cm²). */
  li2: number;
}

/**
 * Solve on `nodes` nodes over [−left, right] (cm), the junction at x = 0 on a node, whose doping is
 * the mean of its two sides (the cell around it is half p, half n). Zero field at both ends: the
 * mirror condition u[−1] = u[1]. Newton's method on the tridiagonal system, each update limited to
 * one kT/q, from the step between the two neutral levels.
 */
export function solve(na: number, nd: number, ni: number, m: Material, T: number,
  left: number, right: number, nodes: number): Junction {
  const kT = K_EV * T;
  const li2 = (m.eps * EPS0 * kT) / (Q * ni);
  const h = (left + right) / (nodes - 1);
  const x = new Float64Array(nodes);
  const c = new Float64Array(nodes);
  const u = new Float64Array(nodes);
  const up = -Math.asinh(na / (2 * ni));
  const un = Math.asinh(nd / (2 * ni));
  const j0 = Math.round(left / h);
  for (let i = 0; i < nodes; i++) {
    x[i] = (i - j0) * h;
    c[i] = i < j0 ? -na / ni : i > j0 ? nd / ni : (nd - na) / (2 * ni);
    u[i] = i < j0 ? up : i > j0 ? un : (up + un) / 2;
  }
  const k = (h * h) / li2;
  const sub = new Float64Array(nodes);
  const dia = new Float64Array(nodes);
  const sup = new Float64Array(nodes);
  const rhs = new Float64Array(nodes);
  let iterations = 0;
  let update = Infinity;
  while (iterations < 200 && update > 1e-12) {
    iterations++;
    for (let i = 0; i < nodes; i++) {
      const lo = i === 0 ? u[1] : u[i - 1];
      const hi = i === nodes - 1 ? u[nodes - 2] : u[i + 1];
      const ep = Math.exp(u[i]);
      const em = 1 / ep;
      // F_i = u[i−1] − 2u[i] + u[i+1] − k(e^u − e^(−u) − C), and its derivatives
      rhs[i] = -(lo - 2 * u[i] + hi - k * (ep - em - c[i]));
      dia[i] = -2 - k * (ep + em);
      sub[i] = i === 0 ? 0 : i === nodes - 1 ? 2 : 1;
      sup[i] = i === nodes - 1 ? 0 : i === 0 ? 2 : 1;
    }
    // the Thomas algorithm, forward then back
    for (let i = 1; i < nodes; i++) {
      const w = sub[i] / dia[i - 1];
      dia[i] -= w * sup[i - 1];
      rhs[i] -= w * rhs[i - 1];
    }
    rhs[nodes - 1] /= dia[nodes - 1];
    for (let i = nodes - 2; i >= 0; i--) rhs[i] = (rhs[i] - sup[i] * rhs[i + 1]) / dia[i];
    update = 0;
    for (let i = 0; i < nodes; i++) {
      const d = Math.max(-1, Math.min(1, rhs[i]));
      u[i] += d;
      update = Math.max(update, Math.abs(d));
    }
  }
  return { x, u, c, up, un, iterations, update, li2 };
}

/**
 * The field at the junction from the first integral of Poisson–Boltzmann, never from the grid:
 * multiplying u'' = (e^u − e^(−u) − C)/L_i² by u' and integrating from the neutral n side gives
 * L_i²·u'² = 2(2cosh u − 2cosh u_n − C_D(u − u_n)), and from the p side the same with C_A and u_p.
 * The field is continuous at x = 0, which fixes u there:
 * u₀ = (2cosh u_p − 2cosh u_n + C_D u_n + C_A u_p)/(C_A + C_D).
 * Returns u₀ and the field E₀ = (kT/q)|u'(0)| in V/cm.
 */
export function firstIntegral(na: number, nd: number, ni: number, m: Material, T: number): { u0: number; field: number } {
  const ca = na / ni;
  const cd = nd / ni;
  const up = -Math.asinh(ca / 2);
  const un = Math.asinh(cd / 2);
  const u0 = (2 * Math.cosh(up) - 2 * Math.cosh(un) + cd * un + ca * up) / (ca + cd);
  const kT = K_EV * T;
  const li2 = (m.eps * EPS0 * kT) / (Q * ni);
  const s = 2 * (2 * Math.cosh(u0) - 2 * Math.cosh(un) - cd * (u0 - un));
  return { u0, field: kT * Math.sqrt(Math.max(0, s) / li2) };
}

/** The depletion approximation's width √(2εV(N_A + N_D)/(q N_A N_D)), for comparison only. */
export function depletionWidth(na: number, nd: number, v: number, m: Material): number {
  return Math.sqrt((2 * m.eps * EPS0 * v * (na + nd)) / (Q * na * nd));
}
