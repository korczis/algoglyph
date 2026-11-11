import { describe, expect, it } from 'vitest';
import { factCards, facts, pick, prose, spread } from '../src/core/facts';
import { CATEGORIES, PLATES } from '../src/plates';

describe('landing-page facts', () => {
  const f = facts(PLATES, CATEGORIES);

  it('counts the registry: categories partition the plates', () => {
    expect(f.plates).toBe(PLATES.length);
    expect(f.byCategory.reduce((s, c) => s + c.count, 0)).toBe(PLATES.length);
    expect(f.byCategory.map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id));
  });

  it('counts 3D plates, distinct tags and parameters by an independent loop', () => {
    let webgl = 0;
    let params = 0;
    const tags: string[] = [];
    for (const p of PLATES) {
      if (p.mode === 'webgl') webgl++;
      params += p.params.length;
      for (const t of p.tags) if (!tags.includes(t.toLowerCase())) tags.push(t.toLowerCase());
    }
    expect(f.webgl).toBe(webgl);
    expect(f.params).toBe(params);
    expect(f.tags).toBe(tags.length);
  });

  it('builds one card per fact with the registry values', () => {
    const cards = factCards(f);
    expect(cards.map((c) => c.key)).toEqual(['plates', ...CATEGORIES.map((c) => c.id), 'webgl',
      'tags']);
    expect(cards[0].value).toBe(PLATES.length);
  });

  it('joins words as prose', () => {
    expect(prose([])).toBe('');
    expect(prose(['a'])).toBe('a');
    expect(prose(['a', 'b'])).toBe('a and b');
    expect(prose(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('spreads picks evenly, ends included, without repeats', () => {
    const xs = Array.from({ length: 19 }, (_, i) => i);
    expect(spread(xs, 9)).toEqual([0, 2, 5, 7, 9, 11, 14, 16, 18]);
    expect(spread(xs.slice(0, 4), 9)).toEqual([0, 1, 2, 3]);
    expect(new Set(spread(xs, 9)).size).toBe(9);
  });

  it('picks every element for some draw and never runs off the end', () => {
    const xs = ['a', 'b', 'c'];
    expect(pick(xs, () => 0)).toBe('a');
    expect(pick(xs, () => 0.5)).toBe('b');
    expect(pick(xs, () => 0.999999)).toBe('c');
    expect(pick([], () => 0.5)).toBeUndefined();
  });
});
