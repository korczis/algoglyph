// Feynman slice 29, ripple-tank B: the phased array, the moving source and the drum join the
// tank. The four experiments it had must step exactly as before: wave.ts as it was before this
// slice (copied below verbatim, exports dropped) and the extended module run side by side from the
// same tank, every stored float equal bit for bit after every step. A planted change (the
// two-source drive at 1.39 instead of 1.4) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import { flush } from '../src/core/budget';
import { leapfrog2d } from '../src/plates/_shared/wave2d/leapfrog';
import * as now from '../src/plates/ripple-tank/wave';
import { drumModeScheme, DRUM_H, DRUM_W } from '../src/plates/ripple-tank/measure';

/** ripple-tank's wave.ts before slice 29. */
/** Courant number squared, (c·dt/dx)², kept under the 2D stability limit of 1/2. */
const C2 = 0.24;
/** Width of the absorbing sponge in cells. */
const SPONGE = 18;

type Experiment = 'double' | 'single' | 'two' | 'free';

interface Tank {
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
  /** Stored values go through `flush`; false keeps every value as computed (tests only). */
  flush: boolean;
}

interface TankOptions {
  /** The absorbing border in cells, 0 for none (default SPONGE). */
  sponge?: number;
  /** (c·dt/dx)² (default C2). */
  c2?: number;
  /** Flush stored values below TINY to zero (default true). */
  flush?: boolean;
}

/** True for the experiments driven by a plane wave from the left edge. */
function planeDriven(e: Experiment): boolean {
  return e === 'double' || e === 'single';
}

/**
 * A w × h tank for an experiment: `gap` is the slit spacing (double), the opening (single) or
 * the source spacing (two). The plane experiments have no sponge on the driven left edge.
 */
function tank(
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
    flush: options.flush ?? true,
  };
}

/** The drive's angular frequency for a wavelength in cells: ω = c·k = 2π·√C2 / λ. */
function omega(lambda: number, c2 = C2): number {
  return (2 * Math.PI * Math.sqrt(c2)) / lambda;
}

/** One time step: drive the sources at wavelength `lambda`, update the field, average u². */
function advance(t: Tank, lambda: number): void {
  const { w, h, c2, damp, wall, intensity } = t;
  const f = t.flush;
  const drive = Math.sin(omega(lambda, c2) * t.step);
  let u = t.u;
  if (planeDriven(t.experiment)) {
    for (let y = 1; y < h - 1; y++) u[y * w + 2] = drive;
  }
  for (const [sx, sy] of t.sources) u[sy * w + sx] = 1.4 * drive;
  const prev = t.prev;
  const nxt = t.nxt;
  // the S2 stencil, shared with the string and the dispersive line (src/plates/_shared/wave2d)
  leapfrog2d(u, prev, nxt, w, h, c2, damp, wall, f);
  t.prev = u;
  t.u = nxt;
  t.nxt = prev;
  u = t.u;
  for (let i = 0; i < u.length; i++) {
    const e = intensity[i] * 0.992 + u[i] * u[i] * 0.008;
    intensity[i] = f ? flush(e) : e;
  }
  t.step++;
}

/** A Gaussian pebble of amplitude `amp` centred on cell (cx, cy); walls and the rim stay dry. */
function drop(t: Tank, cx: number, cy: number, amp = 2.2): void {
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

/** The same advance with a planted change: the point sources driven at 1.39. */
function plantedAdvance(t: Tank, lambda: number): void {
  advance(t, lambda);
  for (const [sx, sy] of t.sources) t.u[sy * t.w + sx] *= 1.39 / 1.4;
}

const bits = (a: Float32Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

/** Steps the extended tank and the pre-29 one in lockstep; the first step they differ at, or -1. */
function lockstep(step: (t: Tank, l: number) => void, experiment: Experiment, steps: number): number {
  const a = now.tank(200, 120, experiment, 24);
  const b = tank(200, 120, experiment, 24);
  now.drop(a, 150, 50); drop(b, 150, 50);
  for (let k = 0; k < steps; k++) {
    now.advance(a, 12); step(b, 12);
    if (!bits(a.u).equals(bits(b.u)) || !bits(a.prev).equals(bits(b.prev))
      || !bits(a.intensity).equals(bits(b.intensity))) return k;
  }
  return -1;
}

describe('ripple-tank B: the tank’s first four experiments are unchanged', () => {
  it('every stored float equals the module before slice 29, after every step', () => {
    for (const e of ['double', 'single', 'two', 'free'] as Experiment[]) expect(lockstep(advance, e, 400), e).toBe(-1);
  });

  it('a planted change in the two-source drive fails the same comparison within a few steps', () => {
    // at step 0 the drive is sin 0 = 0, so the change first shows at step 1
    const at = lockstep(plantedAdvance, 'two', 400);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(5);
  });
});

describe('ripple-tank B: the drum is the grid’s own eigenproblem', () => {
  it('mode (m, n), sin(mπx/a) sin(nπy/b), oscillates at drumModeScheme', () => {
    for (const [m, n] of [[1, 1], [2, 1], [3, 2]]) {
      const t = now.tank(DRUM_W, DRUM_H, 'drum', 7, { flush: false });
      const w = 2 * Math.PI * drumModeScheme(m, n, t.c2);
      const shape = (i: number) => {
        const x = i % DRUM_W; const y = Math.floor(i / DRUM_W);
        if (x === 0 || y === 0 || x === DRUM_W - 1 || y === DRUM_H - 1) return 0;
        return Math.sin((m * Math.PI * x) / (DRUM_W - 1)) * Math.sin((n * Math.PI * y) / (DRUM_H - 1));
      };
      for (let i = 0; i < t.u.length; i++) { t.u[i] = shape(i); t.prev[i] = shape(i) * Math.cos(w); }
      for (let k = 1; k <= 200; k++) now.advance(t, 12);
      const i = 17 * DRUM_W + 23;
      // float32 storage: the exact discrete solution, to single-precision rounding over 200 steps
      expect(Math.abs(t.u[i] - shape(i) * Math.cos(w * 200)), `(${m}, ${n})`).toBeLessThan(2e-4);
    }
  });
});
