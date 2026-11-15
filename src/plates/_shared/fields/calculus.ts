// Vector calculus in the plane, by quadrature (plan S8a, still plates): a field F(x, y), a closed
// loop (a circle, or any simple polygon), and the integrals the theorems of Gauss and Stokes set
// equal, each computed by its own route. The flux ∮F·n dl and the circulation ∮F·dl walk the
// boundary (the trapezoid on a circle, which is exponentially accurate for a smooth periodic
// integrand; Gauss–Legendre on each edge of a polygon). The area integrals of div F and curl F
// cover the inside (Gauss–Legendre in r and the trapezoid in θ on a circle; a polygon is cut into
// signed triangles from its first vertex, each by a collapsed Gauss–Legendre square), and the
// derivatives are central differences of F itself, so no derivative is ever written by hand.
// Pure: no p5, no randomness.
import { gaussLegendre } from './superposition';

export type Vec = [number, number];
export type Field2 = (x: number, y: number) => Vec;

export interface FieldPreset {
  id: string;
  F: Field2;
  /** A potential with F = −∇φ, for a conservative field. */
  phi?: (x: number, y: number) => number;
}

/** Width of the smoothed source and vortex, so that their divergence and curl are smooth. */
export const CORE = 0.35;

/** 1 − e^(−r²/a²), over r², with its limit 1/a² at the origin. */
function smooth(r2: number, a = CORE): number {
  const u = r2 / (a * a);
  return u < 1e-8 ? (1 - u / 2) / (a * a) : -Math.expm1(-u) / r2;
}

export const FIELDS: Record<string, FieldPreset> = {
  // the field of a line charge in two dimensions, its core smeared over a Gaussian of width CORE
  source: { id: 'source', F: (x, y) => { const s = smooth(x * x + y * y); return [x * s, y * s]; } },
  // the same with every vector turned a quarter: the flow around a smoothed vortex line
  vortex: { id: 'vortex', F: (x, y) => { const s = smooth(x * x + y * y); return [-y * s, x * s]; } },
  // a saddle: F = −∇(x² − y²)
  saddle: { id: 'saddle', F: (x, y) => [-2 * x, 2 * y], phi: (x, y) => x * x - y * y },
  // a shear flow: no divergence, a uniform curl of −1
  shear: { id: 'shear', F: (x, y) => [y, 0 * x] },
  // a uniform field: F = −∇(−F·r)
  uniform: { id: 'uniform', F: () => [1, 0.5], phi: (x, y) => -(x + 0.5 * y) },
  // a source and a vortex, apart, and a uniform drift: every theorem at once
  mixed: {
    id: 'mixed',
    F: (x, y) => {
      const a = smooth((x + 0.6) ** 2 + y * y);
      const b = smooth((x - 0.6) ** 2 + y * y);
      return [(x + 0.6) * a - y * b + 0.3, y * a + (x - 0.6) * b];
    },
  },
};

/** Step of the central differences: the error is O(h²) and round-off O(ε/h), both near 1e-10 here. */
const H = 1e-4;

export function divergence(F: Field2, x: number, y: number, h = H): number {
  return (F(x + h, y)[0] - F(x - h, y)[0] + F(x, y + h)[1] - F(x, y - h)[1]) / (2 * h);
}

export function curl(F: Field2, x: number, y: number, h = H): number {
  return (F(x + h, y)[1] - F(x - h, y)[1] - F(x, y + h)[0] + F(x, y - h)[0]) / (2 * h);
}

export type Loop =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'polygon'; xs: ArrayLike<number>; ys: ArrayLike<number> };

/** A square of half-side s about (cx, cy), counter-clockwise. */
export function square(cx: number, cy: number, s: number): Loop {
  return { kind: 'polygon', xs: [cx - s, cx + s, cx + s, cx - s], ys: [cy - s, cy - s, cy + s, cy + s] };
}

/** Twice the signed area of a polygon by the shoelace sum: positive counter-clockwise. */
export function signedArea(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  let a = 0;
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    a += xs[i] * ys[j] - xs[j] * ys[i];
  }
  return a / 2;
}

/**
 * The two boundary integrals, counter-clockwise: the outward flux ∮F·n dl and the circulation
 * ∮F·dl. `n` nodes on a circle; `n` Gauss–Legendre nodes on each polygon edge.
 */
export function boundary(F: Field2, loop: Loop, n = 512): { flux: number; circulation: number } {
  let flux = 0;
  let circulation = 0;
  if (loop.kind === 'circle') {
    for (let k = 0; k < n; k++) {
      const t = (2 * Math.PI * k) / n;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const [fx, fy] = F(loop.cx + loop.r * c, loop.cy + loop.r * s);
      flux += fx * c + fy * s;
      circulation += -fx * s + fy * c;
    }
    const dl = (2 * Math.PI * loop.r) / n;
    return { flux: flux * dl, circulation: circulation * dl };
  }
  const { xs, ys } = loop;
  // a clockwise polygon is walked backwards, so that n is always the outward normal
  const sign = signedArea(xs, ys) >= 0 ? 1 : -1;
  const { x: g, w } = gaussLegendre(n);
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    const dx = xs[j] - xs[i];
    const dy = ys[j] - ys[i];
    for (let k = 0; k < n; k++) {
      const t = (g[k] + 1) / 2;
      const [fx, fy] = F(xs[i] + t * dx, ys[i] + t * dy);
      // dl = (dx, dy) dt; the outward normal of a counter-clockwise walk is (dy, −dx) dt
      flux += (w[k] / 2) * (fx * dy - fy * dx);
      circulation += (w[k] / 2) * (fx * dx + fy * dy);
    }
  }
  return { flux: sign * flux, circulation: sign * circulation };
}

/**
 * ∬ f dA over the loop's inside. A circle: Gauss–Legendre in r, the trapezoid in θ. A polygon: the
 * signed triangles (v₀, vᵢ, vᵢ₊₁), which add up to the polygon whatever its shape, each mapped from
 * the unit square by the collapsed (Duffy) map with an n × n Gauss–Legendre rule.
 */
export function areaIntegral(f: (x: number, y: number) => number, loop: Loop, n = 48): number {
  const { x: g, w } = gaussLegendre(n);
  let total = 0;
  if (loop.kind === 'circle') {
    const nt = 4 * n;
    for (let i = 0; i < n; i++) {
      const r = ((g[i] + 1) / 2) * loop.r;
      let ring = 0;
      for (let k = 0; k < nt; k++) {
        const t = (2 * Math.PI * k) / nt;
        ring += f(loop.cx + r * Math.cos(t), loop.cy + r * Math.sin(t));
      }
      total += (w[i] / 2) * loop.r * r * ring * ((2 * Math.PI) / nt);
    }
    return total;
  }
  const { xs, ys } = loop;
  const sign = signedArea(xs, ys) >= 0 ? 1 : -1;
  for (let i = 1; i + 1 < xs.length; i++) {
    const ax = xs[0]; const ay = ys[0];
    const bx = xs[i] - ax; const by = ys[i] - ay;
    const cx = xs[i + 1] - ax; const cy = ys[i + 1] - ay;
    const jac = bx * cy - by * cx;
    if (jac === 0) continue;
    let tri = 0;
    for (let a = 0; a < n; a++) {
      const u = (g[a] + 1) / 2;
      for (let b = 0; b < n; b++) {
        const v = (g[b] + 1) / 2;
        // (u, v) in the unit square to the triangle: s = u, t = u·v, with Jacobian u
        const s = u * (1 - v);
        const t = u * v;
        tri += (w[a] / 2) * (w[b] / 2) * u * f(ax + s * bx + t * cx, ay + s * by + t * cy);
      }
    }
    total += tri * jac;
  }
  return sign * total;
}

/** ∫F·dl along a path given as points, by Gauss–Legendre on each straight piece. */
export function work(F: Field2, xs: ArrayLike<number>, ys: ArrayLike<number>, n = 16): number {
  const { x: g, w } = gaussLegendre(n);
  let total = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const dx = xs[i + 1] - xs[i];
    const dy = ys[i + 1] - ys[i];
    for (let k = 0; k < n; k++) {
      const t = (g[k] + 1) / 2;
      const [fx, fy] = F(xs[i] + t * dx, ys[i] + t * dy);
      total += (w[k] / 2) * (fx * dx + fy * dy);
    }
  }
  return total;
}

/** ∫F·dl along the arc of the circle (cx, cy, r) from angle t0 to t1, by Gauss–Legendre in the
 * angle, in `pieces` pieces of n nodes each. */
export function arcWork(F: Field2, cx: number, cy: number, r: number, t0: number, t1: number, n = 32, pieces = 8): number {
  const { x: g, w } = gaussLegendre(n);
  const span = (t1 - t0) / pieces;
  let total = 0;
  for (let p = 0; p < pieces; p++) {
    for (let k = 0; k < n; k++) {
      const t = t0 + span * (p + (g[k] + 1) / 2);
      const [fx, fy] = F(cx + r * Math.cos(t), cy + r * Math.sin(t));
      total += (w[k] / 2) * span * r * (-fx * Math.sin(t) + fy * Math.cos(t));
    }
  }
  return total;
}
