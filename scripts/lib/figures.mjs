// Figure occurrences of cited works (ADR 0009): catalogue/figures/collections.yaml and one chapter
// document per catalogue/figures/<collection>-<volume>-<chapter>.yaml, validated against
// catalogue/schema/figure-collection.yaml and figure-chapter.yaml (whose `ref` fields are the
// entry schema's own). Everything a page needs beyond what is authored is derived here: the
// chapter key and route of each figure, its neighbours, whether it is routed, and the backlink
// from its plate. A figure is routed exactly when its chapter carries a source review and its
// plate is a live, tested entry; nothing authored says so. A figure's claims have an entry's
// form and are run by test/claims.test.ts whether the figure is routed or not: the physics of a
// setup is gated before its page exists.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { claimErrors } from './claims.mjs';
import { check, loadSchema, resolveRefs } from './schema.mjs';

const CHAPTER_FILE = /^([a-z0-9][a-z0-9-]*?)-(I|II|III)-(\d{2})\.yaml$/;

/** Route segments the site already owns (src/core/route.ts): no collection may take one. */
const RESERVED = ['p', 'c', 'lab'];

const pad = (n) => String(n).padStart(2, '0');

function read(file, errors, root) {
  try {
    return parseYaml(readFileSync(file, 'utf8')) ?? {};
  } catch (e) {
    errors.push(`${relative(root, file)}: ${e.message.split('\n')[0]}`);
    return {};
  }
}

/**
 * The collections and chapters, validated and derived. `entries` are the catalogue's entries with
 * their evidence already derived; `sources` the cited works by id. Errors are pushed, never thrown.
 */
export function loadFigures(root, { entries, sources, errors }) {
  const dir = join(root, 'catalogue', 'figures');
  const out = { collections: [], chapters: [], files: [] };
  if (!existsSync(dir)) return out;
  const schemaDir = join(root, 'catalogue', 'schema');
  const entrySchema = loadSchema(join(schemaDir, 'entry.yaml'));
  const schemas = { entry: entrySchema };
  const collectionSpec = resolveRefs({ type: 'map', fields: loadSchema(join(schemaDir, 'figure-collection.yaml')).fields }, schemas);
  const chapterSpec = resolveRefs({ type: 'map', fields: loadSchema(join(schemaDir, 'figure-chapter.yaml')).fields }, schemas);
  const byId = new Map(entries.map((e) => [e.id, e]));

  const listFile = join(dir, 'collections.yaml');
  out.files.push(listFile);
  const listed = read(listFile, errors, root).collections ?? [];
  const collections = new Map();
  for (const [i, c] of listed.entries()) {
    const shape = [];
    const refs = [];
    check(c, collectionSpec, `collections[${i}]`, shape, refs);
    for (const e of shape) errors.push(`catalogue/figures/collections.yaml: ${e}`);
    for (const r of refs) if (r.type === 'source' && !sources.has(r.value)) errors.push(`catalogue/figures/collections.yaml: ${r.path}: source ${r.value} is not declared in sources.yaml`);
    if (collections.has(c.id)) errors.push(`catalogue/figures/collections.yaml: duplicate collection ${c.id}`);
    if (RESERVED.includes(c.id)) errors.push(`catalogue/figures/collections.yaml: ${c.id} is a route of its own (${RESERVED.join(', ')})`);
    collections.set(c.id, { id: c.id, title: c.title, work: c.work, summary: c.summary, chapters: [] });
  }

  const files = readdirSync(dir).filter((f) => f !== 'collections.yaml' && f.endsWith('.yaml')).sort();
  for (const f of files) {
    const file = join(dir, f);
    const rel = relative(root, file);
    out.files.push(file);
    const err = (m) => errors.push(`${rel}: ${m}`);
    const m = CHAPTER_FILE.exec(f);
    if (!m) { err('a chapter file is named <collection>-<volume>-<two-digit chapter>.yaml'); continue; }
    const doc = read(file, errors, root);
    const shape = [];
    const refs = [];
    check(doc, chapterSpec, '', shape, refs);
    for (const e of shape) err(e);
    if (shape.length) continue;
    if (doc.collection !== m[1] || doc.volume !== m[2] || pad(doc.chapter) !== m[3]) {
      err(`collection, volume and chapter must match the file name (${m[1]}, ${m[2]}, ${m[3]})`);
    }
    const coll = collections.get(doc.collection);
    if (!coll) { err(`collection ${doc.collection} is not in catalogue/figures/collections.yaml`); continue; }
    for (const r of refs) {
      if (r.type === 'entry' && !byId.has(r.value)) err(`${r.path}: ${r.value} is not a catalogue entry`);
      if (r.type === 'source' && !sources.has(r.value)) err(`${r.path}: source ${r.value} is not declared in sources.yaml`);
    }
    const key = `${doc.volume}/${pad(doc.chapter)}`;
    if (coll.chapters.some((c) => c.key === key)) err(`chapter ${key} of ${coll.id} is recorded twice`);
    const reviewed = Boolean(doc.review);
    const seen = new Set();
    const figures = doc.figures.map((fig) => {
      if (seen.has(fig.id)) err(`figure ${fig.id} is recorded twice`);
      seen.add(fig.id);
      if (!fig.id.startsWith(`${doc.chapter}-`)) err(`figure ${fig.id} is not numbered in chapter ${doc.chapter}`);
      for (const m of claimErrors(fig.claims ?? [])) err(`figure ${fig.id} ${m}`);
      const plate = byId.get(fig.plate);
      const live = plate?.status === 'live' && Boolean(plate?.evidence?.tested);
      return {
        id: fig.id,
        section: fig.section,
        anchor: fig.anchor ?? null,
        class: fig.class,
        title: fig.title,
        paraphrase: fig.paraphrase,
        plate: fig.plate,
        setup: fig.setup ?? {},
        pedagogy: fig.pedagogy ?? null,
        // read by the one claims instrument with this figure's setup under each claim's own
        claims: fig.claims ?? [],
        route: `#/${coll.id}/${key}/${fig.id}`,
        source: fig.anchor ? `${doc.url}#${fig.anchor}` : doc.url,
        routed: reviewed && live,
      };
    });
    const routed = figures.filter((x) => x.routed);
    for (const x of figures) {
      const i = routed.indexOf(x);
      x.prev = i > 0 ? routed[i - 1].id : null;
      x.next = i >= 0 && i < routed.length - 1 ? routed[i + 1].id : null;
    }
    const chapter = {
      key, collection: coll.id, work: coll.work, volume: doc.volume, chapter: doc.chapter,
      title: doc.title, url: doc.url, sameAs: doc.same_as ?? [], review: doc.review ?? null, figures,
    };
    coll.chapters.push(key);
    out.chapters.push(chapter);
    for (const x of figures) {
      const plate = byId.get(x.plate);
      if (plate) (plate.figures ??= []).push({ collection: coll.id, chapter: key, id: x.id, title: x.title, route: x.route, routed: x.routed });
    }
  }
  out.collections = [...collections.values()];
  return out;
}
