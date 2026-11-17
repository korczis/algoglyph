// The plate's map, OpenTTD-like and seeded: rolling ground in whole height levels, a river
// running north-west to south-east at sea level, a ridge beyond it with a village on its crest,
// and two flat station sites, A in the west and B in the east. Neighbouring vertices are held
// within one level of each other, as OpenTTD holds them, so every tile has a real slope. The line
// from A to B has to cross the river (a bridge) and get past the village (round it, over it, or
// under it in a tunnel); which it does is the planner's choice, not the map's.
import { mulberry32 } from '../../core/random';
import type { TileMap } from './plan';

const C = 67; const T = 84; const H = 72; const W = 87;

export interface Terrain { map: TileMap; a: [number, number]; b: [number, number] }

/** A map of w × h tiles (its vertex grid is one larger each way). */
export function terrain(w: number, h: number, seed: number): Terrain {
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
  // Allocation-free: the pass visits each vertex's east, then south neighbour in the order the
  // array-of-pairs loop did (that loop allocated three arrays per pair, up to 2(vw + vh) passes,
  // and cost a 180 × 112 map about 15–20 ms in one frame); test/track-planning-terrain.test.ts
  // proves the maps byte-equal to it within one run.
  const settle = (i: number, j: number): boolean => {
    const hi = heights[i] > heights[j] ? i : j;
    const lo = hi === i ? j : i;
    if (heights[hi] - heights[lo] <= 1) return false;
    if (!fixed[hi]) heights[hi] = heights[lo] + 1; else heights[lo] = heights[hi] - 1;
    return true;
  };
  for (let changed = true, pass = 0; changed && pass < 2 * (vw + vh); pass++) {
    changed = false;
    for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) {
      const i = y * vw + x;
      if (x + 1 < vw && settle(i, i + 1)) changed = true;
      if (y + 1 < vh && settle(i, i + vw)) changed = true;
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
