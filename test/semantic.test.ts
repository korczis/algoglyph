// Semantic catalogue v2 (ADR 0005): the schema, the typed relations and the derived evidence
// refuse what they must, and derive what they promise. Negative cases run on a throwaway
// catalogue built from the real schema and relation table, never on the working tree.
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
// @ts-expect-error -- plain ESM shared with the node tooling
import { graph } from '../scripts/lib/graph.mjs';
import { CATALOGUE, ENTRIES, node, prose } from '../src/core/catalogue';
import { loadPlate } from '../src/registry';

interface Model {
  entries: { id: string; status: string; evidence: { tested: string | null };
    links: { to: string; type: string; derived: boolean }[] }[];
  relationTypes: { id: string; symmetric?: boolean; inverse?: string }[] }

function fixture(entries: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), 'algoglyph-semantic-'));
  mkdirSync(join(root, 'catalogue/entries'), { recursive: true });
  mkdirSync(join(root, 'catalogue/schema'), { recursive: true });
  copyFileSync('catalogue/schema/entry.yaml', join(root, 'catalogue/schema/entry.yaml'));
  copyFileSync('catalogue/relations.yaml', join(root, 'catalogue/relations.yaml'));
  writeFileSync(join(root, 'catalogue/taxonomy.yaml'), 'version: 1\nnodes:\n  - { id: w, title: Wing, summary: A wing for tests., children: [{ id: s, title: Shelf, summary: A shelf for tests. }] }\n');
  writeFileSync(join(root, 'catalogue/labs.yaml'), 'version: 1\nlabs: []\n');
  writeFileSync(join(root, 'catalogue/sources.yaml'), 'version: 1\nsources: []\n');
  for (const [id, extra] of Object.entries(entries)) {
    writeFileSync(join(root, `catalogue/entries/${id}.md`), `---\nid: ${id}\ntitle: Entry ${id}\ntaxonomy: w/s\nstatus: planned\nengine: graph\ntags: [t]\n${extra}---\n\nA summary that is long enough to pass.\n`);
  }
  return loadCatalogue(root, { code: false }).errors as string[];
}

describe('schema v2 refuses', () => {
  it('an unknown field, with its path', () => {
    expect(fixture({ a: 'algorithm: { colour: red }\n' }).join('\n')).toMatch(/algorithm\.colour: unknown field/);
  });
  it('a value outside its enumeration', () => {
    expect(fixture({ a: 'pedagogy: { difficulty: impossible }\n' }).join('\n')).toMatch(/pedagogy\.difficulty: "impossible" is not one of/);
  });
  it('a wrong type', () => {
    expect(fixture({ a: 'algorithm: { properties: { stable: maybe } }\n' }).join('\n')).toMatch(/algorithm\.properties\.stable: expected true or false/);
  });
  it('a relation to an entry that does not exist', () => {
    expect(fixture({ a: 'relations: [{ type: uses, target: nowhere }]\n' }).join('\n')).toMatch(/relations\[0\]\.target: nowhere is not an entry/);
  });
  it('a relation type the table does not declare', () => {
    expect(fixture({ a: 'relations: [{ type: loves, target: b }]\n', b: '' }).join('\n')).toMatch(/loves is not a relation type/);
  });
  it('a cycle of prerequisites', () => {
    const errors = fixture({ a: 'pedagogy: { prerequisites: [b] }\n', b: 'pedagogy: { prerequisites: [a] }\n' });
    expect(errors.join('\n')).toMatch(/requires forms a cycle/);
  });
  it('an entry related to itself', () => {
    expect(fixture({ a: 'related: [a]\n' }).join('\n')).toMatch(/an entry does not relate to itself/);
  });
  it('and accepts a well-formed v2 entry', () => {
    expect(fixture({ a: 'schema: algoglyph.entry/v2\nrelations: [{ type: uses, target: b, reason: It calls it. }]\nbounds: { worst: O(n) }\n', b: '' })).toEqual([]);
  });
});

describe('derived semantics on the real catalogue', () => {
  const { errors, model } = loadCatalogue(process.cwd()) as { errors: string[]; model: Model };

  it('loads without error', () => expect(errors).toEqual([]));

  it('every declared link has its inverse, named by the relation table', () => {
    const types = new Map(model.relationTypes.map((t) => [t.id, t]));
    for (const e of model.entries) {
      for (const l of e.links.filter((x) => !x.derived)) {
        const t = types.get(l.type)!;
        const back = t.symmetric ? l.type : t.inverse;
        const target = model.entries.find((x) => x.id === l.to)!;
        expect(target.links.some((x) => x.to === e.id && x.type === back), `${e.id} ${l.type} ${l.to}`).toBe(true);
      }
    }
  });

  it('every live entry carries the evidence of a test that names it', () => {
    for (const e of model.entries.filter((x) => x.status === 'live')) {
      expect(e.evidence.tested, `${e.id}: no test names it`).not.toBeNull();
    }
  });

  it('a plate built from shared code is tested through the shared module it imports', () => {
    // binary-search's plate is sorted-search/search drawn by sorted-search/view; the search is
    // what test/plates-custom.test.ts checks against an independent scan
    const e = model.entries.find((x) => x.id === 'binary-search')!;
    expect(e.evidence.tested).toBe('unit');
  });

  it('the graph is deterministic and every edge ends on a node', () => {
    const a = JSON.stringify(graph(model));
    expect(JSON.stringify(graph(loadCatalogue(process.cwd()).model))).toBe(a);
    const g = graph(model) as { nodes: { id: string }[]; edges: { from: string; to: string }[] };
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const x of g.edges) expect(ids.has(x.from) && ids.has(x.to), `${x.from} -> ${x.to}`).toBe(true);
  });

  it('every experiment preset names real parameters with values its controls accept', async () => {
    for (const e of ENTRIES.filter((x) => x.status === 'live' && x.experiments.length)) {
      const plate = await loadPlate(e.id);
      for (const x of e.experiments) {
        for (const [k, v] of Object.entries(x.params ?? {})) {
          const d = plate!.params.find((p) => p.key === k);
          expect(d, `${e.id} preset ${x.id}: no parameter ${k}`).toBeDefined();
          if (d!.kind === 'range') {
            expect(typeof v).toBe('number');
            expect(v as number).toBeGreaterThanOrEqual(d!.min);
            expect(v as number).toBeLessThanOrEqual(d!.max);
          } else if (d!.kind === 'select') {
            expect(d!.options.map((o) => o.value), `${e.id} ${k}`).toContain(v);
          } else expect(typeof v).toBe('boolean');
        }
      }
    }
  });
});

describe('prose links derived from the catalogue', () => {
  const live = ENTRIES.find((e) => e.status === 'live')!;
  const leaf = CATALOGUE.roots[0];
  it('turns a route into a link titled by the catalogue, keeping the text around it', () => {
    const s = prose(`See #/p/${live.id}, then #/c/${leaf}.`);
    expect(s).toEqual([
      { text: 'See ' },
      { text: live.title, href: `#/p/${live.id}` },
      { text: ', then ' },
      { text: node(leaf)!.title, href: `#/c/${leaf}` },
      { text: '.' },
    ]);
  });
  it('leaves a route nothing resolves as text, and plain prose as one segment', () => {
    expect(prose('no such #/p/not-an-entry here')).toEqual([{ text: 'no such #/p/not-an-entry here' }]);
    expect(prose('plain')).toEqual([{ text: 'plain' }]);
    expect(prose('')).toEqual([]);
  });
  it('every route in every entry note resolves to a link', () => {
    for (const e of ENTRIES) {
      for (const n of e.notes) {
        const routes = n.match(/#\/(p|c|lab)\/[a-z0-9/-]*[a-z0-9]/g) ?? [];
        const links = prose(n).filter((s) => s.href).map((s) => s.href);
        expect(links, `${e.id}: ${n}`).toEqual(routes);
      }
    }
  });
});
