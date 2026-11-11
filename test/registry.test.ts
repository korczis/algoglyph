import { describe, expect, it } from 'vitest';
import { CATALOGUE, ENTRIES, children, node, trail, under } from '../src/core/catalogue';
import { PALETTES, ramp } from '../src/core/palette';
import { labRunnable, loadLab, loadPlate } from '../src/registry';

describe('catalogue', () => {
  it('numbers entries in taxonomy order and keeps ids unique', () => {
    const width = Math.max(2, String(ENTRIES.length).length);
    expect(ENTRIES.map((e) => e.no)).toEqual(ENTRIES.map((_, i) => String(i + 1).padStart(width, '0')));
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(ENTRIES.length);
  });

  it('files every entry under a leaf, and the counts roll up', () => {
    for (const e of ENTRIES) {
      expect(node(e.taxonomy)?.children).toEqual([]);
      expect(trail(e.taxonomy).map((n) => n.id)).toEqual(e.path);
    }
    for (const key of CATALOGUE.roots) {
      const n = node(key)!;
      expect(n.live + n.planned).toBe(under(key).length);
      expect(children(key).reduce((s, c) => s + c.live + c.planned, 0)).toBe(under(key).length);
    }
  });
});

describe('plate registry', () => {
  const live = ENTRIES.filter((e) => e.status === 'live');

  it('loads every live entry, with its id, and refuses planned ones', async () => {
    for (const e of live) {
      const p = await loadPlate(e.id);
      expect(p?.id, e.id).toBe(e.id);
      expect(p?.title).toBe(e.title);
    }
    for (const e of ENTRIES.filter((x) => x.status === 'planned')) expect(loadPlate(e.id)).toBeUndefined();
  });

  it('every default lies inside its control', async () => {
    for (const e of live) {
      const p = await loadPlate(e.id);
      const keys = new Set<string>();
      for (const d of p!.params) {
        expect(keys.has(d.key), `${e.id}.${d.key} duplicated`).toBe(false);
        keys.add(d.key);
        if (d.kind === 'range') {
          expect(d.value, `${e.id}.${d.key}`).toBeGreaterThanOrEqual(d.min);
          expect(d.value, `${e.id}.${d.key}`).toBeLessThanOrEqual(d.max);
          expect(d.step).toBeGreaterThan(0);
        } else if (d.kind === 'select') {
          expect(d.options.map((o) => o.value), `${e.id}.${d.key}`).toContain(d.value);
        }
      }
    }
  });

  it('builds every runnable lab', async () => {
    for (const l of CATALOGUE.labs) {
      if (!labRunnable(l.id)) continue;
      const p = await loadLab(l.id);
      expect(p?.id).toBe(`lab-${l.id}`);
    }
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
