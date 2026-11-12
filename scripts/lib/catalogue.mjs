// The catalogue: the single description of the collection (ADR 0004). Read by the Vite plugin
// (virtual:catalogue, what the site ships), by scripts/catalogue.mjs (validation, scaffolding,
// the derived plan) and by scripts/build-readme.mjs. One parser, so the three cannot disagree.
//
//   catalogue/taxonomy.yaml        the classification tree, any depth, in display order
//   catalogue/labs.yaml            comparison labs: id, title, summary, engine, metrics
//   catalogue/sources.yaml         cited works and practice areas
//   catalogue/entries/<id>.md      one algorithm: YAML front matter + body (summary, notes)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { check, loadSchema } from './schema.mjs';

export const STATUSES = ['live', 'planned'];
/** A lab compares at least this many entries; the site and the gate read the same constant. */
export const LAB_MIN = 2;
export const MODES = ['2d', 'webgl', 'three'];
/** Engines a kernel may name; `custom` is a bespoke plate under src/plates/<id>/plate.ts. */
export const ENGINES = ['custom', 'array', 'tree', 'hash', 'graph', 'geometry', 'string',
  'numeric', 'signal', 'systems', 'stochastic', 'grid'];
const ID = /^[a-z0-9][a-z0-9-]*$/;
// the keys an entry may carry are declared in catalogue/schema/entry.yaml, not here
// A public tree never carries a locator into someone's machine or private code (ADR 0004 §8).
const LOCATORS = [
  [/(^|[\s(])(~\/|\/Users\/|\/home\/)/, 'a home-directory path'],
  [/\b[\w./-]+\.(ex|exs|rs|py|mjs|js|ts|tsx|sql|sh):\d+/, 'a source file and line'],
  [/\bapps\/[\w-]+\/lib\//, 'a path into an umbrella application'],
];

function readYaml(file, errors) {
  try {
    return parseYaml(readFileSync(file, 'utf8')) ?? {};
  } catch (e) {
    errors.push(`${file}: ${e.message.split('\n')[0]}`);
    return {};
  }
}

/** Split `---\nYAML\n---\nbody` into its two halves. */
export function splitFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return m ? { head: m[1], body: m[2] } : null;
}

/** Paragraphs of a Markdown body: blank-line separated, inner newlines folded to spaces. */
export function paragraphs(body) {
  return body.split(/\r?\n\s*\r?\n/).map((s) => s.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter(Boolean);
}

function privateTerms() {
  // An optional, untracked deny-list of names that must never reach this public tree.
  const file = process.env.ALGOGLYPH_PRIVATE_TERMS
    ?? join(homedir(), '.config', 'algoglyph', 'private-terms');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

/** Walk the taxonomy: every node with its full path, plus the ordered list of leaves. */
function walkTaxonomy(nodes, errors, prefix = [], out = { byPath: new Map(), leaves: [] }) {
  const seen = new Set();
  for (const [i, n] of (nodes ?? []).entries()) {
    const where = `taxonomy ${[...prefix, n?.id ?? `#${i}`].join('/')}`;
    if (!n || typeof n !== 'object') { errors.push(`${where}: not a node`); continue; }
    if (!ID.test(String(n.id ?? ''))) errors.push(`${where}: id must match ${ID}`);
    if (seen.has(n.id)) errors.push(`${where}: duplicate id among siblings`);
    seen.add(n.id);
    if (!n.title) errors.push(`${where}: title is required`);
    if (!n.summary) errors.push(`${where}: summary is required`);
    const path = [...prefix, n.id];
    const key = path.join('/');
    out.byPath.set(key, { id: n.id, title: n.title, summary: n.summary, path,
      depth: path.length, children: (n.children ?? []).map((c) => [...path, c.id].join('/')) });
    if (n.children?.length) walkTaxonomy(n.children, errors, path, out);
    else out.leaves.push(key);
  }
  return out;
}

function list(dir, pred) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => pred(join(dir, f), f)).sort();
}

/** What code exists, by convention only: plate directories and kernel files. */
export function discoverCode(root) {
  const plates = list(join(root, 'src/plates'), (p) => statSync(p).isDirectory()
    && existsSync(join(p, 'plate.ts')));
  const kernels = [];
  for (const engine of list(join(root, 'src/kernels'), (p) => statSync(p).isDirectory())) {
    for (const f of list(join(root, 'src/kernels', engine), (_, f) => f.endsWith('.ts')
      && !f.startsWith('_'))) kernels.push({ engine, id: basename(f, '.ts') });
  }
  const engines = list(join(root, 'src/engines'), (p) => statSync(p).isDirectory()
    && existsSync(join(p, 'index.ts')));
  return { plates, kernels, engines };
}

/**
 * Load and validate the catalogue. Returns the derived model and every error found; a caller
 * that ships the model must refuse it while `errors` is not empty.
 */
export function loadCatalogue(root, { code = true } = {}) {
  const errors = [];
  const dir = join(root, 'catalogue');
  const tax = readYaml(join(dir, 'taxonomy.yaml'), errors);
  const labsDoc = readYaml(join(dir, 'labs.yaml'), errors);
  const sourcesDoc = readYaml(join(dir, 'sources.yaml'), errors);
  const { byPath, leaves } = walkTaxonomy(tax.nodes, errors);
  const schema = loadSchema(join(dir, 'schema/entry.yaml'));
  const relationsDoc = readYaml(join(dir, 'relations.yaml'), errors);
  const relTypes = new Map((relationsDoc.types ?? []).map((t) => [t.id, t]));
  for (const t of relTypes.values()) {
    if (t.inverse && relTypes.has(t.inverse)) errors.push(`relations.yaml ${t.id}: inverse ${t.inverse} must be a derived name, not a declarable type`);
    if (t.symmetric && t.inverse) errors.push(`relations.yaml ${t.id}: a symmetric type has no inverse`);
  }
  const pendingRefs = [];

  const sources = new Map();
  for (const s of sourcesDoc.sources ?? []) {
    if (!ID.test(String(s.id ?? ''))) errors.push(`sources.yaml: id ${s.id} must match ${ID}`);
    else if (sources.has(s.id)) errors.push(`sources.yaml: duplicate id ${s.id}`);
    else sources.set(s.id, s);
  }
  const labs = new Map();
  for (const l of labsDoc.labs ?? []) {
    if (!ID.test(String(l.id ?? ''))) { errors.push(`labs.yaml: id ${l.id} must match ${ID}`); continue; }
    if (labs.has(l.id)) errors.push(`labs.yaml: duplicate id ${l.id}`);
    if (!ENGINES.includes(l.engine) || l.engine === 'custom') {
      errors.push(`labs.yaml ${l.id}: engine must be one of ${ENGINES.slice(1).join(', ')}`);
    }
    if (!l.title || !l.summary) errors.push(`labs.yaml ${l.id}: title and summary are required`);
    labs.set(l.id, { ...l, entries: [] });
  }

  const terms = privateTerms().map((t) => t.toLowerCase());
  const entries = [];
  const files = list(join(dir, 'entries'), (_, f) => f.endsWith('.md'));
  for (const f of files) {
    const file = join(dir, 'entries', f);
    const rel = relative(root, file);
    const text = readFileSync(file, 'utf8');
    const split = splitFrontMatter(text);
    if (!split) { errors.push(`${rel}: no front matter`); continue; }
    let fm;
    try {
      fm = parseYaml(split.head) ?? {};
    } catch (e) {
      errors.push(`${rel}: ${e.message.split('\n')[0]}`);
      continue;
    }
    const err = (m) => errors.push(`${rel}: ${m}`);
    // the shape is the schema's (catalogue/schema/entry.yaml); the checks below are semantics
    const shapeErrors = [];
    const refs = [];
    check(fm, { type: 'map', fields: schema.fields }, '', shapeErrors, refs);
    for (const e of shapeErrors) err(e);
    const id = basename(f, '.md');
    for (const r of refs) pendingRefs.push({ ...r, rel, from: id });
    if (fm.id !== id) err(`id ${fm.id} must equal the file name ${id}`);
    const leaf = String(fm.taxonomy ?? '');
    if (!byPath.has(leaf)) err(`taxonomy ${leaf || '(missing)'} is not a node of taxonomy.yaml`);
    else if (!leaves.includes(leaf)) err(`taxonomy ${leaf} is not a leaf`);
    if (!Array.isArray(fm.tags) || fm.tags.length === 0) err('tags: at least one');
    for (const l of fm.labs ?? []) {
      const lab = labs.get(l);
      if (!lab) err(`lab ${l} is not declared in labs.yaml`);
      else if (lab.engine !== fm.engine) err(`lab ${l} runs engine ${lab.engine}, not ${fm.engine}`);
      else lab.entries.push(id);
    }
    const cites = (fm.sources ?? []).map((s) => (typeof s === 'string' ? { id: s } : s));
    for (const s of cites) if (!sources.has(s.id)) err(`source ${s.id} is not declared in sources.yaml`);
    const paras = paragraphs(split.body);
    const summary = paras[0] ?? '';
    if (summary.length < 20) err('the body must open with a summary of at least 20 characters');
    if (fm.status === 'live' && paras.length < 2) err('a live entry needs reading notes after its summary');
    const lower = text.toLowerCase();
    for (const [re, what] of LOCATORS) if (re.test(text)) err(`carries ${what}; this tree is public`);
    for (const t of terms) if (lower.includes(t)) err('names a term of the private deny-list; this tree is public');
    entries.push({
      id, title: fm.title, status: fm.status, engine: fm.engine, mode: fm.mode ?? null,
      taxonomy: leaf, path: leaf.split('/'), labs: fm.labs ?? [], sources: cites,
      tags: fm.tags ?? [], complexity: fm.complexity ?? '', interaction: fm.interaction ?? '',
      motivation: fm.motivation ?? '', order: Number.isFinite(fm.order) ? fm.order : null,
      aliases: fm.aliases ?? [], pedagogy: fm.pedagogy ?? null, algorithm: fm.algorithm ?? null,
      bounds: fm.bounds ?? null, experiments: fm.experiments ?? [],
      declared: [
        ...(fm.related ?? []).map((t) => ({ type: 'related_to', target: t, reason: '' })),
        ...(fm.relations ?? []).map((r) => ({ type: r.type, target: r.target, reason: r.reason ?? '' })),
        ...(fm.pedagogy?.prerequisites ?? []).map((t) => ({ type: 'requires', target: t, reason: '' })),
      ],
      related: Array.isArray(fm.related) ? fm.related : [],
      summary, notes: paras.slice(1), file: rel,
    });
  }

  // references the schema saw, resolved now that every entry is known
  const known = new Set(entries.map((e) => e.id));
  for (const r of pendingRefs) {
    if (r.type === 'entry' && !known.has(r.value)) errors.push(`${r.rel}: ${r.path}: ${r.value} is not an entry`);
    if (r.type === 'relation' && !relTypes.has(r.value)) errors.push(`${r.rel}: ${r.path}: ${r.value} is not a relation type of relations.yaml`);
    if (r.type === 'entry' && r.value === r.from) errors.push(`${r.rel}: ${r.path}: an entry does not relate to itself`);
  }
  // typed edges: declared once, the inverse derived from the relation table
  const edges = [];
  for (const e of entries) {
    for (const d of e.declared) {
      const t = relTypes.get(d.type);
      if (!t || !known.has(d.target) || d.target === e.id) continue;
      edges.push({ from: e.id, to: d.target, type: d.type, title: t.title, reason: d.reason, derived: false });
      edges.push({ from: d.target, to: e.id, type: t.symmetric ? d.type : (t.inverse ?? `${d.type}-of`),
        title: t.inverse_title ?? t.title, reason: d.reason, derived: true });
    }
  }
  // a relation that must be acyclic (a learner cannot need A before B before A)
  for (const t of relTypes.values()) {
    if (!t.acyclic) continue;
    const next = new Map();
    for (const x of edges) if (x.type === t.id && !x.derived) (next.get(x.from) ?? next.set(x.from, []).get(x.from)).push(x.to);
    const state = new Map();
    const visit = (v, path) => {
      if (state.get(v) === 1) { errors.push(`relations: ${t.id} forms a cycle ${[...path, v].join(' -> ')}`); return; }
      if (state.get(v) === 2) return;
      state.set(v, 1);
      for (const w of next.get(v) ?? []) visit(w, [...path, v]);
      state.set(v, 2);
    };
    for (const v of next.keys()) visit(v, []);
  }
  // one edge per (from, to, type): a link declared on both sides, or declared and derived, is one
  const seen = new Map();
  for (const x of edges) {
    const key = `${x.from}\u0000${x.to}\u0000${x.type}`;
    const had = seen.get(key);
    if (!had || (had.derived && !x.derived)) seen.set(key, x);
  }
  const unique = [...seen.values()].sort((x, y) => x.from.localeCompare(y.from) || x.type.localeCompare(y.type) || x.to.localeCompare(y.to));
  for (const e of entries) {
    e.links = unique.filter((x) => x.from === e.id).map(({ from: _f, ...x }) => x);
    delete e.declared;
  }

  // links are declared one way; the reverse is derived, never authored
  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries) {
    for (const r of e.related) if (!ids.has(r)) errors.push(`${e.file}: related ${r} is not an entry`);
    e.backlinks = [];
  }
  for (const e of entries) for (const r of e.related) entries.find((x) => x.id === r)?.backlinks.push(e.id);

  // numbering: taxonomy order of the leaf, then the entry's order, then its title
  const leafRank = new Map(leaves.map((l, i) => [l, i]));
  entries.sort((a, b) => (leafRank.get(a.taxonomy) ?? 1e9) - (leafRank.get(b.taxonomy) ?? 1e9)
    || (a.order ?? 1e9) - (b.order ?? 1e9) || a.title.localeCompare(b.title));
  const width = Math.max(2, String(entries.length).length);
  entries.forEach((e, i) => { e.no = String(i + 1).padStart(width, '0'); });

  if (code) {
    const found = discoverCode(root);
    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const e of entries) {
      const plate = found.plates.includes(e.id);
      const kernel = found.kernels.find((k) => k.id === e.id);
      const has = e.engine === 'custom' ? plate : Boolean(kernel && kernel.engine === e.engine);
      e.implemented = has;
      if (e.status === 'live' && !has) {
        errors.push(`${e.file}: live, but ${e.engine === 'custom' ? `src/plates/${e.id}/plate.ts`
          : `src/kernels/${e.engine}/${e.id}.ts`} does not exist`);
      }
      if (e.status === 'planned' && (plate || kernel)) {
        errors.push(`${e.file}: planned, but its code exists; mark it live`);
      }
      if (e.status === 'live' && e.engine !== 'custom' && !found.engines.includes(e.engine)) {
        errors.push(`${e.file}: engine ${e.engine} has no src/engines/${e.engine}/index.ts`);
      }
    }
    for (const p of found.plates) {
      if (!byId.has(p)) errors.push(`src/plates/${p}: no catalogue entry ${p}`);
      else if (byId.get(p).engine !== 'custom') errors.push(`src/plates/${p}: entry names engine ${byId.get(p).engine}`);
    }
    for (const k of found.kernels) {
      const e = byId.get(k.id);
      if (!e) errors.push(`src/kernels/${k.engine}/${k.id}.ts: no catalogue entry ${k.id}`);
      else if (e.engine !== k.engine) errors.push(`src/kernels/${k.engine}/${k.id}.ts: entry names engine ${e.engine}`);
    }
  }
  for (const [id, lab] of labs) if (lab.entries.length < LAB_MIN) {
    errors.push(`labs.yaml ${id}: a lab compares at least ${LAB_MIN} entries, it has ${lab.entries.length}`);
  }

  // evidence (ADR 0005 §3): derived from code and tests, never authored. `tested` is the engine's
  // harness (one test over every live kernel of the engine) or a unit test that imports the plate
  const testDir = join(root, 'test');
  const testText = existsSync(testDir) ? list(testDir, (_, f) => f.endsWith('.ts'))
    .map((f) => readFileSync(join(testDir, f), 'utf8')).join('\n') : '';
  // a plate built from shared code (src/plates/_shared/<module>) is tested by a test that imports
  // the very modules its plate.ts imports, as binary-search is through sorted-search/search; a
  // shared view (the drawing wrapper every such plate uses) proves no algorithm, so it is not one
  const sharedTested = (id) => {
    const plate = join(root, 'src', 'plates', id, 'plate.ts');
    if (!existsSync(plate)) return false;
    const shared = [...readFileSync(plate, 'utf8').matchAll(/from '\.\.\/(_shared\/[^']+)'/g)]
      .map((m) => `plates/${m[1]}'`);
    return shared.some((path) => testText.includes(path) && !path.endsWith("/view'"));
  };
  for (const e of entries) {
    const implemented = Boolean(e.implemented);
    const harness = e.engine !== 'custom' && existsSync(join(testDir, `kernels-${e.engine}.test.ts`));
    const unit = testText.includes(`plates/${e.id}/`) || testText.includes(`kernels/${e.engine}/${e.id}`)
      || new RegExp(`describe\\(['"\`]${e.id}[:'"\` ]`).test(testText)
      || sharedTested(e.id);
    e.evidence = { implemented, tested: implemented && (harness || unit) ? (harness ? 'harness' : 'unit') : null };
    delete e.implemented;
    // a live entry is an experiment someone runs: it is tested, or it is refused (the owner,
    // 2026-11-12: every experiment standalone and tested, validated, verified, enforced)
    if (e.status === 'live' && !e.evidence.tested) {
      errors.push(`${e.file}: live, but no test names it (a describe('${e.id}'), an import of plates/${e.id}/ or kernels/${e.engine}/${e.id}, or the engine harness test/kernels-${e.engine}.test.ts)`);
    }
    // maturity: each profile needs the ones before it; the first one missing is the next gap
    const documented = e.notes.length > 0 && e.sources.length > 0 && Boolean(e.pedagogy || e.algorithm || e.bounds);
    const steps = [['catalogued', true], ['documented', documented], ['implemented', implemented], ['tested', Boolean(e.evidence.tested)]];
    const reached = [];
    for (const [name, ok] of steps) { if (!ok) break; reached.push(name); }
    e.maturity = { reached, next: steps.find(([, ok]) => !ok)?.[0] ?? null };
  }

  // the tree, with counts rolled up from the leaves
  const count = new Map([...byPath.keys()].map((k) => [k, { live: 0, planned: 0 }]));
  for (const e of entries) {
    for (let d = 1; d <= e.path.length; d++) {
      const c = count.get(e.path.slice(0, d).join('/'));
      if (c) c[e.status] += 1;
    }
  }
  const nodes = [...byPath.entries()].map(([key, n]) => ({ key, ...n, ...count.get(key) }));
  return {
    errors,
    model: {
      labMin: LAB_MIN,
      relationTypes: [...relTypes.values()],
      nodes,
      roots: nodes.filter((n) => n.depth === 1).map((n) => n.key),
      entries: entries.map(({ file: _file, ...e }) => e),
      labs: [...labs.values()],
      sources: [...sources.values()],
    },
    files: [join(dir, 'taxonomy.yaml'), join(dir, 'labs.yaml'), join(dir, 'sources.yaml'),
      ...files.map((f) => join(dir, 'entries', f))],
  };
}
