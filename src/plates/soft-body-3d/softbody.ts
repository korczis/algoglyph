// A mass-spring soft body. Point masses joined by damped Hookean springs, an optional ideal gas
// enclosed by the body's surface (the pressure model of Matyka & Ollila, SIGRAD 2003), gravity
// along -y and a ground plane at y = 0 with restitution and Coulomb friction. Integrated by
// velocity Verlet (kick-drift-kick): symplectic for the conservative forces, second order.
// Positions, velocities and forces are packed xyz arrays; y points up.

export const STRUCTURAL = 0;
export const SHEAR = 1;
export const BEND = 2;
export type SpringKind = typeof STRUCTURAL | typeof SHEAR | typeof BEND;

/** Impacts slower than this (m/s) are inelastic, so a resting body does not chatter. */
export const REST_SPEED = 0.05;

export interface SoftBody {
  n: number;
  x: Float64Array;
  v: Float64Array;
  /** Forces at the current state; `step` keeps them current, `forces` recomputes them. */
  f: Float64Array;
  m: Float64Array;
  pinned: Uint8Array;
  /** Masses the last step projected onto the ground. */
  contact: Uint8Array;
  springs: number;
  sa: Int32Array;
  sb: Int32Array;
  rest: Float64Array;
  /** Spring constant per unit of the world's stiffness. */
  kw: Float64Array;
  kind: Uint8Array;
  /** Surface triangles, counter-clockwise seen from outside. */
  faces: Uint32Array;
  /** Whether the surface is closed, so it encloses a volume a gas can fill. */
  closed: boolean;
  restVolume: number;
}

export interface World {
  /** Gravitational acceleration, m/s², along -y. */
  gravity: number;
  ground: boolean;
  /** Normal velocity kept after an impact, 0..1. */
  restitution: number;
  /** Coulomb friction coefficient against the ground. */
  friction: number;
  /** Multiplies every spring's `kw`. */
  stiffness: number;
  /** Spring damping as a fraction of the critical damping of each spring's two-mass pair. */
  damping: number;
  /** Gas pressure at the rest volume (isothermal: p·V = const); used only by closed bodies. */
  pressure: number;
}

function empty(n: number, springs: number, faces: number[], closed: boolean): SoftBody {
  return {
    n,
    x: new Float64Array(n * 3),
    v: new Float64Array(n * 3),
    f: new Float64Array(n * 3),
    m: new Float64Array(n),
    pinned: new Uint8Array(n),
    contact: new Uint8Array(n),
    springs,
    sa: new Int32Array(springs),
    sb: new Int32Array(springs),
    rest: new Float64Array(springs),
    kw: new Float64Array(springs),
    kind: new Uint8Array(springs),
    faces: Uint32Array.from(faces),
    closed,
    restVolume: 0,
  };
}

interface Pair {
  a: number;
  b: number;
  kind: SpringKind;
  w: number;
}

function wire(body: SoftBody, pairs: Pair[], scale: number): void {
  const { x } = body;
  pairs.forEach((s, i) => {
    body.sa[i] = s.a;
    body.sb[i] = s.b;
    body.kind[i] = s.kind;
    body.kw[i] = s.w * scale;
    body.rest[i] = Math.hypot(x[s.b * 3] - x[s.a * 3], x[s.b * 3 + 1] - x[s.a * 3 + 1],
      x[s.b * 3 + 2] - x[s.a * 3 + 2]);
  });
}

/** Flip any triangle whose normal points towards `c`: the surface is convex when built. */
function orient(faces: number[], x: Float64Array, c: number[]): void {
  for (let t = 0; t < faces.length; t += 3) {
    const [a, b, d] = [faces[t] * 3, faces[t + 1] * 3, faces[t + 2] * 3];
    const ux = x[b] - x[a];
    const uy = x[b + 1] - x[a + 1];
    const uz = x[b + 2] - x[a + 2];
    const vx = x[d] - x[a];
    const vy = x[d + 1] - x[a + 1];
    const vz = x[d + 2] - x[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const out = nx * (x[a] - c[0]) + ny * (x[a + 1] - c[1]) + nz * (x[a + 2] - c[2]);
    if (out < 0) [faces[t + 1], faces[t + 2]] = [faces[t + 2], faces[t + 1]];
  }
}

// Offsets with a positive first non-zero component, so every pair is listed once.
const STRUCTURAL_OFFSETS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const SHEAR_OFFSETS = [[1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]];
const BEND_OFFSETS = [[2, 0, 0], [0, 2, 0], [0, 0, 2]];

/**
 * A box lattice of nx × ny × nz masses at spacing h, corner at the origin, total mass `mass`:
 * structural springs to the 6 axis neighbours, shear springs along face and body diagonals,
 * bending springs to the second neighbour along each axis. Spring constants scale with h so the
 * block's stiffness does not depend on the resolution.
 */
export function lattice(nx: number, ny: number, nz: number, h: number, mass: number): SoftBody {
  const n = nx * ny * nz;
  const id = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const pairs: Pair[] = [];
  const sets: [number[][], SpringKind, number][] = [
    [STRUCTURAL_OFFSETS, STRUCTURAL, 1],
    [SHEAR_OFFSETS, SHEAR, 0.7],
    [BEND_OFFSETS, BEND, 0.4],
  ];
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        for (const [offsets, kind, w] of sets) {
          for (const [di, dj, dk] of offsets) {
            const [a, b, c] = [i + di, j + dj, k + dk];
            if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) continue;
            pairs.push({ a: id(i, j, k), b: id(a, b, c), kind, w });
          }
        }
      }
    }
  }
  const faces: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => faces.push(a, b, c, a, c, d);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      for (const k of [0, nz - 1]) quad(id(i, j, k), id(i + 1, j, k), id(i + 1, j + 1, k),
        id(i, j + 1, k));
    }
  }
  for (let k = 0; k < nz - 1; k++) {
    for (let i = 0; i < nx - 1; i++) {
      for (const j of [0, ny - 1]) quad(id(i, j, k), id(i + 1, j, k), id(i + 1, j, k + 1),
        id(i, j, k + 1));
    }
    for (let j = 0; j < ny - 1; j++) {
      for (const i of [0, nx - 1]) quad(id(i, j, k), id(i, j + 1, k), id(i, j + 1, k + 1),
        id(i, j, k + 1));
    }
  }
  const body = empty(n, pairs.length, faces, true);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const o = id(i, j, k) * 3;
        body.x[o] = i * h;
        body.x[o + 1] = j * h;
        body.x[o + 2] = k * h;
      }
    }
  }
  body.m.fill(mass / n);
  wire(body, pairs, h);
  const c = [((nx - 1) * h) / 2, ((ny - 1) * h) / 2, ((nz - 1) * h) / 2];
  orient(faces, body.x, c);
  body.faces = Uint32Array.from(faces);
  body.restVolume = volume(body);
  return body;
}

/**
 * A geodesic sphere (icosahedron subdivided `subdiv` times) of radius r centred on the origin:
 * a membrane of structural springs along its edges and bending springs across each edge,
 * between the two vertices opposite it. Spring constants scale with r, not with the edge length:
 * a membrane's stiffness per unit length is what a spring network of any density must match.
 */
export function icosphere(subdiv: number, r: number, mass: number): SoftBody {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t],
    [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let tris = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2,
    10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10,
    8, 6, 7, 9, 8, 1];
  for (let s = 0; s < subdiv; s++) {
    const mid = new Map<number, number>();
    const half = (a: number, b: number) => {
      const key = Math.min(a, b) * 1e6 + Math.max(a, b);
      let m = mid.get(key);
      if (m === undefined) {
        m = verts.length;
        verts.push([0, 1, 2].map((d) => (verts[a][d] + verts[b][d]) / 2));
        mid.set(key, m);
      }
      return m;
    };
    const next: number[] = [];
    for (let i = 0; i < tris.length; i += 3) {
      const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
      const [ab, bc, ca] = [half(a, b), half(b, c), half(c, a)];
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    tris = next;
  }
  // every edge with the vertex opposite it in each of its two triangles
  const edges = new Map<number, number[]>();
  for (let i = 0; i < tris.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const a = tris[i + e];
      const b = tris[i + ((e + 1) % 3)];
      const key = Math.min(a, b) * 1e6 + Math.max(a, b);
      const list = edges.get(key) ?? [Math.min(a, b), Math.max(a, b)];
      list.push(tris[i + ((e + 2) % 3)]);
      edges.set(key, list);
    }
  }
  const pairs: Pair[] = [];
  for (const [a, b] of edges.values()) pairs.push({ a, b, kind: STRUCTURAL, w: 1 });
  for (const [, , c, d] of edges.values()) pairs.push({ a: c, b: d, kind: BEND, w: 0.15 });
  const body = empty(verts.length, pairs.length, tris, true);
  verts.forEach((p, i) => {
    const l = Math.hypot(p[0], p[1], p[2]);
    for (let d = 0; d < 3; d++) body.x[i * 3 + d] = (p[d] / l) * r;
  });
  body.m.fill(mass / body.n);
  wire(body, pairs, r);
  orient(tris, body.x, [0, 0, 0]);
  body.faces = Uint32Array.from(tris);
  body.restVolume = volume(body);
  return body;
}

/** Enclosed volume by the divergence theorem: the sum of signed tetrahedra to the origin. */
export function volume(b: SoftBody): number {
  const { x, faces } = b;
  let v = 0;
  for (let t = 0; t < faces.length; t += 3) {
    const a = faces[t] * 3;
    const c = faces[t + 1] * 3;
    const d = faces[t + 2] * 3;
    v += x[a] * (x[c + 1] * x[d + 2] - x[c + 2] * x[d + 1])
      + x[a + 1] * (x[c + 2] * x[d] - x[c] * x[d + 2])
      + x[a + 2] * (x[c] * x[d + 1] - x[c + 1] * x[d]);
  }
  return v / 6;
}

/** Whether the gas acts: only a closed surface with a positive pressure holds one. */
function gas(b: SoftBody, w: World): boolean {
  return b.closed && w.pressure > 0;
}

/** Recompute b.f from the current positions and velocities. */
export function forces(b: SoftBody, w: World): void {
  const { n, x, v, f, m } = b;
  for (let i = 0; i < n; i++) {
    f[i * 3] = 0;
    f[i * 3 + 1] = -m[i] * w.gravity;
    f[i * 3 + 2] = 0;
  }
  for (let s = 0; s < b.springs; s++) {
    const i = b.sa[s];
    const j = b.sb[s];
    const ia = i * 3;
    const ja = j * 3;
    const dx = x[ja] - x[ia];
    const dy = x[ja + 1] - x[ia + 1];
    const dz = x[ja + 2] - x[ia + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-12;
    const ux = dx / d;
    const uy = dy / d;
    const uz = dz / d;
    const k = w.stiffness * b.kw[s];
    const closing = (v[ja] - v[ia]) * ux + (v[ja + 1] - v[ia + 1]) * uy
      + (v[ja + 2] - v[ia + 2]) * uz;
    // critical damping of two masses on one spring: c = 2·sqrt(k·μ), μ the reduced mass
    const c = w.damping * 2 * Math.sqrt((k * m[i] * m[j]) / (m[i] + m[j]));
    const t = k * (d - b.rest[s]) + c * closing;
    f[ia] += t * ux;
    f[ia + 1] += t * uy;
    f[ia + 2] += t * uz;
    f[ja] -= t * ux;
    f[ja + 1] -= t * uy;
    f[ja + 2] -= t * uz;
  }
  if (gas(b, w)) {
    // p = nRT / V; each vertex of a face gets a third of p times the face's area vector, which
    // summed over a closed surface is exactly p·∂V/∂x: the force of the potential -nRT·ln V.
    const p = (w.pressure * b.restVolume) / Math.max(volume(b), 1e-9 * b.restVolume);
    const { faces } = b;
    for (let t = 0; t < faces.length; t += 3) {
      const a = faces[t] * 3;
      const c = faces[t + 1] * 3;
      const d = faces[t + 2] * 3;
      const ux = x[c] - x[a];
      const uy = x[c + 1] - x[a + 1];
      const uz = x[c + 2] - x[a + 2];
      const vx = x[d] - x[a];
      const vy = x[d + 1] - x[a + 1];
      const vz = x[d + 2] - x[a + 2];
      const q = p / 6;
      const fx = (uy * vz - uz * vy) * q;
      const fy = (uz * vx - ux * vz) * q;
      const fz = (ux * vy - uy * vx) * q;
      for (const o of [a, c, d]) {
        f[o] += fx;
        f[o + 1] += fy;
        f[o + 2] += fz;
      }
    }
  }
}

/** Project masses below the ground back onto it and flag them; returns how many touched it. */
function project(b: SoftBody): number {
  const { n, x, pinned, contact } = b;
  let count = 0;
  for (let i = 0; i < n; i++) {
    contact[i] = 0;
    if (pinned[i] || x[i * 3 + 1] > 0) continue;
    x[i * 3 + 1] = 0;
    contact[i] = 1;
    count++;
  }
  return count;
}

/**
 * Contact response of the flagged masses: restitution along the normal for an impact (or none,
 * `bounce` false), Coulomb friction along the ground.
 */
function respond(b: SoftBody, w: World, bounce: boolean): void {
  const { n, v, contact } = b;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const vn = v[o + 1];
    if (!contact[i] || vn >= 0) continue;
    const after = bounce && -vn > REST_SPEED ? -w.restitution * vn : 0;
    v[o + 1] = after;
    // the tangential impulse is at most friction × the normal impulse
    const vt = Math.hypot(v[o], v[o + 2]);
    if (vt > 0) {
      const s = Math.max(0, 1 - (w.friction * (after - vn)) / vt);
      v[o] *= s;
      v[o + 2] *= s;
    }
  }
}

/**
 * One velocity Verlet step: half kick, drift, ground projection and impact response, new
 * forces, half kick, inelastic response. `b.f` must hold the forces of the current state
 * (call `forces` after building or changing the world). Damping is evaluated at the
 * half-step velocity. Returns the number of masses touching the ground.
 */
export function step(b: SoftBody, w: World, dt: number): number {
  const { n, x, v, f, m, pinned } = b;
  const h = dt / 2;
  for (let i = 0; i < n; i++) {
    if (pinned[i]) continue;
    const k = h / m[i];
    for (let d = i * 3; d < i * 3 + 3; d++) {
      v[d] += f[d] * k;
      x[d] += v[d] * dt;
    }
  }
  const contacts = w.ground ? project(b) : 0;
  if (contacts) respond(b, w, true);
  forces(b, w);
  for (let i = 0; i < n; i++) {
    if (pinned[i]) continue;
    const k = h / m[i];
    for (let d = i * 3; d < i * 3 + 3; d++) v[d] += f[d] * k;
  }
  // the floor also stops, without a bounce, a mass the second half kick drives into it: a mass
  // at rest on it would otherwise carry that half kick as a velocity it never moves with
  if (contacts) respond(b, w, false);
  return contacts;
}

export interface Energy {
  kinetic: number;
  gravity: number;
  elastic: number;
  /** Isothermal gas: nRT·ln(V₀ / V), zero at the rest volume. */
  gas: number;
  total: number;
}

export function energy(b: SoftBody, w: World): Energy {
  const { n, x, v, m } = b;
  let kinetic = 0;
  let gravity = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    kinetic += 0.5 * m[i] * (v[o] * v[o] + v[o + 1] * v[o + 1] + v[o + 2] * v[o + 2]);
    gravity += m[i] * w.gravity * x[o + 1];
  }
  let elastic = 0;
  for (let s = 0; s < b.springs; s++) {
    const e = strainLength(b, s) - b.rest[s];
    elastic += 0.5 * w.stiffness * b.kw[s] * e * e;
  }
  const g = gas(b, w) ? w.pressure * b.restVolume * Math.log(b.restVolume / volume(b)) : 0;
  return { kinetic, gravity, elastic, gas: g, total: kinetic + gravity + elastic + g };
}

function strainLength(b: SoftBody, s: number): number {
  const a = b.sa[s] * 3;
  const c = b.sb[s] * 3;
  const { x } = b;
  return Math.hypot(x[c] - x[a], x[c + 1] - x[a + 1], x[c + 2] - x[a + 2]);
}

/** Engineering strain (L − L₀) / L₀ of spring s: positive stretched, negative compressed. */
export function strain(b: SoftBody, s: number): number {
  return strainLength(b, s) / b.rest[s] - 1;
}

export function momentum(b: SoftBody): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < b.n; i++) {
    for (let d = 0; d < 3; d++) out[d] += b.m[i] * b.v[i * 3 + d];
  }
  return out;
}

/**
 * Rate bounds of the linearised network by Gershgorin's theorem: ω bounds the highest angular
 * frequency of M⁻¹K, γ the largest damping rate of M⁻¹C (each spring block bounded by √3
 * times its constant per row).
 */
export function rates(b: SoftBody, w: World): { omega: number; gamma: number } {
  const ks = new Float64Array(b.n);
  const cs = new Float64Array(b.n);
  const { m } = b;
  for (let s = 0; s < b.springs; s++) {
    const i = b.sa[s];
    const j = b.sb[s];
    const k = w.stiffness * b.kw[s];
    const c = w.damping * 2 * Math.sqrt((k * m[i] * m[j]) / (m[i] + m[j]));
    ks[i] += k;
    ks[j] += k;
    cs[i] += c;
    cs[j] += c;
  }
  let omega = 0;
  let gamma = 0;
  for (let i = 0; i < b.n; i++) {
    omega = Math.max(omega, Math.sqrt((2 * Math.sqrt(3) * ks[i]) / m[i]));
    gamma = Math.max(gamma, (2 * Math.sqrt(3) * cs[i]) / m[i]);
  }
  return { omega, gamma };
}

/**
 * The step `step` is used at by the plate: undamped velocity Verlet is stable while ω·dt < 2;
 * the margin and the γ term keep the damped, explicitly integrated network stable too
 * (checked by the tests at the extremes of the plate's controls).
 */
export function stableStep(b: SoftBody, w: World): number {
  const { omega, gamma } = rates(b, w);
  return 1.6 / (omega + gamma / 2 || 1);
}

export type Preset = 'cube' | 'ball' | 'column';

/** Mass per unit volume of the lattice presets, kg/m³: light, so the jelly is soft and slow. */
export const DENSITY = 3;

/** Rotate every node of b about its centroid by a rotation built from three angles. */
function rotate(b: SoftBody, ax: number, ay: number, az: number): void {
  const c = centroid(b);
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay),
    Math.cos(az), Math.sin(az)];
  for (let i = 0; i < b.n; i++) {
    const o = i * 3;
    let px = b.x[o] - c[0];
    let py = b.x[o + 1] - c[1];
    let pz = b.x[o + 2] - c[2];
    [py, pz] = [py * ca - pz * sa, py * sa + pz * ca];
    [px, pz] = [px * cb + pz * sb, -px * sb + pz * cb];
    [px, py] = [px * cc - py * sc, px * sc + py * cc];
    b.x[o] = px + c[0];
    b.x[o + 1] = py + c[1];
    b.x[o + 2] = pz + c[2];
  }
}

export function centroid(b: SoftBody): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < b.n; i++) for (let d = 0; d < 3; d++) c[d] += b.x[i * 3 + d] / b.n;
  return c;
}

/** Move b rigidly so its centroid is at (x, ·, z) and its lowest node at height y. */
function place(b: SoftBody, x: number, y: number, z: number): void {
  const c = centroid(b);
  let low = Infinity;
  for (let i = 0; i < b.n; i++) low = Math.min(low, b.x[i * 3 + 1]);
  for (let i = 0; i < b.n; i++) {
    b.x[i * 3] += x - c[0];
    b.x[i * 3 + 1] += y - low;
    b.x[i * 3 + 2] += z - c[2];
  }
}

/** Give b a rigid motion: velocity u plus angular velocity om about its centroid. */
function spin(b: SoftBody, u: number[], om: number[]): void {
  const c = centroid(b);
  for (let i = 0; i < b.n; i++) {
    const o = i * 3;
    const rx = b.x[o] - c[0];
    const ry = b.x[o + 1] - c[1];
    const rz = b.x[o + 2] - c[2];
    b.v[o] = u[0] + om[1] * rz - om[2] * ry;
    b.v[o + 1] = u[1] + om[2] * rx - om[0] * rz;
    b.v[o + 2] = u[2] + om[0] * ry - om[1] * rx;
  }
}

/** Nodes per side → icosphere subdivisions, so `resolution` means "finer" for every preset. */
export function ballSubdiv(res: number): number {
  return res <= 4 ? 1 : res <= 7 ? 2 : 3;
}

/**
 * Build a preset at rest volume, then place it for its experiment: a cube or ball released in
 * a seeded orientation above the ground, or a column pinned at its base and given a seeded
 * sideways shear to wobble.
 */
export function preset(name: Preset, res: number, rnd: () => number): SoftBody {
  const sym = () => (rnd() - 0.5) * 2;
  if (name === 'ball') {
    const b = icosphere(ballSubdiv(res), 0.5, 1);
    rotate(b, sym() * Math.PI, sym() * Math.PI, sym() * Math.PI);
    place(b, 0, 0.9 + 0.3 * rnd(), 0);
    spin(b, [sym() * 0.5, 0, sym() * 0.5], [sym() * 2, sym() * 2, sym() * 2]);
    return b;
  }
  if (name === 'column') {
    const side = Math.max(3, Math.round(res * 0.6));
    const h = 0.4 / (side - 1);
    const rows = Math.round(1 / h) + 1;
    const b = lattice(side, rows, side, h, DENSITY * 0.16 * (rows - 1) * h);
    place(b, 0, 0, 0);
    const a = rnd() * Math.PI * 2;
    const top = 1.1 + 0.7 * rnd();
    for (let i = 0; i < b.n; i++) {
      const y = b.x[i * 3 + 1];
      if (y < h / 2) b.pinned[i] = 1;
      const s = (y / ((rows - 1) * h)) * top;
      b.v[i * 3] = Math.cos(a) * s;
      b.v[i * 3 + 2] = Math.sin(a) * s;
    }
    return b;
  }
  const b = lattice(res, res, res, 0.7 / (res - 1), DENSITY * 0.343);
  rotate(b, sym() * 0.9, sym() * Math.PI, sym() * 0.9);
  place(b, 0, 0.8 + 0.4 * rnd(), 0);
  spin(b, [0, 0, 0], [sym() * 1.5, sym() * 1.5, sym() * 1.5]);
  return b;
}

function worldKey(w: World): string {
  return [w.gravity, w.ground, w.restitution, w.friction, w.stiffness, w.damping, w.pressure]
    .join(' ');
}

/**
 * The energy a drift is measured from. A changed world changes what the energy of the same
 * state is (stiffness scales the spring energy, gravity the potential), so the reference is
 * taken again at a release and whenever any world parameter changes.
 */
export class EnergyBaseline {
  e0 = 0;
  /** Simulated time of the last rebase. */
  since = 0;
  private key = '';

  reset(w: World, e: number, t: number): void {
    this.key = worldKey(w);
    this.e0 = e;
    this.since = t;
  }

  /** Rebase when w differs from the world of the last rebase; returns whether it did. */
  track(w: World, e: () => number, t: number): boolean {
    if (worldKey(w) === this.key) return false;
    this.reset(w, e(), t);
    return true;
  }

  /** Relative change of e since the rebase; 0 when the reference energy is 0. */
  drift(e: number): number {
    return Math.abs(this.e0) > 1e-12 ? (e - this.e0) / Math.abs(this.e0) : 0;
  }
}
