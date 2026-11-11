// The catalogue as the site reads it: the model scripts/lib/catalogue.mjs validated at build
// time (virtual:catalogue). Navigation, numbering, counts, search and labs are derived here;
// nothing in the interface is written by hand (ADR 0004).
import model from 'virtual:catalogue';

export type Status = 'live' | 'planned';

export interface Cite {
  id: string;
  ref?: string;
}

export interface Entry {
  id: string;
  no: string;
  title: string;
  status: Status;
  engine: string;
  mode: string | null;
  /** The taxonomy leaf, `wing/shelf`. */
  taxonomy: string;
  path: string[];
  labs: string[];
  sources: Cite[];
  tags: string[];
  complexity: string;
  interaction: string;
  motivation: string;
  summary: string;
  notes: string[];
  /** Entries this one names as related, and the entries that name it (derived). */
  related: string[];
  backlinks: string[];
}

export interface TaxNode {
  key: string;
  id: string;
  title: string;
  summary: string;
  path: string[];
  depth: number;
  children: string[];
  live: number;
  planned: number;
}

export interface Lab {
  id: string;
  title: string;
  summary: string;
  engine: string;
  metrics?: string[];
  entries: string[];
}

export interface Source {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  year?: number;
  kind: string;
  url?: string;
}

export interface Catalogue {
  /** The fewest live entries a lab runs with (scripts/lib/catalogue.mjs LAB_MIN). */
  labMin: number;
  nodes: TaxNode[];
  roots: string[];
  entries: Entry[];
  labs: Lab[];
  sources: Source[];
}

export const CATALOGUE = model as Catalogue;
export const ENTRIES = CATALOGUE.entries;
const NODES = new Map(CATALOGUE.nodes.map((n) => [n.key, n]));
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));
const LABS = new Map(CATALOGUE.labs.map((l) => [l.id, l]));
const SOURCES = new Map(CATALOGUE.sources.map((s) => [s.id, s]));

export const entry = (id: string): Entry | undefined => BY_ID.get(id);
export const node = (key: string): TaxNode | undefined => NODES.get(key);
export const lab = (id: string): Lab | undefined => LABS.get(id);
export const source = (id: string): Source | undefined => SOURCES.get(id);
export const roots = (): TaxNode[] => CATALOGUE.roots.map((k) => NODES.get(k) as TaxNode);
export const children = (key: string): TaxNode[] =>
  (NODES.get(key)?.children ?? []).map((k) => NODES.get(k) as TaxNode);

/** The nodes from the wing down to `key`, for a breadcrumb. */
export function trail(key: string): TaxNode[] {
  const parts = key.split('/');
  return parts.map((_, i) => NODES.get(parts.slice(0, i + 1).join('/'))).filter(Boolean) as TaxNode[];
}

/** Every entry at or below `key`, in catalogue order. An empty key is the whole collection. */
export function under(key: string): Entry[] {
  if (!key) return ENTRIES;
  const prefix = `${key}/`;
  return ENTRIES.filter((e) => e.taxonomy === key || e.taxonomy.startsWith(prefix));
}

/** Labs whose entries fall under `key`. */
export function labsUnder(key: string): Lab[] {
  const ids = new Set(under(key).map((e) => e.id));
  return CATALOGUE.labs.filter((l) => l.entries.some((id) => ids.has(id)));
}

/** Everything an entry links to, each id once: its own links, their reverse, its lab mates
 * and its shelf siblings, in that order. */
export function links(e: Entry): { id: string; why: string }[] {
  const out = new Map<string, string>();
  const add = (id: string, why: string) => { if (id !== e.id && !out.has(id) && BY_ID.has(id)) out.set(id, why); };
  for (const r of e.related) add(r, 'related');
  for (const r of e.backlinks) add(r, 'refers here');
  for (const l of e.labs) for (const id of LABS.get(l)?.entries ?? []) add(id, 'same lab');
  for (const x of ENTRIES) if (x.taxonomy === e.taxonomy) add(x.id, 'same shelf');
  return [...out].map(([id, why]) => ({ id, why }));
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const HAY = new Map(ENTRIES.map((e) => [e.id, fold([e.title, e.summary, e.complexity,
  ...e.tags, ...e.path.map((_, i) => NODES.get(e.path.slice(0, i + 1).join('/'))?.title ?? '')]
  .join(' '))]));

/** Entries matching every word of the query (diacritics and case folded), in catalogue order. */
export function search(entries: Entry[], query: string): Entry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return entries;
  return entries.filter((e) => words.every((w) => HAY.get(e.id)?.includes(w)));
}
