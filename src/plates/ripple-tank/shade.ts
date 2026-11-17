// The tank's two views shaded into a raster without allocating: the arithmetic of `ramp` and
// `mix` (src/core/palette.ts) inlined in the same order, so every byte equals what the per-cell
// calls produced (test/ripple-tank-shade.test.ts proves it within one run). Per cell those calls
// allocated two or three colour arrays, and a wall cell one more, about 80,000 arrays a frame
// at the heaviest double slit; the shading was the half of that frame the wave step was not.
import type { Palette, RGB } from '../../core/palette';

/** Surface height: the palette at 0.5 + clamp(0.55 u, ±0.5); walls in `wallC`. */
export function shadeWave(data: Uint8ClampedArray, u: ArrayLike<number>, wall: Uint8Array, wallC: RGB, pal: Palette): void {
  const s = pal.stops;
  const last = s.length - 1;
  for (let i = 0; i < u.length; i++) {
    const o = i * 4;
    if (wall[i]) {
      data[o] = wallC[0]; data[o + 1] = wallC[1]; data[o + 2] = wallC[2]; data[o + 3] = 255;
      continue;
    }
    let t = Math.min(1, Math.max(0, 0.5 + Math.max(-0.5, Math.min(0.5, u[i] * 0.55))));
    t *= last;
    const k = Math.min(last - 1, Math.floor(t));
    const a = s[k]; const b = s[k + 1]; const f = t - k;
    data[o] = a[0] + (b[0] - a[0]) * f;
    data[o + 1] = a[1] + (b[1] - a[1]) * f;
    data[o + 2] = a[2] + (b[2] - a[2]) * f;
    data[o + 3] = 255;
  }
}

/** Time-averaged intensity: the palette at I/peak, blended over `bg` by min(1, 1.4 √(I/peak)). */
export function shadeIntensity(
  data: Uint8ClampedArray, intensity: ArrayLike<number>, wall: Uint8Array, wallC: RGB, pal: Palette,
  bg: RGB, peak: number,
): void {
  const s = pal.stops;
  const last = s.length - 1;
  for (let i = 0; i < intensity.length; i++) {
    const o = i * 4;
    if (wall[i]) {
      data[o] = wallC[0]; data[o + 1] = wallC[1]; data[o + 2] = wallC[2]; data[o + 3] = 255;
      continue;
    }
    let t = Math.min(1, Math.max(0, Math.min(1, intensity[i] / peak)));
    t *= last;
    const k = Math.min(last - 1, Math.floor(t));
    const a = s[k]; const b = s[k + 1]; const f = t - k;
    const w = Math.min(1, Math.sqrt(intensity[i] / peak) * 1.4);
    const c0 = a[0] + (b[0] - a[0]) * f; const c1 = a[1] + (b[1] - a[1]) * f; const c2 = a[2] + (b[2] - a[2]) * f;
    data[o] = bg[0] + (c0 - bg[0]) * w;
    data[o + 1] = bg[1] + (c1 - bg[1]) * w;
    data[o + 2] = bg[2] + (c2 - bg[2]) * w;
    data[o + 3] = 255;
  }
}
