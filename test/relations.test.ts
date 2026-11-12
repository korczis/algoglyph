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
