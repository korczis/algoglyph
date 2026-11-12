// Cross-wing relations (the owner's "interconnect"): typed links the entries' own notes state,
// declared once. The reverse of every link is derived by the catalogue (scripts/lib/catalogue.mjs),
// never authored, so a pair declared on both sides can lose one side without the page losing it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue, splitFrontMatter } from '../scripts/lib/catalogue.mjs';

interface Link { to: string; type: string; title: string; derived: boolean }
interface Entry { id: string; links: Link[] }
interface RelType { id: string; inverse?: string; symmetric?: boolean }

const root = process.cwd();
const { model } = loadCatalogue(root, { code: false });
const entries = model.entries as Entry[];
const byId = new Map(entries.map((e) => [e.id, e]));
const types = new Map((model.relationTypes as RelType[]).map((t) => [t.id, t]));
const reverse = (type: string) => {
  const t = types.get(type);
  return t?.symmetric ? type : (t?.inverse ?? `${type}-of`);
};
const linked = (from: string, to: string, type?: string) =>
  (byId.get(from)?.links ?? []).some((l) => l.to === to && (type === undefined || l.type === type));

/** What one entry's front matter declares itself (related, relations). */
function declared(id: string): { related: string[]; relations: { type: string; target: string }[] } {
  const text = readFileSync(join(root, 'catalogue', 'entries', `${id}.md`), 'utf8');
  const fm = parse(splitFrontMatter(text)?.head ?? '') ?? {};
  return { related: fm.related ?? [], relations: fm.relations ?? [] };
}

describe('relations: the reverse of every link is derived', () => {
  it('every declared link appears on its target with the inverse type', () => {
    const missing: string[] = [];
    for (const e of entries) {
      for (const l of e.links.filter((x) => !x.derived)) {
        if (!linked(l.to, e.id, reverse(l.type))) missing.push(`${e.id} -${l.type}-> ${l.to}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('a link declared on one side only still shows on both', () => {
    // quick-union declares variant_of quick-find; quick-find declares nothing back
    expect(declared('quick-find').relations.some((r) => r.target === 'quick-union')).toBe(false);
    expect(linked('quick-find', 'quick-union', 'has_variant')).toBe(true);
  });
});

// [from, type, to, why]: each stated by the `from` entry's notes (quoted in the commit)
const STATED: [string, string, string][] = [
  ['euclidean-mst', 'uses', 'bowyer-watson-delaunay'],
  ['general-sweep', 'uses', 'binary-heap'],
  ['sir-cascade', 'generalizes', 'breadth-first-search'],
  ['tree-traversal', 'uses', 'bst-search-insert'],
  ['huffman-coding', 'uses', 'binary-heap'],
  ['myers-diff', 'compares_with', 'longest-common-subsequence'],
  ['noise-colours', 'uses', 'least-squares'],
  ['source-family', 'uses', 'quick-union'],
  ['pert-monte-carlo', 'uses', 'critical-path'],
  ['lamport-clocks', 'related_to', 'transitive-closure'],
  ['bin-packing', 'related_to', 'tournament-sort'],
  ['recursive-descent-parser', 'compares_with', 'infix-to-postfix'],
];

describe('relations: typed links the notes state', () => {
  it.each(STATED)('%s %s %s, and its reverse on the target', (from, type, to) => {
    expect(declared(from).relations).toContainEqual(expect.objectContaining({ type, target: to }));
    expect(linked(from, to, type)).toBe(true);
    expect(linked(to, from, reverse(type))).toBe(true);
  });

  it('a typed link replaces the v1 related item it upgrades', () => {
    for (const [from, , to] of STATED) expect(declared(from).related, `${from} related`).not.toContain(to);
  });
});

// pairs both sides declared: kept on one side, the reverse derived
const COLLAPSED: [string, string][] = [
  ['pareto-front', 'simplex-method'],
  ['sir-cascade', 'spreading-activation'],
  ['recursive-descent-parser', 'infix-to-postfix'],
  ['union-find-entity-merge', 'connected-components'],
];

describe('relations: a pair is declared on one side', () => {
  it.each(COLLAPSED)('%s declares %s, which does not declare it back, and both show it', (a, b) => {
    const da = declared(a);
    const db = declared(b);
    expect([...da.related, ...da.relations.map((r) => r.target)]).toContain(b);
    expect([...db.related, ...db.relations.map((r) => r.target)]).not.toContain(a);
    expect(linked(a, b)).toBe(true);
    expect(linked(b, a)).toBe(true);
  });

  it('union-find-entity-merge reads weighted-quick-union once, as its prerequisite', () => {
    expect(declared('union-find-entity-merge').related).not.toContain('weighted-quick-union');
  });
});
