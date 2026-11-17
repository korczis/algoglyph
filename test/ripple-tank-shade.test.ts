// ripple-tank's shading without allocations (src/plates/ripple-tank/shade.ts) against the per-cell
// loop it replaced, copied below as it was in plate.ts: every byte of the raster equal, for both
// views, every palette and real fields of every experiment (slice 29's array, moving source and
// drum included), within one run. A planted change in
// the copied loop (the height scaled by 0.56 for 0.55) must fail the same comparison.
import { describe, expect, it } from 'vitest';
import { GROUNDS, mix, PALETTES, ramp, type Palette, type RGB } from '../src/core/palette';
import { shadeIntensity, shadeWave } from '../src/plates/ripple-tank/shade';
import { advance, drop, tank, type Experiment } from '../src/plates/ripple-tank/wave';

/** The loop of plate.ts before the change, with the height's scale as a parameter for the planted control. */
function oldShade(data: Uint8ClampedArray, view: string, u: Float32Array, intensity: Float32Array, wall: Uint8Array,
  wallC: RGB, pal: Palette, bg: RGB, peak: number, scale = 0.55): void {
  for (let i = 0; i < u.length; i++) {
    if (wall[i]) {
      data.set([wallC[0], wallC[1], wallC[2], 255], i * 4);
      continue;
    }
    const c = view === 'intensity'
      ? mix(bg, ramp(pal, Math.min(1, intensity[i] / peak)), Math.min(1, Math.sqrt(intensity[i] / peak) * 1.4))
      : ramp(pal, 0.5 + Math.max(-0.5, Math.min(0.5, u[i] * scale)));
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
}

const EXPERIMENTS: Experiment[] = ['double', 'single', 'two', 'free', 'array', 'moving', 'drum'];

/** Every (experiment, view, palette) raster pair: new and old; counts the pairs that differ. */
function compare(scale: number): { pairs: number; differ: number } {
  let pairs = 0; let differ = 0;
  for (const e of EXPERIMENTS) {
    const t = tank(160, 100, e, 24);
    drop(t, 120, 40);
    for (let k = 0; k < 260; k++) advance(t, 12);
    let peak = 1e-6;
    for (let i = 0; i < t.intensity.length; i++) if (t.intensity[i] > peak && (i % t.w) > t.barrierX + 4) peak = t.intensity[i];
    for (const pal of Object.values(PALETTES)) for (const ground of Object.values(GROUNDS)) {
      const wallC = mix(ground.bg, ground.fg, 0.75);
      for (const view of ['wave', 'intensity']) {
        const a = new Uint8ClampedArray(t.u.length * 4); const b = new Uint8ClampedArray(t.u.length * 4);
        if (view === 'intensity') shadeIntensity(a, t.intensity, t.wall, wallC, pal, ground.bg, peak);
        else shadeWave(a, t.u, t.wall, wallC, pal);
        oldShade(b, view, t.u, t.intensity, t.wall, wallC, pal, ground.bg, peak, scale);
        pairs++;
        if (!Buffer.from(a.buffer).equals(Buffer.from(b.buffer))) differ++;
      }
    }
  }
  return { pairs, differ };
}

describe('ripple-tank: the shading without allocations', () => {
  it('writes every byte the per-cell ramp and mix wrote, both views, every palette and ground', () => {
    const r = compare(0.55);
    expect(r.pairs).toBeGreaterThan(8);
    expect(r.differ).toBe(0);
  });

  it('a planted change (the height scaled by 0.56) fails the same comparison on every wave raster', () => {
    const r = compare(0.56);
    expect(r.differ).toBe(r.pairs / 2);
  });
});
