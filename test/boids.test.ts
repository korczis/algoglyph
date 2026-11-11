import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { DEFAULT_RULES, Flock, Grid, meanNearest, polarisation, type Rules, type V3 }
  from '../src/plates/boids/flock';

const HALF: V3 = [1.5, 0.9, 1];

function flock(n: number, seed: number, rules: Rules = DEFAULT_RULES): Flock {
  const f = new Flock(n, HALF);
  f.scatter(mulberry32(seed), rules);
  return f;
}

function bruteNeighbours(pos: Float64Array, n: number, i: number, r: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    const d = Math.hypot(pos[j * 3] - pos[i * 3], pos[j * 3 + 1] - pos[i * 3 + 1],
      pos[j * 3 + 2] - pos[i * 3 + 2]);
    if (d < r) out.push(j);
  }
  return out;
}

function minPairDistance(pos: Float64Array, n: number): number {
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      best = Math.min(best, Math.hypot(pos[j * 3] - pos[i * 3], pos[j * 3 + 1] - pos[i * 3 + 1],
        pos[j * 3 + 2] - pos[i * 3 + 2]));
    }
  }
  return best;
}

function speeds(f: Flock): number[] {
  return Array.from({ length: f.n }, (_, i) =>
    Math.hypot(f.vel[i * 3], f.vel[i * 3 + 1], f.vel[i * 3 + 2]));
}

describe('boids', () => {
  it('the grid query returns exactly the brute-force neighbour set', () => {
    for (const [seed, n, r] of [[1, 300, 0.16], [2, 800, 0.08], [3, 120, 0.45], [4, 50, 1.7]]) {
      const f = flock(n, seed);
      // pile a few boids on cell boundaries and box corners, where an off-by-one would show
      f.pos.set([-1.5, -0.9, -1, 1.5, 0.9, 1, 0, 0, 0, r, 0, 0], 0);
      const g = new Grid();
      g.build(f.pos, n, HALF, r);
      const out = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const m = g.query(f.pos, i, r, out);
        const got = Array.from(out.subarray(0, m)).sort((a, b) => a - b);
        expect(got).toEqual(bruteNeighbours(f.pos, n, i, r));
      }
    }
  });

  it('the grid checks far fewer pairs than all N(N − 1)', () => {
    const f = flock(1500, 5);
    f.step(DEFAULT_RULES);
    expect(f.checks).toBeLessThan(0.05 * 1500 * 1499);
  });

  it('mean nearest-neighbour distance matches a brute-force scan', () => {
    const f = flock(400, 6);
    let sum = 0;
    for (let i = 0; i < f.n; i++) {
      let best = Infinity;
      for (let j = 0; j < f.n; j++) {
        if (j === i) continue;
        best = Math.min(best, Math.hypot(f.pos[j * 3] - f.pos[i * 3],
          f.pos[j * 3 + 1] - f.pos[i * 3 + 1], f.pos[j * 3 + 2] - f.pos[i * 3 + 2]));
      }
      sum += best;
    }
    // a small cell forces the fallback scan for isolated boids
    expect(meanNearest(f, 0.05)).toBeCloseTo(sum / f.n, 12);
    expect(meanNearest(f, 0.3)).toBeCloseTo(sum / f.n, 12);
  });

  it('polarisation is 1 for parallel headings and near 0 for random ones', () => {
    const f = flock(2000, 7);
    expect(polarisation(f)).toBeLessThan(0.08);
    for (let i = 0; i < f.n; i++) f.vel.set([0.3 + i * 1e-4, 0, 0], i * 3);
    expect(polarisation(f)).toBeCloseTo(1, 12);
  });

  it('alignment alone orders a random flock; with no rules the disorder stays', () => {
    const rules = { ...DEFAULT_RULES, separation: 0, cohesion: 0, alignment: 1, radius: 0.3 };
    const none = { ...rules, alignment: 0 };
    for (const seed of [8, 20, 21, 22, 23]) {
      // a dense ball in a big box, so 120 steps never reach a wall that would turn the boids
      const big: V3 = [5, 5, 5];
      const f = new Flock(400, big);
      const g = new Flock(400, big);
      f.scatter(mulberry32(seed), rules);
      g.scatter(mulberry32(seed), rules);
      for (let i = 0; i < f.n * 3; i++) {
        f.pos[i] /= 9;
        g.pos[i] /= 9;
      }
      const before = polarisation(f);
      for (let s = 0; s < 120; s++) {
        f.step(rules);
        g.step(none);
      }
      expect(before).toBeLessThan(0.1);
      expect(polarisation(f)).toBeGreaterThan(Math.max(0.25, 5 * before));
      expect(polarisation(g)).toBeCloseTo(before, 9);
    }
  });

  it('separation alone spreads a clustered start', () => {
    const rules = { ...DEFAULT_RULES, separation: 1, cohesion: 0, alignment: 0 };
    for (const seed of [9, 30, 31]) {
      const f = flock(120, seed, rules);
      const rnd = mulberry32(seed + 90);
      for (let i = 0; i < f.n * 3; i++) f.pos[i] = (rnd() - 0.5) * 0.12;
      const before = minPairDistance(f.pos, f.n);
      for (let s = 0; s < 600; s++) f.step(rules);
      expect(minPairDistance(f.pos, f.n)).toBeGreaterThan(before * 5);
    }
  });

  it('stronger separation opens the mean nearest-neighbour distance', () => {
    const spacing = (separation: number) => {
      const rules = { ...DEFAULT_RULES, separation };
      const f = flock(500, 13, rules);
      for (let s = 0; s < 400; s++) f.step(rules);
      return meanNearest(f, rules.radius);
    };
    expect(spacing(3)).toBeGreaterThan(5 * spacing(0.3));
  });

  it('speeds stay within [floor, max] and boids stay in the box', () => {
    const rules = { ...DEFAULT_RULES, separation: 3, alignment: 2, cohesion: 3 };
    const f = flock(600, 10, rules);
    for (let s = 0; s < 300; s++) {
      f.step(rules);
      for (const v of speeds(f)) {
        expect(v).toBeLessThanOrEqual(rules.maxSpeed * (1 + 1e-12));
        expect(v).toBeGreaterThanOrEqual(rules.maxSpeed * rules.minSpeed * (1 - 1e-12));
      }
    }
    for (let i = 0; i < f.n; i++) {
      for (let d = 0; d < 3; d++) expect(Math.abs(f.pos[i * 3 + d])).toBeLessThanOrEqual(HALF[d]);
    }
  });

  it('is reproducible for a fixed seed', () => {
    const a = flock(400, 11);
    const b = flock(400, 11);
    const c = flock(400, 12);
    for (let s = 0; s < 200; s++) {
      a.step(DEFAULT_RULES);
      b.step(DEFAULT_RULES);
      c.step(DEFAULT_RULES);
    }
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
    expect(Array.from(a.vel)).toEqual(Array.from(b.vel));
    expect(Array.from(a.pos)).not.toEqual(Array.from(c.pos));
  });
});
