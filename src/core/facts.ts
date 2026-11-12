// Facts the landing page states about the collection, derived from the catalogue at build
// time so no count is ever written by hand (rule project.no-fake-science applies to prose too).
import type { Catalogue } from './catalogue';

export interface Fact {
  key: string;
  value: number;
  label: string;
  detail: string;
  /** Where the card leads: every card is a way into what it counts. */
  href: string;
}

export interface Facts {
  live: number;
  planned: number;
  wings: number;
  shelves: number;
  labs: number;
  tags: number;
  sources: number;
}

export function facts(c: Pick<Catalogue, 'entries' | 'nodes' | 'labs' | 'sources'>): Facts {
  const leaves = c.nodes.filter((n) => n.children.length === 0);
  return {
    live: c.entries.filter((e) => e.status === 'live').length,
    planned: c.entries.filter((e) => e.status === 'planned').length,
    wings: c.nodes.filter((n) => n.depth === 1).length,
    shelves: leaves.length,
    labs: c.labs.length,
    tags: new Set(c.entries.flatMap((e) => e.tags.map((t) => t.toLowerCase()))).size,
    sources: new Set(c.entries.flatMap((e) => e.sources.map((s) => s.id))).size,
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The KPI cards of the landing page, in display order. */
export function factCards(f: Facts, firstLab = ''): Fact[] {
  const all = f.live + f.planned;
  return [
    { key: 'live', value: f.live, label: plural(f.live, 'Live plate', 'Live plates'),
      detail: `${Math.round((100 * f.live) / Math.max(1, all))}% of ${all} catalogued`, href: '#/?status=live' },
    { key: 'planned', value: f.planned, label: 'Planned', detail: 'catalogued, not yet running',
      href: '#/?status=planned' },
    { key: 'wings', value: f.wings, label: plural(f.wings, 'Wing', 'Wings'),
      detail: `${f.shelves} shelves below them`, href: '#/?status=all' },
    { key: 'labs', value: f.labs, label: plural(f.labs, 'Lab', 'Labs'),
      detail: 'algorithms compared side by side', href: firstLab ? `#/lab/${firstLab}` : '#/?status=all' },
    { key: 'tags', value: f.tags, label: 'Tags', detail: 'distinct, all searchable', href: '#/?status=all' },
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
