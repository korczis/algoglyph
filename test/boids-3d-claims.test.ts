// boids-3d (wave 6): the pair checks of the first step, from the grid's geometry. The plate
// scatters the boids uniformly over [−0.9·half, 0.9·half] on each axis, and the grid's cells are
// at least one radius wide: nx = ⌊2·half_x / r⌋ cells of width 2·half_x / nx, and so on. A boid
// checks every other boid in the 3 × 3 × 3 block of cells around its own (clamped at the faces),
// so for an ordered pair the chance of a check is Π P_axis, P_axis = Σ_c p_c (p_(c−1) + p_c +
// p_(c+1)), p_c the share of the scatter interval in cell c: the coordinates of a boid are drawn
// independently, so E = N(N − 1)·Π P_axis. The sd comes from a named seed set disjoint from the
// claims' seed 4242.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { DEFAULT_RULES, Flock, polarisation, type V3 } from '../src/plates/boids-3d/flock';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'boids-3d';
const CHECKS = 'pair checks / step';
const HALF: V3 = [1.5, 0.9, 1];
const CLAIM_SEED = 4242;
/** The seeds the sd is measured on: 1 … 400, disjoint from the claims' 4242. */
const SD_SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);

const probe = (readout: string, params: Params, seed?: number): Claim => ({
  id: 'probe', statement: 'a claims test reading', readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params, ...(seed ? { seed } : {}) },
});

/** P_axis: the chance that two uniform scatter points lie in the same or adjacent cells. */
function pAxis(half: number, r: number): number {
  const k = Math.max(1, Math.floor((2 * half) / r));
  const w = (2 * half) / k;
  const lo = -0.9 * half;
  const hi = 0.9 * half;
  const p = Array.from({ length: k }, (_, c) => {
    const a = Math.max(lo, c * w - half);
    const b = Math.min(hi, (c + 1) * w - half);
    return Math.max(0, b - a) / (hi - lo);
  });
  return p.reduce((s, pc, c) => s + pc * ((p[c - 1] ?? 0) + pc + (p[c + 1] ?? 0)), 0);
}
const expected = (n: number, r: number) => n * (n - 1) * HALF.reduce((s, h) => s * pAxis(h, r), 1);

/** The first step's pair checks for `seed`, as the plate scatters and steps its flock. */
function firstChecks(n: number, r: number, seed: number): number {
  const rules = { ...DEFAULT_RULES, radius: r };
  const f = new Flock(n, HALF);
  f.scatter(mulberry32(seed), rules);
  f.step(rules);
  return f.checks;
}

/** N, radius, E, and the sd measured over SD_SEEDS (pinned to within 1 %). */
const CASES: [number, number, number, number][] = [
  [800, 0.16, 8050.16, 195.6],
  [1500, 0.16, 28317.86, 443.2],
  [800, 0.3, 43175.88, 1059.4],
];

describe('boids-3d: the first step\'s pair checks against the grid\'s geometry', () => {
  it('E = N(N − 1)·Π P_axis, from the cells and the scatter interval', () => {
    for (const [n, r, e] of CASES) expect(expected(n, r), `N ${n}, r ${r}`).toBeCloseTo(e, 1);
    // the default grid: 18 × 11 × 12 cells
    expect([1.5, 0.9, 1].map((h) => Math.floor((2 * h) / 0.16))).toEqual([18, 11, 12]);
  });

  it('the plate reads the flock replayed from the seed, step 1', async () => {
    for (const [n, r] of CASES) {
      const want = firstChecks(n, r, CLAIM_SEED);
      const got = await read(ID, probe(CHECKS, { n, radius: r, runs: 1 }));
      expect(got.reason).toBeUndefined();
      expect(got.value, `N ${n}, r ${r}`).toBe(want);
    }
  });

  it('over the named seed set the mean is E within 4 sd/√400, and the sd is the pinned one', () => {
    expect(SD_SEEDS).not.toContain(CLAIM_SEED);
    for (const [n, r, e, sd] of CASES) {
      const x = SD_SEEDS.map((s) => firstChecks(n, r, s));
      const m = x.reduce((a, b) => a + b, 0) / x.length;
      const v = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
      expect(Math.abs(m - e), `N ${n}, r ${r}: mean ${m}`).toBeLessThan((4 * v) / Math.sqrt(x.length));
      expect(Math.abs(v / sd - 1), `N ${n}, r ${r}: sd ${v}`).toBeLessThan(0.01);
    }
  });

  it('the claims\' seed reads within 4 sd of E, and below N(N − 1)', async () => {
    for (const [n, r, e, sd] of CASES) {
      const got = (await read(ID, probe(CHECKS, { n, radius: r, runs: 1 }))).value!;
      expect(Math.abs(got - e), `N ${n}, r ${r}: ${got}`).toBeLessThanOrEqual(4 * sd);
      expect(got).toBeLessThan(n * (n - 1));
    }
  });
});

describe('boids-3d: alignment alone does not order the swarm', () => {
  it('with separation and cohesion at 0, the polarisation after 3000 steps stays below 0.5', () => {
    const rules = { ...DEFAULT_RULES, separation: 0, cohesion: 0 };
    const f = new Flock(800, HALF);
    f.scatter(mulberry32(CLAIM_SEED), rules);
    for (let s = 0; s < 3000; s++) f.step(rules);
    expect(polarisation(f)).toBeLessThan(0.5);
  });
});
