// Rays in a meridional plane (plan S4): exact ray–surface intersection with spheres and planes,
// Snell's law in vector form, the paraxial ABCD matrices as the comparison the exact trace should
// approach as the ray height goes to zero, and Fermat's least time found by golden-section search,
// which never calls Snell's law. Coordinates: z along the axis, y across it. Pure.

/** A refracting surface: its vertex on the axis at z, its radius R (centre at z + R; Infinity for a
 * plane), and the index n of the medium after it. */
export interface Surface { z: number; R: number; n: number }

/** A ray: a point and a unit direction. */
export interface Ray { z: number; y: number; dz: number; dy: number }

/** A single lens of index n in air, vertex radii R1 and R2, thickness t, its first vertex at 0. */
export function lens(n: number, R1: number, R2: number, t: number): Surface[] {
  return [{ z: 0, R: R1, n }, { z: t, R: R2, n: 1 }];
}

/**
 * Trace a ray starting at (z0, y0) at `angle` to the axis, in a medium of index n0, through every
 * surface in order. Null when it misses a surface or is totally reflected.
 */
export function traceRay(surfaces: Surface[], y0: number, angle: number, z0: number, n0 = 1, path?: [number, number][]): Ray | null {
  let z = z0;
  let y = y0;
  let dz = Math.cos(angle);
  let dy = Math.sin(angle);
  let n1 = n0;
  path?.push([z, y]);
  for (const s of surfaces) {
    let t: number;
    let nz: number;
    let ny: number;
    if (!Number.isFinite(s.R)) {
      if (dz <= 0) return null;
      t = (s.z - z) / dz;
      nz = -1;
      ny = 0;
    } else {
      const cz = s.z + s.R;
      const pz = z - cz;
      const b = dz * pz + dy * y;
      const disc = b * b - (pz * pz + y * y - s.R * s.R);
      if (disc < 0) return null;
      // the intersection on the cap nearest the vertex
      t = -b - Math.sign(s.R) * Math.sqrt(disc);
      if (t < 0) return null;
      nz = (z + t * dz - cz) / s.R;
      ny = (y + t * dy) / s.R;
    }
    z += t * dz;
    y += t * dy;
    // refraction: the normal points back against the ray
    const eta = n1 / s.n;
    const cosi = -(nz * dz + ny * dy);
    const k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return null;
    const f = eta * cosi - Math.sqrt(k);
    dz = eta * dz + f * nz;
    dy = eta * dy + f * ny;
    const len = Math.hypot(dz, dy);
    dz /= len;
    dy /= len;
    n1 = s.n;
    path?.push([z, y]);
  }
  return { z, y, dz, dy };
}

/** Where a ray crosses the axis. */
export const axisCrossing = (r: Ray): number => r.z - (r.y * r.dz) / r.dy;

/**
 * The paraxial system matrix from the first vertex to the last, acting on (y, n·u): each surface
 * refracts by [[1, 0], [−(n′ − n)/R, 1]], each gap translates by [[1, d/n], [0, 1]].
 */
export function abcd(surfaces: Surface[], n0 = 1): [[number, number], [number, number]] {
  let M: [[number, number], [number, number]] = [[1, 0], [0, 1]];
  const mul = (a: typeof M, b: typeof M): typeof M => [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
  let n = n0;
  surfaces.forEach((s, k) => {
    if (k > 0) M = mul([[1, (s.z - surfaces[k - 1].z) / n], [0, 1]], M);
    const P = Number.isFinite(s.R) ? (s.n - n) / s.R : 0;
    M = mul([[1, 0], [-P, 1]], M);
    n = s.n;
  });
  return M;
}

/** The least-time crossing X = (x, 0) of the interface y = 0 between A (index n1, y > 0) and B
 * (index n2, y < 0), by golden-section search on the optical path n1|AX| + n2|XB|, which is convex. */
export function fermatCrossing(n1: number, n2: number, A: [number, number], B: [number, number]): { x: number; path: number } {
  const L = (x: number) => n1 * Math.hypot(x - A[0], A[1]) + n2 * Math.hypot(B[0] - x, B[1]);
  let lo = Math.min(A[0], B[0]);
  let hi = Math.max(A[0], B[0]);
  const g = (Math.sqrt(5) - 1) / 2;
  let a = hi - g * (hi - lo);
  let b = lo + g * (hi - lo);
  let fa = L(a);
  let fb = L(b);
  for (let k = 0; k < 200 && hi - lo > 1e-15; k++) {
    if (fa < fb) { hi = b; b = a; fb = fa; a = hi - g * (hi - lo); fa = L(a); } else { lo = a; a = b; fa = fb; b = lo + g * (hi - lo); fb = L(b); }
  }
  const x = (lo + hi) / 2;
  return { x, path: L(x) };
}
