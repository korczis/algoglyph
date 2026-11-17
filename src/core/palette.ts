// The only palettes a plate may draw with. Colour stops are sampled in linear RGB order; the
// ramps are chosen so that their brightest and darkest ends read on both canvas grounds.
import type { SelectParam, Theme } from './plate';

export type RGB = [number, number, number];

export interface Palette {
  id: string;
  label: string;
  stops: RGB[];
}

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function make(id: string, label: string, stops: string[]): Palette {
  return { id, label, stops: stops.map(hex) };
}

export const PALETTES: Palette[] = [
  make('ember', 'Ember', ['#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf']),
  make('abyss', 'Abyss', ['#1d3b6e', '#2a6fb0', '#2fb3c6', '#7fe0c0', '#e9f8d2']),
  make('riso', 'Risograph', ['#ff48b0', '#ff6c2f', '#ffe800', '#00a95c', '#0078bf']),
  make('spectral', 'Spectral', ['#d53e4f', '#f46d43', '#fdae61', '#e6f598', '#66c2a5',
    '#3288bd', '#5e4fa2']),
  make('phosphor', 'Phosphor', ['#0f3d2e', '#1f7a4d', '#39b54a', '#a6e22e', '#f4ffb0']),
  make('bone', 'Bone', ['#6b6459', '#9c9384', '#c9bfae', '#e8e0cf', '#fffaf0']),
];

export const GROUNDS: Record<Theme, { bg: RGB; fg: RGB }> = {
  dark: { bg: [11, 12, 16], fg: [236, 231, 220] },
  light: { bg: [246, 243, 236], fg: [22, 24, 30] },
};

export function palette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function paletteParam(value = 'ember'): SelectParam {
  return {
    kind: 'select',
    key: 'palette',
    label: 'Palette',
    cosmetic: true,
    value,
    options: PALETTES.map((p) => ({ value: p.id, label: p.label })),
  };
}

/** Sample a palette at t in [0, 1]; `cyclic` wraps instead of clamping. */
export function ramp(pal: Palette, t: number, cyclic = false): RGB {
  const s = pal.stops;
  let u = cyclic ? t - Math.floor(t) : Math.min(1, Math.max(0, t));
  if (cyclic) {
    const x = u * s.length;
    const i = Math.floor(x) % s.length;
    return mix(s[i], s[(i + 1) % s.length], x - Math.floor(x));
  }
  u *= s.length - 1;
  const i = Math.min(s.length - 2, Math.floor(u));
  return mix(s[i], s[i + 1], u - i);
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scale(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

/**
 * ramp(pal, t, cyclic) written into `out` instead of a new array: the same arithmetic in the same
 * order, so every component is bit-equal (test/hot-loops/palette.test.ts). For loops that shade
 * a raster cell by cell, where ramp's array per call is garbage and, under the test runner's
 * module transform, every imported call a property read: bind it to a local before the loop
 * (const into = rampInto). scripts/check-hot-loops.mjs refuses ramp, mix and scale there.
 */
export function rampInto(out: RGB, pal: Palette, t: number, cyclic = false): RGB {
  const s = pal.stops;
  let u = cyclic ? t - Math.floor(t) : Math.min(1, Math.max(0, t));
  let a: RGB; let b: RGB; let f: number;
  if (cyclic) {
    const x = u * s.length;
    const i = Math.floor(x) % s.length;
    a = s[i]; b = s[(i + 1) % s.length]; f = x - Math.floor(x);
  } else {
    u *= s.length - 1;
    const i = Math.min(s.length - 2, Math.floor(u));
    a = s[i]; b = s[i + 1]; f = u - i;
  }
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}

/** mix(a, b, t) written into `out` (which may be a or b): bit-equal, no array allocated. */
export function mixInto(out: RGB, a: RGB, b: RGB, t: number): RGB {
  const r = a[0] + (b[0] - a[0]) * t; const g = a[1] + (b[1] - a[1]) * t; const bl = a[2] + (b[2] - a[2]) * t;
  out[0] = r; out[1] = g; out[2] = bl;
  return out;
}

/** scale(c, k) written into `out` (which may be c): bit-equal, no array allocated. */
export function scaleInto(out: RGB, c: RGB, k: number): RGB {
  out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k;
  return out;
}
