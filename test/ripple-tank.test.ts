import { describe, expect, it } from 'vitest';
import {
  advance, drop, FLUSH_BELOW, tank, type Experiment, type Tank,
} from '../src/plates/ripple-tank/wave';

// ---------------------------------------------------------------------------------------------
// The frozen reference: the simulation of src/plates/ripple-tank/plate.ts as it was before the
// integrator moved into wave.ts, copied verbatim with only the drawing removed. It is the
// pre-refactor oracle the module must match bit for bit; it is not used anywhere else.
// ---------------------------------------------------------------------------------------------

const C2 = 0.24;
const SPONGE = 18;

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
      res = num(params, 'res');
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
      const steps = num(params, 'speed');
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
            nxt[i] = (2 * u[i] - prev[i] + C2 * lap) * damp[i];
          }
        }
        const t = prev;
        prev = u;
        u = nxt;
        nxt = t;
        for (let i = 0; i < u.length; i++) intensity[i] = intensity[i] * 0.992 + u[i] * u[i] * 0.008;
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
  const W = 400;
  const H = 250;
  const cases: [string, LegacyParams][] = [
    ['default double slit', { experiment: 'double', lambda: 14, gap: 34, res: 3, speed: 3 }],
    ['single slit at the maxima', { experiment: 'single', lambda: 40, gap: 80, res: 6, speed: 8 }],
    ['two sources at the minima', { experiment: 'two', lambda: 6, gap: 6, res: 2, speed: 1 }],
    ['free surface with pebbles', { experiment: 'free', lambda: 20, gap: 30, res: 2, speed: 5 }],
  ];
  for (const [name, params] of cases) {
    it(`${name}: same field, previous field and intensity after every frame`, () => {
      const lp = { ...params };
      const old = legacyTank(lp, { width: W, height: H });
      old.setup();
      const p = { ...params };
      const res = p.res;
      // flushing off: the pre-refactor code kept subnormals, and the oracle is bit for bit
      const t: Tank = tank(Math.floor(W / res), Math.floor(H / res), p.experiment as Experiment, p.gap,
        { flushBelow: 0 });
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
        for (let s = 0; s < p.speed; s++) advance(t, p.lambda);
        const o = old.state();
        if (!sameBits(t.u, o.u) || !sameBits(t.prev, o.prev) || !sameBits(t.intensity, o.intensity)
          || t.step !== o.step) {
          throw new Error(`${name}: state diverged at frame ${f}`);
        }
      }
      expect(t.w).toBe(old.state().w);
      expect(t.h).toBe(old.state().h);
      expect(sameBits(t.u, old.state().u)).toBe(true);
    }, 60000);
  }
});

describe('ripple-tank: flushing tiny values to zero', () => {
  it('changes a driven run only at the level of float32 rounding', () => {
    // values below FLUSH_BELOW are set to zero; float32 rounding then carries that difference
    // through the run, but it stays orders of magnitude below the field
    const exact = tank(160, 100, 'double', 30, { flushBelow: 0 });
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
    const run = (options: { flushBelow?: number }) => {
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
    expect(run({ flushBelow: 0 })).toBeGreaterThan(0);
    expect(run({})).toBe(0);
    expect(FLUSH_BELOW).toBeGreaterThan(MIN_NORMAL);
  }, 60000);
});

