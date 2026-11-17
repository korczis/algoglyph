// What a continuous beam does, computed without the bar chain: the small-deflection closed forms of
// a cantilever, Euler's load of a column clamped at its base and free at its top, the post-buckled
// elastica in elliptic integrals, and the large deflection under a tip force by shooting on the
// elastica's own equation, EI θ'' = −(r'×F)_z, with RK4. Units: L = 1, EI = 1 unless given.

/** K(k) and E(k), the complete elliptic integrals of modulus k, by the arithmetic–geometric mean. */
export function ellipticKE(k: number): { K: number; E: number } {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  let c = k;
  let sum = 0.5 * c * c;
  let pow = 0.5;
  for (let i = 0; i < 40 && Math.abs(c) > 1e-17; i++) {
    const an = 0.5 * (a + b);
    c = 0.5 * (a - b);
    b = Math.sqrt(a * b);
    a = an;
    pow *= 2;
    sum += pow * c * c;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}

/** Tip deflection of a cantilever under a tip force F: FL³/3EI. */
export const tipLinear = (F: number, L = 1, EI = 1): number => (F * L ** 3) / (3 * EI);

/** Tip deflection of a cantilever under its own weight q a length: qL⁴/8EI. */
export const weightLinear = (q: number, L = 1, EI = 1): number => (q * L ** 4) / (8 * EI);

/** Euler's load of a column clamped at its base and free at its top: π²EI/(2L)². */
export const eulerLoad = (L = 1, EI = 1): number => (Math.PI ** 2 * EI) / (4 * L * L);

/**
 * The post-buckled column under P above Euler's load: with λ = √(P/EI), its tip angle α has
 * λL = K(sin(α/2)); the tip moves sideways by 2k/λ and its height is 2E(k)/λ − L.
 */
export function postBuckled(P: number, L = 1, EI = 1): { k: number; side: number; height: number } | null {
  const lam = Math.sqrt(P / EI);
  if (lam * L <= Math.PI / 2) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (ellipticKE(mid).K < lam * L) lo = mid; else hi = mid;
  }
  const k = 0.5 * (lo + hi);
  const { E } = ellipticKE(k);
  return { k, side: (2 * k) / lam, height: (2 * E) / lam - L };
}

/** One RK4 run of θ'' = (Fx sin θ − Fy cos θ)/EI from θ(0) = 0, θ'(0) = a; θ'(L) and the tip. */
function shoot(a: number, Fx: number, Fy: number, steps: number, L: number, EI: number) {
  const h = L / steps;
  let th = 0;
  let w = a;
  let x = 0;
  let y = 0;
  const f = (t: number) => (Fx * Math.sin(t) - Fy * Math.cos(t)) / EI;
  for (let i = 0; i < steps; i++) {
    const k1t = w;
    const k1w = f(th);
    const k2t = w + 0.5 * h * k1w;
    const k2w = f(th + 0.5 * h * k1t);
    const k3t = w + 0.5 * h * k2w;
    const k3w = f(th + 0.5 * h * k2t);
    const k4t = w + h * k3w;
    const k4w = f(th + h * k3t);
    const tn = th + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    const wn = w + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    // the position integrates cos θ and sin θ by Simpson, θ at mid-step by Hermite's cubic
    const tm = 0.5 * (th + tn) + (h * (w - wn)) / 8;
    x += (h / 6) * (Math.cos(th) + 4 * Math.cos(tm) + Math.cos(tn));
    y += (h / 6) * (Math.sin(th) + 4 * Math.sin(tm) + Math.sin(tn));
    th = tn;
    w = wn;
  }
  return { end: w, x, y };
}

export interface Elastica {
  x: number;
  y: number;
  /** θ'(0), the clamp's moment over EI */
  clamp: number;
  /** the tip at every rung of the loading, the last at the full force */
  path: { F: number; x: number; y: number }[];
}

/**
 * The cantilever's tip under a sideways tip force F (positive up) at any deflection: θ(0) = 0 at
 * the clamp, no moment at the free end, θ'(L) = 0, a two-point problem solved by shooting on
 * θ'(0). Past FL²/EI ≈ 10 the shooting has other roots, shapes that curl round the clamp, so the
 * force is raised in `rungs` steps from zero and each root is sought nearest the last one: the
 * branch the beam follows as it is loaded.
 */
export function elasticaTip(F: number, L = 1, EI = 1, steps = 4000, rungs = 40): Elastica {
  let a = 0;
  const path: { F: number; x: number; y: number }[] = [];
  for (let m = 1; m <= rungs; m++) {
    const Fm = (F * m) / rungs;
    const n = m === rungs ? steps : Math.max(200, steps / 10);
    const end = (t: number) => shoot(t, 0, Fm, n, L, EI).end;
    const step = (0.01 * Math.abs(F * L)) / EI + 1e-9;
    let lo = a;
    let hi = a;
    let flo = end(a);
    for (let k = 1; k <= 400; k++) {
      const up = a + k * step;
      const down = a - k * step;
      const fu = end(up);
      if ((fu > 0) !== (end(up - step) > 0)) { lo = up - step; hi = up; flo = end(lo); break; }
      const fd = end(down);
      if ((fd > 0) !== (end(down + step) > 0)) { lo = down + step; hi = down; flo = end(lo); break; }
    }
    for (let i = 0; i < 64; i++) {
      const mid = 0.5 * (lo + hi);
      const fm = end(mid);
      if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    a = 0.5 * (lo + hi);
    const r = shoot(a, 0, Fm, n, L, EI);
    path.push({ F: Fm, x: r.x, y: r.y });
  }
  const r = path[path.length - 1];
  return { x: r.x, y: r.y, clamp: a, path };
}
