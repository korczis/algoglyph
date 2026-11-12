// The catalogue as the site reads it: the model scripts/lib/catalogue.mjs validated at build
// time (virtual:catalogue). Navigation, numbering, counts, search and labs are derived here;
// nothing in the interface is written by hand (ADR 0004).
import type { Claim } from './claims';
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
  aliases: string[];
  pedagogy: Pedagogy | null;
  algorithm: AlgorithmFacts | null;
  bounds: Bounds | null;
  experiments: Experiment[];
  /** What the plate measures, checked by test/claims.test.ts on every build (ADR 0007). */
  claims: Claim[];
  /** Typed links, declared or derived from catalogue/relations.yaml. */
  links: Link[];
  /** Derived from code and tests; never authored (ADR 0005 §3). */
  evidence: { implemented: boolean; tested: 'harness' | 'unit' | null; claims: { declared: number; instrument: string | null } | null };
  maturity: { reached: string[]; next: string | null };
}

export interface Link { to: string; type: string; title: string; reason: string; derived: boolean }
export interface Pedagogy {
  difficulty?: string; prerequisites?: string[]; objectives?: string[]; misconceptions?: string[]; questions?: string[];
}
export interface AlgorithmFacts {
  paradigm?: string; properties?: Record<string, boolean>; preconditions?: string[]; postconditions?: string[];
  invariants?: string[]; limitations?: string[];
}
export interface Bounds { model?: string; best?: string; average?: string; worst?: string; space?: string }
export interface Experiment { id: string; title: string; params?: Record<string, string | number | boolean>; observe?: string }
export interface RelationType { id: string; title: string; inverse_title?: string; meaning: string }

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
  relationTypes: RelationType[];
  /** The fewest live entries a lab runs with (scripts/lib/catalogue.mjs LAB_MIN). */
  labMin: number;
  nodes: TaxNode[];
  roots: string[];
  entries: Entry[];
  labs: Lab[];
  sources: Source[];
  /**
   * Entries with no kernel file that a catalogue/<family>-sidecar.yaml maps to a compiled
   * kernel: the sidecar, the adapter directory src/kernels/<adapter>/ that plays it, and the
   * kernel id (checked against the module's manifest), with the largest n it plays at when its
   * measured rebuild cost bounds it (ArrayKernel.maxN).
   */
  sidecar?: Record<string, { sidecar: string; adapter: string; kernel: string; maxN?: number }>;
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

/** Everything an entry links to, each id once, grouped by why: its typed links first (declared
 * and derived), then its lab mates and its shelf siblings. */
export function links(e: Entry): { id: string; why: string }[] {
  const out = new Map<string, string>();
  const add = (id: string, why: string) => { if (id !== e.id && !out.has(id) && BY_ID.has(id)) out.set(id, why); };
  for (const l of e.links) add(l.to, l.title);
  for (const l of e.labs) for (const id of LABS.get(l)?.entries ?? []) add(id, 'Same lab');
  for (const x of ENTRIES) if (x.taxonomy === e.taxonomy) add(x.id, 'Same shelf');
  return [...out].map(([id, why]) => ({ id, why }));
}

/** The same links as groups of one reason each, in the order they were found. */
export function linkGroups(e: Entry): { why: string; entries: Entry[] }[] {
  const groups = new Map<string, Entry[]>();
  for (const l of links(e)) (groups.get(l.why) ?? groups.set(l.why, []).get(l.why))!.push(BY_ID.get(l.id) as Entry);
  return [...groups].map(([why, entries]) => ({ why, entries }));
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

/** A run of prose: plain text, or a route to a page of the atlas with that page's title. */
export interface Segment { text: string; href?: string }

const ROUTE = /#\/(p|c|lab)\/([a-z0-9](?:[a-z0-9/-]*[a-z0-9])?)/g;

/**
 * Prose split into text and links. An author writes a route (`#/p/<id>`, `#/c/<path>`,
 * `#/lab/<id>`); the link text is derived from the catalogue, so a renamed entry renames every
 * mention. A route nothing resolves stays text (scripts/check-facts.mjs refuses it at commit).
 */
export function prose(text: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of text.matchAll(ROUTE)) {
    const [route, kind, key] = m;
    const title = kind === 'p' ? entry(key)?.title : kind === 'c' ? node(key)?.title : lab(key)?.title;
    if (!title) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ text: title, href: route });
    at = m.index + route.length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
