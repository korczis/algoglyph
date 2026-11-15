// Magnetostatics of wires (plan S8a): the field of a current I along a polyline by the Biot–Savart
// law, each straight segment integrated exactly in closed form, in units where μ₀ = 1. Beside it,
// the integrals that check it without using it: the circulation ∮B·dl around a loop (Ampère), the
// flux through a disc, the mutual inductance of two loops by Neumann's double integral, and the
// motional EMF ∮(v × B)·dl of a moving loop. The closed forms the tests and claims hold them to (the
// loop's axis, the finite solenoid's sheet, the AGM-elliptic mutual inductance) are not used here.

export type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.sqrt(dot(a, a));

/** A wire: its vertices in order (closed when the last equals the first) and its current. */
export interface Wire { points: V3[]; current: number }

/**
 * The field at p of a straight segment from a to b carrying I: (I/4π) (A × B)(|A| + |B|) /
 * (|A||B|(|A||B| + A·B)), with A = a − p and B = b − p. Exact; zero on the segment's own line.
 */
export function segmentField(a: V3, b: V3, I: number, p: V3, out: V3): void {
  const A = sub(a, p);
  const B = sub(b, p);
  const la = norm(A);
  const lb = norm(B);
  const c = cross(A, B);
  const den = la * lb * (la * lb + dot(A, B));
  if (den <= 1e-300 || dot(c, c) <= 1e-30 * la * la * lb * lb) return;
  const k = (I / (4 * Math.PI)) * ((la + lb) / den);
  out[0] += k * c[0];
  out[1] += k * c[1];
  out[2] += k * c[2];
}

/** The field at p of every wire. */
export function field(wires: readonly Wire[], p: V3): V3 {
  const out: V3 = [0, 0, 0];
  for (const w of wires) for (let i = 0; i + 1 < w.points.length; i++) segmentField(w.points[i], w.points[i + 1], w.current, p, out);
  return out;
}

/** A circular loop of radius R about the z axis at height z0, as a closed polygon of n sides. */
export function loop(R: number, z0: number, n: number, current: number, centre: [number, number] = [0, 0]): Wire {
  const points: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = (2 * Math.PI * k) / n;
    points.push([centre[0] + R * Math.cos(t), centre[1] + R * Math.sin(t), z0]);
  }
  return { points, current };
}

/** A helix of `turns` turns of radius R over the length L, centred on the origin, n sides a turn. */
export function helix(R: number, L: number, turns: number, n: number, current: number): Wire {
  const points: V3[] = [];
  const steps = Math.round(turns * n);
  for (let k = 0; k <= steps; k++) {
    const t = (2 * Math.PI * k) / n;
    points.push([R * Math.cos(t), R * Math.sin(t), -L / 2 + (L * k) / steps]);
  }
  return { points, current };
}

/** ∮ B·dl around the circle of radius r about `centre` in the plane z = z0, by the trapezoid rule on m points. */
export function circulation(wires: readonly Wire[], centre: V3, r: number, m: number, normal: 'z' | 'x' = 'z'): number {
  let s = 0;
  for (let k = 0; k < m; k++) {
    const t = (2 * Math.PI * k) / m;
    const [c, si] = [Math.cos(t), Math.sin(t)];
    const p: V3 = normal === 'z' ? [centre[0] + r * c, centre[1] + r * si, centre[2]] : [centre[0], centre[1] + r * c, centre[2] + r * si];
    const dl: V3 = normal === 'z' ? [-si, c, 0] : [0, -si, c];
    s += dot(field(wires, p), dl) * ((2 * Math.PI * r) / m);
  }
  return s;
}

/** Gauss–Legendre nodes and weights on [0, 1], by Newton's method on the Legendre polynomial. */
export function legendre01(n: number): { x: Float64Array; w: Float64Array } {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 1;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    x[i] = (1 - z) / 2;
    w[i] = 1 / ((1 - z * z) * dp * dp) * 2 / 2;
  }
  return { x, w };
}

/** The flux of B through the disc of radius r about the z axis at height z0: Gauss–Legendre in r, trapezoid in φ. */
export function fluxThroughDisc(wires: readonly Wire[], r: number, z0: number, nr = 24, nphi = 48, centre: [number, number] = [0, 0]): number {
  const g = legendre01(nr);
  let s = 0;
  for (let i = 0; i < nr; i++) {
    const rr = g.x[i] * r;
    for (let k = 0; k < nphi; k++) {
      const t = (2 * Math.PI * k) / nphi;
      const B = field(wires, [centre[0] + rr * Math.cos(t), centre[1] + rr * Math.sin(t), z0]);
      s += g.w[i] * r * rr * B[2] * ((2 * Math.PI) / nphi);
    }
  }
  return s;
}

/**
 * Neumann's mutual inductance of two closed polylines, (1/4π) ∮∮ dl₁·dl₂/|r₁ − r₂|, by the
 * midpoint rule on their segments (μ₀ = 1). Converges as the polygons refine; they must not touch.
 */
export function neumann(a: Wire, b: Wire): number {
  let s = 0;
  for (let i = 0; i + 1 < a.points.length; i++) {
    const da = sub(a.points[i + 1], a.points[i]);
    const ma: V3 = [(a.points[i][0] + a.points[i + 1][0]) / 2, (a.points[i][1] + a.points[i + 1][1]) / 2, (a.points[i][2] + a.points[i + 1][2]) / 2];
    for (let j = 0; j + 1 < b.points.length; j++) {
      const db = sub(b.points[j + 1], b.points[j]);
      const mb: V3 = [(b.points[j][0] + b.points[j + 1][0]) / 2, (b.points[j][1] + b.points[j + 1][1]) / 2, (b.points[j][2] + b.points[j + 1][2]) / 2];
      s += dot(da, db) / norm(sub(ma, mb));
    }
  }
  return s / (4 * Math.PI);
}

/** The motional EMF ∮ (v × B)·dl of a polyline moving rigidly at velocity v through the wires' field (midpoint rule). */
export function motionalEmf(wires: readonly Wire[], moving: Wire, v: V3): number {
  let s = 0;
  for (let i = 0; i + 1 < moving.points.length; i++) {
    const a = moving.points[i];
    const b = moving.points[i + 1];
    const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    s += dot(cross(v, field(wires, mid)), sub(b, a));
  }
  return s;
}

/** The magnetic moment (I/2) ∮ r × dl of a closed wire. */
export function moment(w: Wire): V3 {
  const m: V3 = [0, 0, 0];
  for (let i = 0; i + 1 < w.points.length; i++) {
    const c = cross(w.points[i], sub(w.points[i + 1], w.points[i]));
    m[0] += 0.5 * w.current * c[0];
    m[1] += 0.5 * w.current * c[1];
    m[2] += 0.5 * w.current * c[2];
  }
  return m;
}

/** K(k) and E(k), the complete elliptic integrals of modulus k, by the arithmetic-geometric mean. */
export function ellipticKE(k: number): { K: number; E: number } {
  let a = 1;
  let g = Math.sqrt(1 - k * k);
  let c = k;
  let sum = (c * c) / 2;
  let pow = 0.5;
  for (let i = 0; i < 40 && Math.abs(c) > 1e-17; i++) {
    const an = (a + g) / 2;
    c = (a - g) / 2;
    g = Math.sqrt(a * g);
    a = an;
    pow *= 2;
    sum += pow * c * c;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}
