// Facts the landing page states about the collection, derived from the registry at runtime so
// no count is ever written by hand (rule project.no-fake-science applies to prose too).
import type { Category, Plate } from './plate';

type Entry = Pick<Plate, 'id' | 'category' | 'mode' | 'tags' | 'params'>;

export interface Fact {
  key: string;
  value: number;
  label: string;
  detail: string;
}

export interface Facts {
  plates: number;
  webgl: number;
  tags: number;
  params: number;
  byCategory: { id: Category; label: string; count: number }[];
}

export function facts(plates: Entry[], categories: { id: Category; label: string }[]): Facts {
  return {
    plates: plates.length,
    webgl: plates.filter((p) => p.mode === 'webgl').length,
    tags: new Set(plates.flatMap((p) => p.tags.map((t) => t.toLowerCase()))).size,
    params: plates.reduce((sum, p) => sum + p.params.length, 0),
    byCategory: categories.map((c) => ({
      ...c,
      count: plates.filter((p) => p.category === c.id).length,
    })),
  };
}

/** The KPI cards of the landing page, in display order. */
export function factCards(f: Facts): Fact[] {
  return [
    {
      key: 'plates',
      value: f.plates,
      label: f.plates === 1 ? 'Plate' : 'Plates',
      detail: `${f.params} parameters to turn`,
    },
    ...f.byCategory.map((c) => ({
      key: c.id,
      value: c.count,
      label: c.label,
      detail: `${Math.round((100 * c.count) / Math.max(1, f.plates))}% of the collection`,
    })),
    { key: 'webgl', value: f.webgl, label: '3D plates', detail: 'rendered in p5.js WEBGL' },
    { key: 'tags', value: f.tags, label: 'Tags', detail: 'distinct, all searchable' },
  ];
}

/** "a", "a and b", "a, b and c". */
export function prose(words: string[]): string {
  if (words.length < 2) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Up to n items spread evenly over the list, first and last included. */
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return [...items];
  if (n <= 1) return items.slice(0, Math.max(0, n));
  const picked = new Set<number>();
  for (let i = 0; i < n; i++) picked.add(Math.round((i * (items.length - 1)) / (n - 1)));
  return [...picked].map((i) => items[i]);
}

/** A uniformly chosen element; rnd defaults to Math.random (navigation, not a plate's seed). */
export function pick<T>(items: T[], rnd: () => number = Math.random): T | undefined {
  if (!items.length) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rnd() * items.length))];
}
