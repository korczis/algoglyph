import { describe, expect, it } from 'vitest';
import {
  advance, C2 as MODULE_C2, drop, tank, type Experiment, type Tank,
} from '../src/plates/ripple-tank/wave';
import {
  CELL_STEPS_PER_FRAME as PLATE_CELL_STEPS, MAX_CELLS as PLATE_MAX_CELLS,
} from '../src/plates/ripple-tank/plate';
import { cellWithin, flush, stepsWithin, TINY } from '../src/core/budget';

// ---------------------------------------------------------------------------------------------
// The frozen reference: the simulation of src/plates/ripple-tank/plate.ts as it was on main
// before the integrator moved into wave.ts (commit ab4938d, flushed and bounded), copied
// verbatim with only the drawing removed. It is the pre-refactor oracle the module must match
// bit for bit; it is not used anywhere else.
// ---------------------------------------------------------------------------------------------

const C2 = 0.24;
const SPONGE = 18;
/** Cells in the tank at most, and cell updates (cells × steps) per frame (src/core/budget.ts). */
const MAX_CELLS = 90_000;
const CELL_STEPS_PER_FRAME = 1_200_000;

type LegacyParams = { experiment: string; lambda: number; gap: number; res: number; speed: number };

function legacyTank(params: LegacyParams, ctx: { width: number; height: number }) {
  const num = (_p: LegacyParams, k: 'lambda' | 'gap' | 'res' | 'speed') => params[k];
  const str = (_p: LegacyParams, _k: 'experiment') => params.experiment;
  let w = 0;
  let h = 0;
  let res = 3;
  let u!: Float32Array;
  let prev!: Float32Array;
  let nxt!: Float32Array;
  let intensity!: Float32Array;
  let damp!: Float32Array;
  let wall!: Uint8Array;
  let step = 0;
  let experiment = 'double';
  let sources: [number, number][] = [];

  const drop = (x: number, y: number, amp = 2.2) => {
    const cx = Math.floor(x / res);
    const cy = Math.floor(y / res);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
        const i = yy * w + xx;
        if (!wall[i]) u[i] += amp * Math.exp(-(dx * dx + dy * dy) / 5);
      }
    }
  };

  return {
    state: () => ({ u, prev, intensity, w, h, step }),
    setup() {
      res = cellWithin(ctx.width, ctx.height, num(params, 'res'), MAX_CELLS);
      w = Math.floor(ctx.width / res);
      h = Math.floor(ctx.height / res);
      u = new Float32Array(w * h);
      prev = new Float32Array(w * h);
      nxt = new Float32Array(w * h);
      intensity = new Float32Array(w * h);
      damp = new Float32Array(w * h);
      wall = new Uint8Array(w * h);
      experiment = str(params, 'experiment');
      const plane = experiment === 'double' || experiment === 'single';
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const edge = Math.min(plane ? SPONGE : x, w - 1 - x, y, h - 1 - y);
          const s = Math.max(0, (SPONGE - edge) / SPONGE);
          damp[y * w + x] = 1 - 0.12 * s * s;
        }
      }
      const gap = num(params, 'gap');
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
      sources = experiment === 'two'
        ? [[Math.floor(w * 0.3), Math.floor(h / 2 - gap / 2)],
          [Math.floor(w * 0.3), Math.floor(h / 2 + gap / 2)]]
        : [];
      step = 0;
    },
    pressed(x: number, y: number) {
      drop(x, y);
    },
    dragged(x: number, y: number) {
      drop(x, y, 0.9);
    },
    /** The simulation half of the old draw(). */
    draw() {
      const omega = (2 * Math.PI * Math.sqrt(C2)) / num(params, 'lambda');
      const steps = stepsWithin(num(params, 'speed'), w * h, CELL_STEPS_PER_FRAME);
      for (let s = 0; s < steps; s++) {
        const drive = Math.sin(omega * step);
        if (experiment === 'double' || experiment === 'single') {
          for (let y = 1; y < h - 1; y++) u[y * w + 2] = drive;
        }
        for (const [sx, sy] of sources) u[sy * w + sx] = 1.4 * drive;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (wall[i]) {
              nxt[i] = 0;
              continue;
            }
            const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 4 * u[i];
            // flushed: the sponge decays waves into subnormal floats, slow on x86 (src/core/budget.ts)
            nxt[i] = flush((2 * u[i] - prev[i] + C2 * lap) * damp[i]);
          }
        }
        const t = prev;
        prev = u;
        u = nxt;
        nxt = t;
        for (let i = 0; i < u.length; i++) intensity[i] = flush(intensity[i] * 0.992 + u[i] * u[i] * 0.008);
        step++;
      }
    },
  };
}

// --- end of the frozen reference ------------------------------------------------------------

function sameBits(a: Float32Array, b: Float32Array): boolean {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength)
    .equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
}

describe('ripple-tank: wave.ts reproduces the pre-refactor plate bit for bit', () => {
  const cases: [string, LegacyParams, number][] = [
    ['default double slit',
      { experiment: 'double', lambda: 14, gap: 34, res: 3, speed: 3 }, 400],
    ['single slit at the maxima',
      { experiment: 'single', lambda: 40, gap: 80, res: 6, speed: 8 }, 400],
    ['two sources at the minima',
      { experiment: 'two', lambda: 6, gap: 6, res: 2, speed: 1 }, 400],
    ['free surface with pebbles',
      { experiment: 'free', lambda: 20, gap: 30, res: 2, speed: 5 }, 400],
    ['double slit at a desktop width, finest cells (grid bounded)',
      { experiment: 'double', lambda: 14, gap: 34, res: 2, speed: 8 }, 1440],
  ];
  for (const [name, params, W] of cases) {
    it(`${name}: same field, previous field and intensity after every frame`, () => {
      const H = Math.round(W / 1.6);
      const lp = { ...params };
      const old = legacyTank(lp, { width: W, height: H });
      old.setup();
      const p = { ...params };
      // what plate.ts does with the module: bound the cells, then the steps per frame
      const res = cellWithin(W, H, p.res, PLATE_MAX_CELLS);
      const t: Tank = tank(
        Math.floor(W / res), Math.floor(H / res), p.experiment as Experiment, p.gap,
      );
      for (let f = 0; f < 200; f++) {
        // pebbles (one on the barrier) and a slider drag mid-run, applied to both runs
        if (f % 37 === 5) {
          const x = (f * 53) % W;
          const y = (f * 29) % H;
          old.pressed(x, y);
          drop(t, Math.floor(x / res), Math.floor(y / res));
        }
        if (f === 60) {
          const x = Math.floor(W * 0.28) + 1;
          old.dragged(x, H / 2 + 7);
          drop(t, Math.floor(x / res), Math.floor((H / 2 + 7) / res), 0.9);
        }
        if (f === 100) {
          for (const q of [lp, p]) {
            q.lambda = Math.min(40, q.lambda + 5);
            q.speed = 9 - q.speed;
          }
        }
        old.draw();
        const steps = stepsWithin(p.speed, t.w * t.h, PLATE_CELL_STEPS);
        for (let s = 0; s < steps; s++) advance(t, p.lambda);
        const o = old.state();
        if (!sameBits(t.u, o.u) || !sameBits(t.prev, o.prev) || !sameBits(t.intensity, o.intensity)
          || t.step !== o.step) {
          throw new Error(`${name}: state diverged at frame ${f}`);
        }
      }
      expect(t.w).toBe(old.state().w);
      expect(t.h).toBe(old.state().h);
      expect(sameBits(t.u, old.state().u)).toBe(true);
    });
  }
});

describe('ripple-tank: flushing tiny values to zero', () => {
  it('changes a driven run only at the level of float32 rounding', () => {
    // values below TINY are set to zero; float32 rounding then carries that difference
    // through the run, but it stays orders of magnitude below the field
    const exact = tank(160, 100, 'double', 30, { flush: false });
    const flushed = tank(160, 100, 'double', 30);
    let peak = 0;
    let diff = 0;
    for (let s = 0; s < 3000; s++) {
      advance(exact, 14);
      advance(flushed, 14);
    }
    for (let i = 0; i < exact.u.length; i++) {
      peak = Math.max(peak, Math.abs(exact.u[i]));
      diff = Math.max(diff, Math.abs(exact.u[i] - flushed.u[i]));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(diff).toBeLessThanOrEqual(1e-4 * peak);
  });

  it('leaves no subnormal float in the stored state through a long undriven run', () => {
    // the smallest normal float32 is 2^-126; anything non-zero below it is subnormal, and x86
    // runs arithmetic on those far slower. They appear where values decay towards zero: ahead
    // of every wavefront (the five-point stencil leaks exponentially small values one cell per
    // step) and in the squares of those values in the intensity average.
    const MIN_NORMAL = 2 ** -126;
    const subnormals = (t: Tank) => {
      let n = 0;
      for (const a of [t.u, t.prev, t.intensity]) {
        for (let i = 0; i < a.length; i++) if (a[i] !== 0 && Math.abs(a[i]) < MIN_NORMAL) n++;
      }
      return n;
    };
    const run = (options: { flush?: boolean }) => {
      // the free surface has no drive: two pebbles spread, reflect and decay in the sponge
      const t = tank(200, 150, 'free', 0, options);
      drop(t, 100, 75);
      drop(t, 60, 40, 1.5);
      let seen = 0;
      for (let s = 0; s < 3000; s++) {
        advance(t, 14);
        if (s % 5 === 0 || s === 2999) seen = Math.max(seen, subnormals(t));
      }
      return seen;
    };
    // without the flush the same run does reach subnormals, so the check has teeth
    expect(run({ flush: false })).toBeGreaterThan(0);
    expect(run({})).toBe(0);
    expect(TINY).toBeGreaterThan(MIN_NORMAL);
  });
});

// ---------------------------------------------------------------------------------------------
// Physics, against references written here: the discrete energy of the leapfrog scheme, the
// numerical dispersion relation of the five-point stencil, and Young's fringe condition.
// ---------------------------------------------------------------------------------------------

/**
 * The energy the leapfrog scheme conserves exactly (up to rounding) with fixed zero boundaries:
 *   E = ½ Σ (u[n+1] − u[n])² + ½ C2 Σ_edges (u[n+1]_a − u[n+1]_b)(u[n]_a − u[n]_b)
 * over every pair of neighbouring cells (a, b).
 */
function leapfrogEnergy(t: Tank, c2: number): number {
  const { w, h, u, prev } = t;
  let kinetic = 0;
  let strain = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = u[i] - prev[i];
      kinetic += v * v;
      if (x + 1 < w) strain += (u[i] - u[i + 1]) * (prev[i] - prev[i + 1]);
      if (y + 1 < h) strain += (u[i] - u[i + w]) * (prev[i] - prev[i + w]);
    }
  }
  return 0.5 * kinetic + 0.5 * c2 * strain;
}

/** Zero crossings along a row, each placed by linear interpolation between its two cells. */
function zeroCrossings(row: Float32Array, from: number, to: number): number[] {
  const out: number[] = [];
  for (let x = from; x < to; x++) {
    const a = row[x];
    const b = row[x + 1];
    if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) out.push(x + a / (a - b));
  }
  return out;
}

/** Least-squares slope of ys against their index. */
function slope(ys: number[]): number {
  const n = ys.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  ys.forEach((y, i) => {
    sx += i;
    sy += y;
    sxx += i * i;
    sxy += i * y;
  });
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

function bilinear(w: number, a: Float64Array, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  return a[i] * (1 - fx) * (1 - fy) + a[i + 1] * fx * (1 - fy)
    + a[i + w] * (1 - fx) * fy + a[i + w + 1] * fx * fy;
}

describe('ripple-tank: the wave equation integrated', () => {
  it('runs at C2 = 0.24, under the 2D stability limit of 1/2', () => {
    expect(MODULE_C2).toBe(0.24);
    expect(MODULE_C2).toBeLessThan(0.5);
  });

  it('keeps the discrete energy bounded over many steps with no sponge and no drive', () => {
    const t = tank(120, 90, 'free', 0, { sponge: 0 });
    drop(t, 60, 45);
    drop(t, 30, 20, 1.2);
    advance(t, 14);
    const e0 = leapfrogEnergy(t, 0.24);
    let worst = 0;
    let peak = 0;
    for (let s = 0; s < 6000; s++) {
      advance(t, 14);
      if (s % 50 === 0) worst = Math.max(worst, Math.abs(leapfrogEnergy(t, 0.24) - e0) / e0);
    }
    for (const v of t.u) peak = Math.max(peak, Math.abs(v));
    expect(e0).toBeGreaterThan(0);
    expect(worst).toBeLessThan(1e-3);
    expect(peak).toBeLessThan(3);
  });
  it('the same check fails above the limit (C2 = 0.55 grows without bound)', () => {
    const t = tank(120, 90, 'free', 0, { sponge: 0, c2: 0.55 });
    drop(t, 60, 45);
    advance(t, 14);
    const e0 = leapfrogEnergy(t, 0.55);
    let ratio = 1;
    for (let s = 0; s < 300 && ratio < 1e6; s++) {
      advance(t, 14);
      ratio = Math.abs(leapfrogEnergy(t, 0.55)) / e0;
    }
    expect(ratio).toBeGreaterThan(1e6);
  });

  // A driven plane wave, measured before its front reaches the barrier (no reflection yet) on
  // a grid tall enough that the sponged top and bottom edges do not reach the middle row.
  // The five-point stencil with leapfrog obeys sin²(ω/2) = C2·(sin²(kx/2) + sin²(ky/2)), not
  // ω = c·k: driven at ω = 2π·√C2/λ, the wave along x has the numerical wavelength
  //   λ_num = 2π / k,  k = 2·asin(sin(ω/2) / √C2),
  // a little shorter than λ, the more so the fewer cells per wavelength.
  for (const lambda of [6, 14, 24]) {
    it(`a plane wave driven at λ = ${lambda} cells has it, net of the stencil's dispersion`, () => {
      const w = 700;
      const h = 400;
      const t = tank(w, h, 'single', 20);
      const c = Math.sqrt(0.24);
      const om = (2 * Math.PI * c) / lambda;
      const k = 2 * Math.asin(Math.sin(om / 2) / c);
      const lambdaNum = (2 * Math.PI) / k;
      const group = (c * Math.cos(k / 2)) / Math.cos(om / 2);
      const steps = Math.floor((t.barrierX - 10) / group);
      for (let s = 0; s < steps; s++) advance(t, lambda);
      const y = Math.floor(h / 2);
      const row = t.u.subarray(y * w, (y + 1) * w);
      const front = 2 + group * steps;
      const xs = zeroCrossings(row, 8, Math.floor(front - 3 * lambda));
      expect(xs.length).toBeGreaterThanOrEqual(3);
      const measured = 2 * slope(xs);
      expect(Math.abs(measured - lambdaNum) / lambdaNum).toBeLessThan(0.005);
      expect(Math.abs(measured - lambda) / lambda).toBeLessThan(0.05);
      // at six cells per wavelength the dispersion is visible: closer to λ_num than to λ
      if (lambda === 6) expect(Math.abs(measured - lambda) / lambda).toBeGreaterThan(0.03);
    });
  }

  it("the double slit's time-averaged intensity peaks where sin θ = mλ/d", () => {
    const lambda = 10;
    const d = 40;
    const R = 220;
    const w = 520;
    const h = 420;
    const t = tank(w, h, 'double', d);
    for (let s = 0; s < 1400; s++) advance(t, lambda);
    // the time average of u² over about thirty drive periods, taken here
    const mean = new Float64Array(w * h);
    for (let s = 0; s < 600; s++) {
      advance(t, lambda);
      for (let i = 0; i < mean.length; i++) mean[i] += t.u[i] * t.u[i];
    }
    const ox = t.barrierX + 1.5;
    const oy = Math.floor(h / 2);
    const at = (deg: number) => {
      const th = (deg * Math.PI) / 180;
      return bilinear(w, mean, ox + R * Math.cos(th), oy + R * Math.sin(th));
    };
    const angle = (s: number) => (Math.asin(s) * 180) / Math.PI;
    const maxima: number[] = [];
    for (const m of [-2, -1, 0, 1, 2]) {
      const predicted = angle((m * lambda) / d);
      let best = predicted;
      for (let deg = predicted - 5; deg <= predicted + 5; deg += 0.25) {
        if (at(deg) > at(best)) best = deg;
      }
      expect(Math.abs(best - predicted), `order ${m}: peak at ${best}°, predicted ${predicted}°`)
        .toBeLessThanOrEqual(1);
      maxima.push(at(best));
    }
    // and dark fringes between them, where the path difference is half a wavelength
    for (const m of [-2, -1, 0, 1]) {
      const dark = at(angle(((m + 0.5) * lambda) / d));
      expect(dark).toBeLessThan(0.35 * Math.min(maxima[m + 2], maxima[m + 3]));
    }
  });
  it('keeps every wall cell at zero, pebbles dropped on the barrier included', () => {
    const t = tank(240, 150, 'double', 34);
    let walls = 0;
    for (const v of t.wall) walls += v;
    expect(walls).toBeGreaterThan(0);
    for (let s = 0; s < 1500; s++) {
      if (s % 100 === 0) drop(t, t.barrierX + 1, 20 + (s % 110));
      advance(t, 12);
    }
    for (let i = 0; i < t.wall.length; i++) {
      if (!t.wall[i]) continue;
      if (t.u[i] !== 0 || t.prev[i] !== 0 || t.intensity[i] !== 0) {
        throw new Error(`wall cell ${i} moved`);
      }
    }
  });
});
