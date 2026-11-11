import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  accelerate, bodies, QuadTree, treeAccel, type Bodies,
} from '../src/plates/barnes-hut/quadtree';

const G = 1;
const EPS = 0.01;

function cloud(n: number, seed: number): Bodies {
  const rnd = mulberry32(seed);
  const b = bodies(n);
  for (let i = 0; i < n; i++) {
    // a clumpy distribution: half uniform, half in a tight knot, so the tree gets deep
    const knot = i % 2 === 0;
    b.x[i] = knot ? 0.3 + 0.05 * rnd() : rnd() * 2 - 1;
    b.y[i] = knot ? -0.2 + 0.05 * rnd() : rnd() * 2 - 1;
    b.m[i] = 0.5 + rnd();
  }
  return b;
}

// Independent reference: plain O(n²) softened Newtonian sum, written here, not imported.
function brute(b: Bodies, i: number): [number, number] {
  let ax = 0;
  let ay = 0;
  for (let j = 0; j < b.n; j++) {
    if (j === i) continue;
    const dx = b.x[j] - b.x[i];
    const dy = b.y[j] - b.y[i];
    const r = Math.sqrt(dx * dx + dy * dy + EPS * EPS);
    ax += (G * b.m[j] * dx) / (r * r * r);
    ay += (G * b.m[j] * dy) / (r * r * r);
  }
  return [ax, ay];
}

function meanError(b: Bodies, theta: number, sample: number[]): number {
  const t = new QuadTree();
  t.build(b);
  const out = new Float64Array(2);
  let sum = 0;
  for (const i of sample) {
    treeAccel(t, b, i, theta, G, EPS, out);
    const [rx, ry] = brute(b, i);
    sum += Math.hypot(out[0] - rx, out[1] - ry) / Math.hypot(rx, ry);
  }
  return sum / sample.length;
}

describe('Barnes–Hut quadtree', () => {
  it('with θ = 0 equals direct summation within 1e-9 relative, with N − 1 interactions', () => {
    const b = cloud(400, 7);
    const t = new QuadTree();
    const total = accelerate(t, b, 0, G, EPS);
    expect(total).toBe(b.n * (b.n - 1));
    for (let i = 0; i < b.n; i++) {
      const [rx, ry] = brute(b, i);
      const err = Math.hypot(b.ax[i] - rx, b.ay[i] - ry) / Math.hypot(rx, ry);
      expect(err).toBeLessThan(1e-9);
    }
  });

  it('the force error grows with θ (0.3 < 0.7 < 1.0) on a fixed random set', () => {
    const b = cloud(1500, 11);
    const rnd = mulberry32(3);
    const sample = Array.from({ length: 64 }, () => Math.floor(rnd() * b.n));
    const e03 = meanError(b, 0.3, sample);
    const e07 = meanError(b, 0.7, sample);
    const e10 = meanError(b, 1.0, sample);
    expect(e03).toBeGreaterThan(0);
    expect(e03).toBeLessThan(e07);
    expect(e07).toBeLessThan(e10);
    expect(e10).toBeLessThan(0.05);
  });

  it('the root holds the total mass at the mass-weighted mean position', () => {
    const b = cloud(1000, 5);
    const t = new QuadTree();
    t.build(b);
    let M = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < b.n; i++) {
      M += b.m[i];
      sx += b.m[i] * b.x[i];
      sy += b.m[i] * b.y[i];
    }
    expect(Math.abs(t.mass[0] - M) / M).toBeLessThan(1e-12);
    expect(Math.abs(t.comX[0] - sx / M)).toBeLessThan(1e-12);
    expect(Math.abs(t.comY[0] - sy / M)).toBeLessThan(1e-12);
    // every internal node's mass is the sum of its four children's
    for (let k = 0; k < t.nodes; k++) {
      const c = t.child[k];
      if (c < 0) continue;
      const kids = t.mass[c] + t.mass[c + 1] + t.mass[c + 2] + t.mass[c + 3];
      expect(Math.abs(t.mass[k] - kids)).toBeLessThan(1e-12 * M);
    }
  });

  it('files every body in exactly one leaf, inside that leaf\'s square', () => {
    const b = cloud(2000, 13);
    // two coincident bodies must still each land in exactly one leaf
    b.x[1] = b.x[0];
    b.y[1] = b.y[0];
    const t = new QuadTree();
    t.build(b);
    const seen = new Int32Array(b.n);
    for (let k = 0; k < t.nodes; k++) {
      if (t.child[k] >= 0) {
        expect(t.first[k]).toBe(-1);
        continue;
      }
      let count = 0;
      for (let i = t.first[k]; i >= 0; i = t.next[i]) {
        seen[i]++;
        count++;
        expect(Math.abs(b.x[i] - t.cx[k])).toBeLessThanOrEqual(t.half[k]);
        expect(Math.abs(b.y[i] - t.cy[k])).toBeLessThanOrEqual(t.half[k]);
      }
      expect(count).toBe(t.count[k]);
    }
    expect(Array.from(seen).every((s) => s === 1)).toBe(true);
  });

  it('at θ = 0.7 and N = 2000 each body needs far fewer than N − 1 interactions', () => {
    const b = cloud(2000, 17);
    const t = new QuadTree();
    const perBody = accelerate(t, b, 0.7, G, EPS) / b.n;
    expect(perBody).toBeLessThan((b.n - 1) / 5);
  });
});
