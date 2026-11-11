// The 2D wave equation u_tt = c² ∇²u on a grid of unit cells with a unit time step, by explicit
// finite differences: leapfrog in time and the five-point Laplacian in space,
//   u[n+1] = 2 u[n] − u[n−1] + C2 · (u_E + u_W + u_N + u_S − 4 u)[n],   C2 = (c·dt/dx)²,
// stable for C2 ≤ 1/2. The outer ring of cells is held at zero, wall cells are held at zero,
// and an optional sponge multiplies the new field by a factor below one near the edges.
// Pure: no p5, typed arrays only, and no randomness (a run is a function of its parameters).
//
// A sponge-damped field decays towards zero and would end in subnormal floats, which x86 runs
// far slower than normal ones (Apple silicon does not). Every stored value below FLUSH_BELOW in
// magnitude is therefore written as an exact zero: the field, and the intensity average.

/** Courant number squared, (c·dt/dx)², kept under the 2D stability limit of 1/2. */
export const C2 = 0.24;
/** Width of the absorbing sponge in cells. */
export const SPONGE = 18;
/**
 * Stored values smaller than this in magnitude are flushed to zero, far above the smallest
 * normal Float32 (1.18e-38) and far below anything the plate draws. The same threshold as
 * `flush` in src/core/budget.ts: switch to that helper once it is on main.
 */
export const FLUSH_BELOW = 1e-30;

export type Experiment = 'double' | 'single' | 'two' | 'free';

export interface Tank {
  w: number;
  h: number;
  c2: number;
  experiment: Experiment;
  /** The field now, one step ago, and the buffer the next step is written into. */
  u: Float32Array;
  prev: Float32Array;
  nxt: Float32Array;
  /** Exponential time average of u², time constant 125 steps. */
  intensity: Float32Array;
  damp: Float32Array;
  wall: Uint8Array;
  /** First column of the barrier (the slit experiments). */
  barrierX: number;
  sources: [number, number][];
  /** Steps taken. */
  step: number;
  /** Stored values below this magnitude become zero; 0 keeps every value as computed. */
  flushBelow: number;
}

export interface TankOptions {
  /** The absorbing border in cells, 0 for none (default SPONGE). */
  sponge?: number;
  /** (c·dt/dx)² (default C2). */
  c2?: number;
  /** The flush threshold (default FLUSH_BELOW); 0 turns flushing off. */
  flushBelow?: number;
}

/** True for the experiments driven by a plane wave from the left edge. */
export function planeDriven(e: Experiment): boolean {
  return e === 'double' || e === 'single';
}

/**
 * A w × h tank for an experiment: `gap` is the slit spacing (double), the opening (single) or
 * the source spacing (two). The plane experiments have no sponge on the driven left edge.
 */
export function tank(
  w: number, h: number, experiment: Experiment, gap: number, options: TankOptions = {},
): Tank {
  const sponge = options.sponge ?? SPONGE;
  const n = w * h;
  const damp = new Float32Array(n);
  const wall = new Uint8Array(n);
  const plane = planeDriven(experiment);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (sponge <= 0) {
        damp[y * w + x] = 1;
        continue;
      }
      const edge = Math.min(plane ? sponge : x, w - 1 - x, y, h - 1 - y);
      const s = Math.max(0, (sponge - edge) / sponge);
      damp[y * w + x] = 1 - 0.12 * s * s;
    }
  }
  const barrierX = Math.floor(w * 0.28);
  if (plane) {
    const mid = Math.floor(h / 2);
    const open = (y: number) => experiment === 'double'
      ? Math.abs(Math.abs(y - mid) - gap / 2) <= 2
      : Math.abs(y - mid) <= Math.max(3, gap / 4);
    for (let y = 0; y < h; y++) {
      if (open(y)) continue;
      for (let x = barrierX; x < barrierX + 3; x++) wall[y * w + x] = 1;
    }
  }
  const sources: [number, number][] = experiment === 'two'
    ? [[Math.floor(w * 0.3), Math.floor(h / 2 - gap / 2)],
      [Math.floor(w * 0.3), Math.floor(h / 2 + gap / 2)]]
    : [];
  return {
    w, h, c2: options.c2 ?? C2, experiment,
    u: new Float32Array(n),
    prev: new Float32Array(n),
    nxt: new Float32Array(n),
    intensity: new Float32Array(n),
    damp, wall, barrierX, sources,
    step: 0,
    flushBelow: options.flushBelow ?? FLUSH_BELOW,
  };
}

/** The drive's angular frequency for a wavelength in cells: ω = c·k = 2π·√C2 / λ. */
export function omega(lambda: number, c2 = C2): number {
  return (2 * Math.PI * Math.sqrt(c2)) / lambda;
}

/** One time step: drive the sources at wavelength `lambda`, update the field, average u². */
export function advance(t: Tank, lambda: number): void {
  const { w, h, c2, damp, wall, intensity, flushBelow: f } = t;
  const drive = Math.sin(omega(lambda, c2) * t.step);
  let u = t.u;
  if (planeDriven(t.experiment)) {
    for (let y = 1; y < h - 1; y++) u[y * w + 2] = drive;
  }
  for (const [sx, sy] of t.sources) u[sy * w + sx] = 1.4 * drive;
  const prev = t.prev;
  const nxt = t.nxt;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (wall[i]) {
        nxt[i] = 0;
        continue;
      }
      const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 4 * u[i];
      const v = (2 * u[i] - prev[i] + c2 * lap) * damp[i];
      nxt[i] = v < f && v > -f ? 0 : v;
    }
  }
  t.prev = u;
  t.u = nxt;
  t.nxt = prev;
  u = t.u;
  for (let i = 0; i < u.length; i++) {
    const e = intensity[i] * 0.992 + u[i] * u[i] * 0.008;
    intensity[i] = e < f ? 0 : e;
  }
  t.step++;
}

/** A Gaussian pebble of amplitude `amp` centred on cell (cx, cy); walls and the rim stay dry. */
export function drop(t: Tank, cx: number, cy: number, amp = 2.2): void {
  const { w, h, wall, u } = t;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const xx = cx + dx;
      const yy = cy + dy;
      if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
      const i = yy * w + xx;
      if (!wall[i]) u[i] += amp * Math.exp(-(dx * dx + dy * dy) / 5);
    }
  }
}
