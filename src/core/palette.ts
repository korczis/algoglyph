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
