// boids-3d's mean nearest-neighbour distance, read every frame: the shell search on its own grid
// (Grid.nearest) against the scan it replaced, copied below as it was in flock.ts. That scan read
// the perception block and, for a boid with no neighbour in it, every boid, so its cost grew with
// the radius. The two must agree bit for bit on real flocks of every size and radius, stepped
// and not. A planted change in the copied scan (dropping the every-boid fallback) must fail the
// same comparison.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { GROUNDS, mix, PALETTES, ramp, type RGB } from '../src/core/palette';
import { DEFAULT_RULES, Flock, Grid, meanNearest, type V3 } from '../src/plates/boids-3d/flock';
import { tint } from '../src/plates/boids-3d/plate';
import * as before from './fixtures/boids-3d-flock-before';

/** meanNearest as it was, with the fallback to every boid switchable for the planted control. */
function oldMeanNearest(f: Flock, cell: number, grid = new Grid(), fallback = true): number {
  const { n, pos } = f;
  if (n < 2) return 0;
  grid.build(pos, n, f.half, cell);
  const buf = new Int32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const m = grid.query(pos, i, cell, buf);
    let best = Infinity;
    const scan = m > 0 ? m : fallback ? n : 0;
    for (let k = 0; k < scan; k++) {
      const j = m > 0 ? buf[k] : k;
      if (j === i) continue;
      const d2 = (pos[j * 3] - pos[i * 3]) ** 2 + (pos[j * 3 + 1] - pos[i * 3 + 1]) ** 2
        + (pos[j * 3 + 2] - pos[i * 3 + 2]) ** 2;
      if (d2 < best) best = d2;
    }
    sum += Math.sqrt(best);
  }
  return sum / n;
}

const HALF: V3 = [1.5, 0.9, 1];

/** Pairs (new, old) over flocks of several sizes and radii, scattered and stepped. */
function readings(fallback: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (const n of [2, 3, 50, 400, 1500]) for (const radius of [0.06, 0.15, 0.3]) {
    const rules = { ...DEFAULT_RULES, radius };
    const f = new Flock(n, HALF);
    f.scatter(mulberry32(n * 31 + Math.round(radius * 100)), rules);
    for (const steps of [0, 40]) {
      for (let k = 0; k < steps; k++) f.step(rules);
      out.push([meanNearest(f, radius), oldMeanNearest(f, radius, new Grid(), fallback)]);
    }
  }
  return out;
}

describe('boids-3d: the mean nearest-neighbour distance by shells', () => {
  it('equals the scan it replaced bit for bit, every size, radius and state', () => {
    for (const [a, b] of readings(true)) expect(Object.is(a, b), `${a} vs ${b}`).toBe(true);
  });

  it('a planted change (no fallback for a boid alone in its block) fails the same comparison', () => {
    const differ = readings(false).filter(([a, b]) => !Object.is(a, b)).length;
    expect(differ).toBeGreaterThan(0);
  });
});

describe('boids-3d: each bird coloured in place', () => {
  /** Colours differing from mix(ramp(...), fg, k), over palettes, grounds, both modes and many t. */
  function differing(k: number): number {
    const rnd = mulberry32(11);
    let differ = 0;
    for (const pal of PALETTES) for (const ground of Object.values(GROUNDS)) for (const cyclic of [false, true]) {
      for (let q = 0; q < 400; q++) {
        const t = cyclic ? rnd() * 3 - 1 : rnd() * 1.4 - 0.2;
        const out: RGB = [0, 0, 0];
        tint(out, pal.stops, t, cyclic, ground.fg);
        const want = mix(ramp(pal, t, cyclic), ground.fg, k);
        if (!out.every((v, i) => Object.is(v, want[i]))) differ++;
      }
    }
    return differ;
  }

  it('writes exactly mix(ramp(pal, t, cyclic), fg, 0.14), every palette, ground and mode', () => {
    expect(differing(0.14)).toBe(0);
  });

  it('a planted change (0.15 for 0.14) fails the same comparison', () => {
    expect(differing(0.15)).toBeGreaterThan(0);
  });
});

describe('boids-3d: the step with its sums in locals', () => {
  const bytes = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

  /** The first step at which the current flock and the one before differ, or -1. */
  function lockstep(n: number, radius: number, steps: number, nudge = 0): number {
    const rules = { ...DEFAULT_RULES, separation: 3, alignment: 3, cohesion: 3, radius, maxSpeed: DEFAULT_RULES.maxSpeed };
    const a = new Flock(n, HALF); const b = new before.Flock(n, HALF);
    a.scatter(mulberry32(n + 5), rules); b.scatter(mulberry32(n + 5), rules);
    for (let k = 0; k < steps; k++) {
      a.step(rules); b.step({ ...rules, alignment: rules.alignment + nudge });
      if (!bytes(a.pos).equals(bytes(b.pos)) || !bytes(a.vel).equals(bytes(b.vel))
        || !bytes(a.crowd).equals(bytes(b.crowd)) || a.checks !== b.checks) return k;
    }
    return -1;
  }

  it('every position, velocity, crowd and check count equals the flock before, step by step', () => {
    for (const n of [50, 400, 1500]) for (const radius of [0.06, 0.3]) expect(lockstep(n, radius, 60), `${n}, ${radius}`).toBe(-1);
  });

  it('a planted change (alignment nudged by 1e−12) fails the same comparison', () => {
    expect(lockstep(400, 0.3, 60, 1e-12)).toBeGreaterThanOrEqual(0);
  });
});
