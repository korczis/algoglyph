// A cloth of particles joined by distance constraints, after Jakobsen (Hitman, 2001).
// Position Verlet with a unit time step: the velocity is implicit in pos − prev, so
//   x[n+1] = x[n] + γ·(x[n] − x[n−1]) + a
// with a velocity damping γ and the acceleration a already multiplied by dt². Each link is then
// projected back towards its rest length, a pinned end taking none of the correction, and
// particles are pushed out of the sphere and onto the floor. Pure: no p5, typed arrays only,
// and the only randomness is the `rnd` handed to `cloth()`.

export const DAMPING = 0.995;

export type Scene = 'drape' | 'curtain' | 'corners';

export interface Sphere {
  x: number;
  y: number;
  z: number;
  r: number;
}

export interface Cloth {
  cols: number;
  rows: number;
  /** Packed xyz positions now and one step ago. */
  pos: Float64Array;
  prev: Float64Array;
  /** 1 where a particle is pinned in place. */
  pinned: Uint8Array;
  /** Link k joins particles la[k] and lb[k] at rest length rest[k]. */
  la: Uint32Array;
  lb: Uint32Array;
  rest: Float64Array;
  sphere: Sphere | null;
  /** The floor's height (y grows downwards). */
  floor: number;
  /** Steps taken. */
  t: number;
  /** Mean relative link stretch seen by the last relaxation pass. */
  strain: number;
}

export interface Forces {
  /** Gravity per step², along +y. */
  gravity: number;
  /** Peak wind per step², along +z. */
  wind: number;
  /** Relaxation passes per step. */
  iterations: number;
  damping?: number;
}

/** A res × res sheet laid out for a scene, with a tiny seeded wrinkle to break its symmetry. */
export function cloth(res: number, scene: Scene, rnd: () => number): Cloth {
  const cols = res;
  const rows = res;
  const n = cols * rows;
  const idx = (i: number, j: number) => j * cols + i;
  const pos = new Float64Array(n * 3);
  const prev = new Float64Array(n * 3);
  const pinned = new Uint8Array(n);
  const top = -rows * 0.55;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = idx(i, j) * 3;
      pos[k] = i - (cols - 1) / 2;
      if (scene === 'drape') {
        pos[k + 1] = top - 2;
        pos[k + 2] = j - (rows - 1) / 2;
      } else {
        // hung horizontally, so it swings down when released
        pos[k + 1] = top;
        pos[k + 2] = j;
      }
    }
  }
  for (let k = 0; k < n * 3; k++) pos[k] += (rnd() - 0.5) * 0.02;
  prev.set(pos);
  if (scene === 'curtain') for (let i = 0; i < cols; i++) pinned[idx(i, 0)] = 1;
  if (scene === 'corners') {
    pinned[idx(0, 0)] = 1;
    pinned[idx(cols - 1, 0)] = 1;
  }
  const m = rows * (cols - 1) + (rows - 1) * cols + 2 * (rows - 1) * (cols - 1);
  const la = new Uint32Array(m);
  const lb = new Uint32Array(m);
  const rest = new Float64Array(m);
  let count = 0;
  const link = (a: number, b: number) => {
    const dx = pos[b * 3] - pos[a * 3];
    const dy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const dz = pos[b * 3 + 2] - pos[a * 3 + 2];
    la[count] = a;
    lb[count] = b;
    rest[count] = Math.sqrt(dx * dx + dy * dy + dz * dz);
    count++;
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < cols - 1) link(idx(i, j), idx(i + 1, j));
      if (j < rows - 1) link(idx(i, j), idx(i, j + 1));
      if (i < cols - 1 && j < rows - 1) {
        link(idx(i, j), idx(i + 1, j + 1));
        link(idx(i + 1, j), idx(i, j + 1));
      }
    }
  }
  return {
    cols, rows, pos, prev, pinned, la, lb, rest,
    sphere: scene === 'drape' ? { x: 0, y: top + rows * 0.42, z: 0, r: rows * 0.24 } : null,
    floor: top + rows * 1.15,
    t: 0,
    strain: 0,
  };
}

/** One Verlet position update of every free particle; the wind is a travelling sine gust. */
export function integrate(c: Cloth, gravity: number, wind: number, damping = DAMPING): void {
  const { pos, prev, pinned } = c;
  const n = c.cols * c.rows;
  const t = c.t;
  for (let k = 0; k < n; k++) {
    if (pinned[k]) continue;
    const o = k * 3;
    const gust = wind * (0.6 + 0.4 * Math.sin(t * 0.021 + pos[o] * 0.15 + pos[o + 1] * 0.1));
    for (let d = 0; d < 3; d++) {
      const x = pos[o + d];
      const acc = d === 1 ? gravity : d === 2 ? gust : 0;
      pos[o + d] = x + (x - prev[o + d]) * damping + acc;
      prev[o + d] = x;
    }
  }
}

/** One Gauss-Seidel pass over the links; returns the mean relative stretch it found. */
export function relax(c: Cloth): number {
  const { pos, pinned, la, lb, rest } = c;
  const m = rest.length;
  let sum = 0;
  for (let k = 0; k < m; k++) {
    const pa = la[k];
    const pb = lb[k];
    const a = pa * 3;
    const b = pb * 3;
    const dx = pos[b] - pos[a];
    const dy = pos[b + 1] - pos[a + 1];
    const dz = pos[b + 2] - pos[a + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    const diff = (d - rest[k]) / d;
    sum += Math.abs(d - rest[k]) / rest[k];
    const wa = pinned[pa] ? 0 : pinned[pb] ? 1 : 0.5;
    const wb = pinned[pb] ? 0 : pinned[pa] ? 1 : 0.5;
    pos[a] += dx * diff * wa;
    pos[a + 1] += dy * diff * wa;
    pos[a + 2] += dz * diff * wa;
    pos[b] -= dx * diff * wb;
    pos[b + 1] -= dy * diff * wb;
    pos[b + 2] -= dz * diff * wb;
  }
  return m > 0 ? sum / m : 0;
}

/** Pushes particles out of the sphere and onto the floor, where friction eats most motion. */
export function collide(c: Cloth): void {
  const { pos, prev, sphere, floor } = c;
  const n = c.cols * c.rows;
  for (let k = 0; k < n; k++) {
    const o = k * 3;
    if (sphere) {
      const dx = pos[o] - sphere.x;
      const dy = pos[o + 1] - sphere.y;
      const dz = pos[o + 2] - sphere.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const r = sphere.r * 1.03;
      if (d < r && d > 0) {
        const s = r / d;
        pos[o] = sphere.x + dx * s;
        pos[o + 1] = sphere.y + dy * s;
        pos[o + 2] = sphere.z + dz * s;
      }
    }
    if (pos[o + 1] > floor) {
      pos[o + 1] = floor;
      prev[o] = pos[o] - (pos[o] - prev[o]) * 0.2;
      prev[o + 2] = pos[o + 2] - (pos[o + 2] - prev[o + 2]) * 0.2;
    }
  }
}

/** One time step: advance the clock, integrate, then relax and collide `iterations` times. */
export function step(c: Cloth, f: Forces): void {
  c.t += 1;
  integrate(c, f.gravity, f.wind, f.damping ?? DAMPING);
  for (let it = 0; it < f.iterations; it++) {
    c.strain = relax(c);
    collide(c);
  }
}
