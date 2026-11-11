import { describe, expect, it } from 'vitest';
import { factCards, facts, pick, prose, spread } from '../src/core/facts';
import { CATALOGUE } from '../src/core/catalogue';

describe('landing-page facts', () => {
  const f = facts(CATALOGUE);

  it('counts the catalogue by an independent loop', () => {
    let live = 0;
    let planned = 0;
    const tags: string[] = [];
    for (const e of CATALOGUE.entries) {
      if (e.status === 'live') live++;
      else planned++;
      for (const t of e.tags) if (!tags.includes(t.toLowerCase())) tags.push(t.toLowerCase());
    }
    expect(f.live).toBe(live);
    expect(f.planned).toBe(planned);
    expect(f.tags).toBe(tags.length);
    expect(f.wings).toBe(CATALOGUE.roots.length);
  });

  it('builds one card per fact with the catalogue values', () => {
    const cards = factCards(f);
    expect(cards.map((c) => c.key)).toEqual(['live', 'planned', 'wings', 'labs', 'tags']);
    expect(cards[0].value).toBe(f.live);
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
