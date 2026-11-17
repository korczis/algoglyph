// The terrain's settle loop, rewritten without allocations (three arrays per vertex pair, up to
// 2(vw + vh) passes, 15–20 ms of one frame on a 180 × 112 map), against the code it replaced,
// copied here as it was: every height and tile type equal byte for byte, and the planner's answer
// on each map equal, within one run. A planted change (neighbours left two levels apart instead of
// one) must fail the same comparison. Visiting the south neighbour before the east is not one: the
// settled map is the same either way, so the order alone could not be told apart.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { DEFAULT_COSTS, DEFAULT_RULES, plan, type TileMap } from '../src/plates/track-planning/plan';
import { terrain } from '../src/plates/track-planning/terrain';

interface Terrain { map: TileMap; a: [number, number]; b: [number, number] }
const C = 67; const T = 84; const H = 72; const W = 87;

/** The terrain as it was before the rewrite. */
function oldTerrain(w: number, h: number, seed: number): Terrain {
  const vw = w + 1; const vh = h + 1;
  const rnd = mulberry32(seed);
  const heights = new Uint8Array(vw * vh);
  const fixed = new Uint8Array(vw * vh);
  const p1 = rnd() * 6; const p2 = rnd() * 6;
  for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) {
    heights[y * vw + x] = Math.max(1, Math.round(2 + 1.1 * Math.sin(x / 5.3 + p1) + 0.9 * Math.cos(y / 4.1 + p2)));
  }
  // the river: a band two vertices wide meandering down the map at x ≈ 0.38 w, at height 0
  const rx = 0.38 * w; const amp = 0.06 * w; const ph = rnd() * 6;
  const riverAt = (y: number) => Math.round(rx + amp * Math.sin(y / 4 + ph));
  for (let y = 0; y < vh; y++) for (const dx of [0, 1, 2]) {
    const i = y * vw + riverAt(y) + dx;
    heights[i] = 0; fixed[i] = 1;
  }
  // the ridge: three levels above the ground at x ≈ 0.66 w, its crest built over
  const kx = Math.round(0.66 * w);
  for (let y = 0; y < vh; y++) for (let dx = -3; dx <= 3; dx++) {
    const i = y * vw + kx + dx;
    heights[i] = Math.max(heights[i], 5 - Math.abs(dx));
  }
  const a: [number, number] = [2, Math.floor(h / 2)];
  const b: [number, number] = [w - 4, Math.floor(h / 2) + (rnd() < 0.5 ? -2 : 2)];
  for (const [sx, sy] of [a, b]) {
    const z = heights[sy * vw + sx];
    for (let y = sy - 1; y <= sy + 2; y++) for (let x = sx - 1; x <= sx + 2; x++) { heights[y * vw + x] = z; fixed[y * vw + x] = 1; }
  }
  // OpenTTD's rule: neighbouring vertices at most one level apart; the river and the sites hold.
  // Each pass settles at least one more vertex of the slope; on a map too small for the river, the
  // ridge and the sites to keep apart, fixed vertices pull a slope both ways and it would never
  // settle, so the passes are bounded (the plate keeps its maps at least MIN_W × MIN_H).
  for (let changed = true, pass = 0; changed && pass < 2 * (vw + vh); pass++) {
    changed = false;
    for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
      if (nx >= vw || ny >= vh) continue;
      const i = y * vw + x; const j = ny * vw + nx;
      const [hi, lo] = heights[i] > heights[j] ? [i, j] : [j, i];
      if (heights[hi] - heights[lo] <= 1) continue;
      if (!fixed[hi]) heights[hi] = heights[lo] + 1; else heights[lo] = heights[hi] - 1;
      changed = true;
    }
  }
  const types = new Uint8Array(vw * vh).fill(C);
  const near = ([sx, sy]: [number, number], x: number, y: number) => Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = [heights[y * vw + x], heights[y * vw + x + 1], heights[(y + 1) * vw + x], heights[(y + 1) * vw + x + 1]];
    const i = y * vw + x;
    if (Math.max(...k) === 0) types[i] = W;
    else if (near(a, x, y) || near(b, x, y)) continue;
    else if (Math.abs(x - kx) <= 1 && Math.abs(y - h / 2) < h * 0.42 && rnd() < 0.8) types[i] = H;
    else if (rnd() < 0.07) types[i] = T;
  }
  types[a[1] * vw + a[0]] = 83; types[b[1] * vw + b[0]] = 83; // S
  return { map: { w: vw, h: vh, heights, types }, a, b };
}

/** The planted change: the same code settling to two levels apart instead of one. */
function plantedTerrain(w: number, h: number, seed: number): Terrain {
  const vw = w + 1; const vh = h + 1;
  const rnd = mulberry32(seed);
  const heights = new Uint8Array(vw * vh);
  const fixed = new Uint8Array(vw * vh);
  const p1 = rnd() * 6; const p2 = rnd() * 6;
  for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) {
    heights[y * vw + x] = Math.max(1, Math.round(2 + 1.1 * Math.sin(x / 5.3 + p1) + 0.9 * Math.cos(y / 4.1 + p2)));
  }
  // the river: a band two vertices wide meandering down the map at x ≈ 0.38 w, at height 0
  const rx = 0.38 * w; const amp = 0.06 * w; const ph = rnd() * 6;
  const riverAt = (y: number) => Math.round(rx + amp * Math.sin(y / 4 + ph));
  for (let y = 0; y < vh; y++) for (const dx of [0, 1, 2]) {
    const i = y * vw + riverAt(y) + dx;
    heights[i] = 0; fixed[i] = 1;
  }
  // the ridge: three levels above the ground at x ≈ 0.66 w, its crest built over
  const kx = Math.round(0.66 * w);
  for (let y = 0; y < vh; y++) for (let dx = -3; dx <= 3; dx++) {
    const i = y * vw + kx + dx;
    heights[i] = Math.max(heights[i], 5 - Math.abs(dx));
  }
  const a: [number, number] = [2, Math.floor(h / 2)];
  const b: [number, number] = [w - 4, Math.floor(h / 2) + (rnd() < 0.5 ? -2 : 2)];
  for (const [sx, sy] of [a, b]) {
    const z = heights[sy * vw + sx];
    for (let y = sy - 1; y <= sy + 2; y++) for (let x = sx - 1; x <= sx + 2; x++) { heights[y * vw + x] = z; fixed[y * vw + x] = 1; }
  }
  // OpenTTD's rule: neighbouring vertices at most one level apart; the river and the sites hold.
  // Each pass settles at least one more vertex of the slope; on a map too small for the river, the
  // ridge and the sites to keep apart, fixed vertices pull a slope both ways and it would never
  // settle, so the passes are bounded (the plate keeps its maps at least MIN_W × MIN_H).
  for (let changed = true, pass = 0; changed && pass < 2 * (vw + vh); pass++) {
    changed = false;
    for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
      if (nx >= vw || ny >= vh) continue;
      const i = y * vw + x; const j = ny * vw + nx;
      const [hi, lo] = heights[i] > heights[j] ? [i, j] : [j, i];
      if (heights[hi] - heights[lo] <= 2) continue;
      if (!fixed[hi]) heights[hi] = heights[lo] + 1; else heights[lo] = heights[hi] - 1;
      changed = true;
    }
  }
  const types = new Uint8Array(vw * vh).fill(C);
  const near = ([sx, sy]: [number, number], x: number, y: number) => Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = [heights[y * vw + x], heights[y * vw + x + 1], heights[(y + 1) * vw + x], heights[(y + 1) * vw + x + 1]];
    const i = y * vw + x;
    if (Math.max(...k) === 0) types[i] = W;
    else if (near(a, x, y) || near(b, x, y)) continue;
    else if (Math.abs(x - kx) <= 1 && Math.abs(y - h / 2) < h * 0.42 && rnd() < 0.8) types[i] = H;
    else if (rnd() < 0.07) types[i] = T;
  }
  types[a[1] * vw + a[0]] = 83; types[b[1] * vw + b[0]] = 83; // S
  return { map: { w: vw, h: vh, heights, types }, a, b };
}

const SIZES: [number, number][] = [[24, 14], [60, 37], [90, 56], [180, 112]];
const SEEDS = [4242, 4242 + 7919, 4242 + 2 * 7919, 1, 77];
const same = (x: Terrain, y: Terrain) => x.a.join() === y.a.join() && x.b.join() === y.b.join()
  && Buffer.from(x.map.heights).equals(Buffer.from(y.map.heights)) && Buffer.from(x.map.types).equals(Buffer.from(y.map.types));

describe('track-planning: the terrain without allocations', () => {
  it('makes exactly the maps the array-of-pairs loop made, for every size and seed', () => {
    for (const [w, h] of SIZES) for (const seed of SEEDS) expect(same(terrain(w, h, seed), oldTerrain(w, h, seed)), `${w} × ${h}, seed ${seed}`).toBe(true);
  });

  it('a planted change fails the same comparison on some map', () => {
    let differs = 0;
    for (const [w, h] of SIZES) for (const seed of SEEDS) if (!same(plantedTerrain(w, h, seed), oldTerrain(w, h, seed))) differs++;
    expect(differs).toBeGreaterThan(0);
  });

  it('the planner answers the same on the new maps as on the old', () => {
    const rnd = mulberry32(9);
    for (const [w, h] of [[24, 14], [60, 37]] as [number, number][]) for (const seed of SEEDS.slice(0, 3)) {
      const costs = { ...DEFAULT_COSTS, bridge: 0.75 + rnd() * 9, tunnel: 0.75 + rnd() * 9 };
      const ask = (t: Terrain) => plan(t.map, { x: t.a[0], y: t.a[1], dir: 'SW' }, { x: t.b[0], y: t.b[1] }, costs, DEFAULT_RULES, true);
      const n = ask(terrain(w, h, seed)); const o = ask(oldTerrain(w, h, seed));
      expect(JSON.stringify(n), `${w} × ${h}, seed ${seed}`).toBe(JSON.stringify(o));
    }
  });
});
