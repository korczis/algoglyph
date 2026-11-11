import { describe, expect, it } from 'vitest';
import { PALETTES, ramp } from '../src/core/palette';
import { CATEGORIES, PLATES } from '../src/plates';

describe('plate registry', () => {
  it('numbers plates in registry order and keeps ids unique', () => {
    expect(PLATES.map((p) => p.no)).toEqual(PLATES.map((_, i) => String(i + 1).padStart(2, '0')));
    expect(new Set(PLATES.map((p) => p.id)).size).toBe(PLATES.length);
  });

  it('gives every plate a category, notes and URL-safe id', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PLATES) {
      expect(cats.has(p.category)).toBe(true);
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.notes.length).toBeGreaterThan(0);
      expect(p.summary.length).toBeGreaterThan(20);
    }
  });

  it('every default lies inside its control', () => {
    for (const p of PLATES) {
      const keys = new Set<string>();
      for (const d of p.params) {
        expect(keys.has(d.key), `${p.id}.${d.key} duplicated`).toBe(false);
        keys.add(d.key);
        if (d.kind === 'range') {
          expect(d.value, `${p.id}.${d.key}`).toBeGreaterThanOrEqual(d.min);
          expect(d.value, `${p.id}.${d.key}`).toBeLessThanOrEqual(d.max);
          expect(d.step).toBeGreaterThan(0);
        } else if (d.kind === 'select') {
          expect(d.options.map((o) => o.value), `${p.id}.${d.key}`).toContain(d.value);
        }
      }
    }
  });

  it('has at least one 3D plate and covers every category', () => {
    expect(PLATES.some((p) => p.mode === 'webgl')).toBe(true);
    for (const c of CATEGORIES) expect(PLATES.some((p) => p.category === c.id)).toBe(true);
  });
});

describe('palettes', () => {
  it('ramps start and end on their stops', () => {
    for (const pal of PALETTES) {
      expect(ramp(pal, 0)).toEqual(pal.stops[0]);
      expect(ramp(pal, 1)).toEqual(pal.stops[pal.stops.length - 1]);
      expect(ramp(pal, -1)).toEqual(pal.stops[0]);
    }
  });
});
